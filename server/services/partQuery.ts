import type { Database } from 'better-sqlite3';
import type { GROUP_FIELDS } from '@shared/constants';
import type { PartFilter, PartListQuery } from '@shared/querySchemas';
import type { PartListResult } from '@shared/types';
import { buildFilter, type BuiltFilter } from './partFilters';
import { PART_SELECT, toPartRecords } from './partRows';
import { correctTerms } from './spellFix';

export type GroupField = (typeof GROUP_FIELDS)[number];

interface OrderSpec {
  columns: string[];
  usesColor?: boolean;
  usesLocation?: boolean;
}

const SORTS: Record<PartListQuery['sort'], OrderSpec> = {
  name: { columns: ['p.name COLLATE NOCASE'] },
  category: { columns: ['p.category', 'p.name COLLATE NOCASE'] },
  color: { columns: ['c.name COLLATE NOCASE', 'p.name COLLATE NOCASE'], usesColor: true },
  quantity: { columns: ['p.quantity', 'p.name COLLATE NOCASE'] },
  location: {
    columns: ["COALESCE(l.path, '') COLLATE NOCASE", 'p.name COLLATE NOCASE'],
    usesLocation: true,
  },
  created_at: { columns: ['p.created_at'] },
};

interface GroupSpec {
  expr: string;
  order: string;
  usesColor?: boolean;
  usesLocation?: boolean;
}

export const GROUPS: Record<GroupField, GroupSpec> = {
  category: { expr: 'p.category', order: 'p.category' },
  kind: { expr: 'p.kind', order: 'p.kind' },
  color: { expr: 'c.name', order: 'c.name COLLATE NOCASE', usesColor: true },
  location: {
    expr: "COALESCE(l.path, '(No location)')",
    order: "COALESCE(l.path, '(No location)') COLLATE NOCASE",
    usesLocation: true,
  },
  subcategory: {
    expr: "COALESCE(NULLIF(p.subcategory, ''), '(None)')",
    order: "COALESCE(NULLIF(p.subcategory, ''), '(None)') COLLATE NOCASE",
  },
};

interface Needs {
  color: boolean;
  location: boolean;
}

/** Only join the color and location tables when the query really needs them. */
function fromClause(needs: Needs): string {
  return (
    'FROM parts p' +
    (needs.color ? ' JOIN colors c ON c.id = p.color_id' : '') +
    (needs.location ? ' LEFT JOIN locations l ON l.id = p.location_id' : '')
  );
}

function orderClause(sort: PartListQuery['sort'], dir: 'asc' | 'desc', group?: GroupField): string {
  const direction = dir === 'desc' ? 'DESC' : 'ASC';
  const parts = [...SORTS[sort].columns, 'p.id'].map((column) => `${column} ${direction}`);
  return group ? [`${GROUPS[group].order} ASC`, ...parts].join(', ') : parts.join(', ');
}

function countMatches(db: Database, built: BuiltFilter, needs: Needs): number {
  if (built.textOnly && built.match) {
    // The search index only holds live, current parts, so it can count by itself (very fast).
    const row = db
      .prepare('SELECT COUNT(*) AS n FROM parts_search WHERE parts_search MATCH ?')
      .get(built.match) as { n: number };
    return row.n;
  }
  const row = db
    .prepare(`SELECT COUNT(*) AS n ${fromClause(needs)} WHERE ${built.where}`)
    .get(...built.params) as { n: number };
  return row.n;
}

export function listParts(db: Database, query: PartListQuery, group?: GroupField): PartListResult {
  const { offset, limit, sort, dir, ...filter } = query;
  const sortSpec = SORTS[sort];
  const groupSpec = group ? GROUPS[group] : undefined;
  let built = buildFilter(filter);
  let corrections: PartListResult['corrections'];

  const needsFor = (current: BuiltFilter): Needs => ({
    color: current.usesColor || !!sortSpec.usesColor || !!groupSpec?.usesColor,
    location: current.usesLocation || !!sortSpec.usesLocation || !!groupSpec?.usesLocation,
  });

  let total = countMatches(db, built, needsFor(built));
  if (total === 0 && built.terms.length > 0) {
    const fixed = correctTerms(db, built.terms);
    if (fixed) {
      built = buildFilter(filter, fixed.terms);
      total = countMatches(db, built, needsFor(built));
      corrections = fixed.changes;
    }
  }

  // Step 1: find the ids of this page (cheap: walks an index). Step 2: load those rows.
  const needs = needsFor(built);
  const ids = (
    db
      .prepare(
        `SELECT p.id AS id ${fromClause(needs)} WHERE ${built.where}
         ORDER BY ${orderClause(sort, dir, group)} LIMIT ? OFFSET ?`,
      )
      .all(...built.params, limit, offset) as { id: string }[]
  ).map((row) => row.id);

  let items: PartListResult['items'] = [];
  if (ids.length > 0) {
    const rows = db
      .prepare(`${PART_SELECT} WHERE p.id IN (${ids.map(() => '?').join(',')})`)
      .all(...ids) as Parameters<typeof toPartRecords>[1];
    const byId = new Map(toPartRecords(db, rows).map((part) => [part.id, part]));
    items = ids.flatMap((id) => byId.get(id) ?? []);
  }
  return { items, total, offset, limit, ...(corrections && { corrections }) };
}

export function countGroups(
  db: Database,
  filter: PartFilter,
  group: GroupField,
): Array<{ key: string; count: number }> {
  let built = buildFilter(filter);
  const spec = GROUPS[group];
  const needsFor = (current: BuiltFilter): Needs => ({
    color: current.usesColor || !!spec.usesColor,
    location: current.usesLocation || !!spec.usesLocation,
  });
  if (built.terms.length > 0 && countMatches(db, built, needsFor(built)) === 0) {
    const fixed = correctTerms(db, built.terms);
    if (fixed) built = buildFilter(filter, fixed.terms);
  }
  return db
    .prepare(
      `SELECT ${spec.expr} AS key, COUNT(*) AS count ${fromClause(needsFor(built))}
       WHERE ${built.where} GROUP BY key ORDER BY ${spec.order}`,
    )
    .all(...built.params) as Array<{ key: string; count: number }>;
}

export function totalsFor(db: Database): { parts: number; pieces: number } {
  return db
    .prepare(
      `SELECT COUNT(*) AS parts, COALESCE(SUM(quantity), 0) AS pieces FROM parts
       WHERE deleted_at IS NULL AND is_current = 1`,
    )
    .get() as { parts: number; pieces: number };
}

/** Every matching id (up to a cap), so "select all matching" works on huge libraries. */
export function listPartIds(db: Database, filter: PartFilter, cap = 50000): string[] {
  const built = buildFilter(filter);
  const rows = db
    .prepare(
      `SELECT p.id AS id ${fromClause({ color: built.usesColor, location: built.usesLocation })}
       WHERE ${built.where} LIMIT ?`,
    )
    .all(...built.params, cap) as { id: string }[];
  return rows.map((row) => row.id);
}
