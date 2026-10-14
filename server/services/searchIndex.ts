import type { Database } from 'better-sqlite3';
import { bumpDataVersion } from './dataVersion';

interface IndexSource {
  rowid: number;
  id: string;
  name: string;
  design_id: string | null;
  rebrickable_part_num: string | null;
  ldraw_id: string | null;
  kind: string;
  source: string | null;
  creator: string | null;
  category: string;
  subcategory: string | null;
  notes: string | null;
  color_name: string;
  location_path: string | null;
  tag_names: string | null;
  is_current: number;
  deleted_at: string | null;
}

const SOURCE_SQL = `
  SELECT p.rowid AS rowid, p.id, p.name, p.design_id, p.rebrickable_part_num, p.ldraw_id,
         p.kind, p.source, p.creator, p.category, p.subcategory, p.notes, p.is_current, p.deleted_at,
         c.name AS color_name, l.path AS location_path,
         (SELECT group_concat(t.name, ' ') FROM part_tags pt JOIN tags t ON t.id = pt.tag_id
           WHERE pt.part_id = p.id) AS tag_names
  FROM parts p
  JOIN colors c ON c.id = p.color_id
  LEFT JOIN locations l ON l.id = p.location_id`;

function buildBody(row: IndexSource): string {
  return [
    row.name,
    row.design_id,
    row.rebrickable_part_num,
    row.ldraw_id,
    row.kind,
    row.source,
    row.creator,
    row.color_name,
    row.category,
    row.subcategory,
    row.tag_names,
    row.notes,
    row.location_path,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ');
}

function writeEntries(db: Database, rows: IndexSource[]): void {
  const remove = db.prepare('DELETE FROM parts_search WHERE rowid = ?');
  const add = db.prepare('INSERT INTO parts_search (rowid, part_id, body) VALUES (?, ?, ?)');
  for (const row of rows) {
    remove.run(row.rowid);
    if (row.is_current === 1 && row.deleted_at === null) add.run(row.rowid, row.id, buildBody(row));
  }
}

/** Refreshes the search entries for these parts (call after any change to them). */
export function reindexParts(db: Database, ids: Iterable<string>): void {
  const list = [...ids];
  const select = db.prepare(`${SOURCE_SQL} WHERE p.id = ?`);
  const rows: IndexSource[] = [];
  const dropByPartId = db.prepare('DELETE FROM parts_search WHERE part_id = ?');
  for (const id of list) {
    const row = select.get(id) as IndexSource | undefined;
    if (row) rows.push(row);
    else dropByPartId.run(id); // the part row is gone (e.g. undo of "add part")
  }
  writeEntries(db, rows);
  bumpDataVersion();
}

export function reindexLocationParts(db: Database, locationIds: Iterable<string>): void {
  const ids: string[] = [];
  const select = db.prepare('SELECT id FROM parts WHERE location_id = ?');
  for (const locationId of locationIds) {
    for (const row of select.all(locationId) as { id: string }[]) ids.push(row.id);
  }
  reindexParts(db, ids);
}

export function rebuildSearchIndex(db: Database): number {
  db.transaction(() => {
    db.prepare('DELETE FROM parts_search').run();
    const rows = db.prepare(`${SOURCE_SQL}`).all() as IndexSource[];
    writeEntries(db, rows);
  })();
  bumpDataVersion();
  return (db.prepare('SELECT COUNT(*) AS n FROM parts_search').get() as { n: number }).n;
}

/** Rebuilds only when the index and the parts table disagree (cheap check on startup). */
export function ensureSearchIndex(db: Database): void {
  const live = db
    .prepare('SELECT COUNT(*) AS n FROM parts WHERE deleted_at IS NULL AND is_current = 1')
    .get() as { n: number };
  const indexed = db.prepare('SELECT COUNT(*) AS n FROM parts_search').get() as { n: number };
  if (live.n !== indexed.n) rebuildSearchIndex(db);
}

/** Turns typed words into a safe FTS5 query: every word must match as a prefix. */
export function buildMatchExpression(terms: string[]): string | null {
  const pieces: string[] = [];
  for (const term of terms) {
    const clean = term.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (clean) pieces.push(`"${clean}"*`);
  }
  return pieces.length > 0 ? pieces.join(' AND ') : null;
}
