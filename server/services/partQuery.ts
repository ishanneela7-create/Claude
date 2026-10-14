import type { Database } from 'better-sqlite3';
import Fuse from 'fuse.js';
import type { GROUP_FIELDS } from '@shared/constants';
import type { PartFilter, PartListQuery } from '@shared/querySchemas';
import type { PartListResult } from '@shared/types';
import { currentDataVersion } from './dataVersion';
import { buildFilter } from './partFilters';
import { PART_SELECT, toPartRecords } from './partRows';

export type GroupField = (typeof GROUP_FIELDS)[number];

const SORT_SQL: Record<PartListQuery['sort'], string[]> = {
  name: ['p.name COLLATE NOCASE'],
  category: ['p.category', 'p.name COLLATE NOCASE'],
  color: ['c.name COLLATE NOCASE', 'p.name COLLATE NOCASE'],
  quantity: ['p.quantity', 'p.name COLLATE NOCASE'],
  location: ["COALESCE(l.path, '') COLLATE NOCASE", 'p.name COLLATE NOCASE'],
  created_at: ['p.created_at'],
};

export const GROUP_SQL: Record<GroupField, string> = {
  category: 'p.category',
  color: 'c.name',
  location: "COALESCE(l.path, '(No location)')",
  kind: 'p.kind',
  subcategory: "COALESCE(NULLIF(p.subcategory, ''), '(None)')",
};

const FROM_SQL = `FROM parts p JOIN colors c ON c.id = p.color_id
                  LEFT JOIN locations l ON l.id = p.location_id`;

function orderBy(sort: PartListQuery['sort'], dir: 'asc' | 'desc', group?: GroupField): string {
  const direction = dir === 'desc' ? 'DESC' : 'ASC';
  const sortParts = SORT_SQL[sort].map((piece, index) =>
    index === 0 ? `${piece} ${direction}` : piece,
  );
  const prefix = group ? [`${GROUP_SQL[group]} COLLATE NOCASE ASC`] : [];
  return [...prefix, ...sortParts, 'p.id'].join(', ');
}

interface FuzzyCache {
  version: number;
  fuse: Fuse<{ id: string; text: string }>;
}
const fuzzyCaches = new WeakMap<Database, FuzzyCache>();

/** Typo-tolerant backup: only used when the normal search finds nothing. */
function fuzzyIds(db: Database, terms: string[]): string[] {
  let cache = fuzzyCaches.get(db);
  if (!cache || cache.version !== currentDataVersion()) {
    const rows = db
      .prepare(
        `SELECT p.id, p.name || ' ' || COALESCE(p.design_id, '') || ' ' || c.name AS text
         ${FROM_SQL} WHERE p.deleted_at IS NULL AND p.is_current = 1`,
      )
      .all() as { id: string; text: string }[];
    cache = {
      version: currentDataVersion(),
      fuse: new Fuse(rows, { keys: ['text'], threshold: 0.3, ignoreLocation: true }),
    };
    fuzzyCaches.set(db, cache);
  }
  return cache.fuse
    .search(terms.join(' '), { limit: 200 })
    .map((result) => result.item.id);
}

export function listParts(
  db: Database,
  query: PartListQuery,
  group?: GroupField,
): PartListResult {
  const { offset, limit, sort, dir, ...filter } = query;
  let built = buildFilter(filter);
  const run = (current: typeof built) => {
    const total = (
      db.prepare(`SELECT COUNT(*) AS n ${FROM_SQL} WHERE ${current.where}`).get(...current.params) as {
        n: number;
      }
    ).n;
    return total;
  };

  let total = run(built);
  if (total === 0 && built.hasText) {
    const ids = fuzzyIds(db, built.terms);
    if (ids.length > 0) {
      built = buildFilter({ ...filter, q: removeTerms(filter.q ?? '', built.terms) }, ids);
      total = run(built);
    }
  }

  const rows = db
    .prepare(
      `${PART_SELECT} WHERE ${built.where} ORDER BY ${orderBy(sort, dir, group)} LIMIT ? OFFSET ?`,
    )
    .all(...built.params, limit, offset) as Parameters<typeof toPartRecords>[1];
  return { items: toPartRecords(db, rows), total, offset, limit };
}

function removeTerms(q: string, terms: string[]): string {
  let result = q;
  for (const term of terms) result = result.replace(term, '');
  return result.trim();
}

export function countGroups(
  db: Database,
  filter: PartFilter,
  group: GroupField,
): Array<{ key: string; count: number }> {
  const built = buildFilter(filter);
  return db
    .prepare(
      `SELECT ${GROUP_SQL[group]} AS key, COUNT(*) AS count ${FROM_SQL}
       WHERE ${built.where} GROUP BY key ORDER BY key COLLATE NOCASE`,
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
    .prepare(`SELECT p.id ${FROM_SQL} WHERE ${built.where} LIMIT ?`)
    .all(...built.params, cap) as { id: string }[];
  return rows.map((row) => row.id);
}
