import type { Database } from 'better-sqlite3';
import { HISTORY_LIMIT } from '@shared/constants';

export type Row = Record<string, string | number | null>;

/** One thing that changed. `before` null = the row was created. `after` null = it was removed. */
export type Change =
  | { type: 'row'; table: string; id: string | number; before: Row | null; after: Row | null }
  | { type: 'tags'; partId: string; before: string[]; after: string[] };

const JOURNALED_TABLES = new Set([
  'parts',
  'locations',
  'colors',
  'tags',
  'part_photos',
  'smart_views',
]);

export function assertSafeName(name: string): void {
  if (!/^[a-z_]+$/.test(name)) throw new Error(`Unsafe SQL name: ${name}`);
}

export function readRow(db: Database, table: string, id: string | number): Row | null {
  assertSafeName(table);
  return (db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Row | undefined) ?? null;
}

function writeRow(db: Database, table: string, row: Row): void {
  assertSafeName(table);
  const columns = Object.keys(row);
  columns.forEach(assertSafeName);
  const placeholders = columns.map((column) => `@${column}`).join(', ');
  const updates = columns
    .filter((column) => column !== 'id')
    .map((column) => `${column} = excluded.${column}`)
    .join(', ');
  db.prepare(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${updates}`,
  ).run(row);
}

export function readPartTags(db: Database, partId: string): string[] {
  const rows = db
    .prepare(
      `SELECT t.name FROM part_tags pt JOIN tags t ON t.id = pt.tag_id
       WHERE pt.part_id = ? ORDER BY t.name COLLATE NOCASE`,
    )
    .all(partId) as { name: string }[];
  return rows.map((row) => row.name);
}

/** Finds a tag by name (any letter case) or makes it. Returns its id. */
export function ensureTag(db: Database, name: string, record: (change: Change) => void): string {
  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as
    { id: string } | undefined;
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run(id, name);
  record({ type: 'row', table: 'tags', id, before: null, after: { id, name } });
  return id;
}

/**
 * Every write to user data goes through here, so each action can be undone and redone.
 * Imports pass `track: false` (they have their own rollback log).
 */
export class ActionRecorder {
  readonly changes: Change[] = [];
  readonly touchedPartIds = new Set<string>();
  readonly touchedLocationIds = new Set<string>();

  constructor(
    readonly db: Database,
    private readonly track = true,
  ) {}

  private note(change: Change): void {
    if (this.track) this.changes.push(change);
    if (change.type === 'tags') this.touchedPartIds.add(change.partId);
    else if (change.table === 'parts') this.touchedPartIds.add(String(change.id));
    else if (change.table === 'locations') this.touchedLocationIds.add(String(change.id));
  }

  insert(table: string, row: Row & { id: string | number }): void {
    if (!JOURNALED_TABLES.has(table)) throw new Error(`Table not journaled: ${table}`);
    writeRow(this.db, table, row);
    this.note({
      type: 'row',
      table,
      id: row.id,
      before: null,
      after: readRow(this.db, table, row.id),
    });
  }

  update(table: string, id: string | number, patch: Row): void {
    const before = readRow(this.db, table, id);
    if (!before) throw new Error(`Row not found: ${table}/${id}`);
    writeRow(this.db, table, { ...before, ...patch, id });
    this.note({ type: 'row', table, id, before, after: readRow(this.db, table, id) });
  }

  remove(table: string, id: string | number): void {
    const before = readRow(this.db, table, id);
    if (!before) return;
    assertSafeName(table);
    this.db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    this.note({ type: 'row', table, id, before, after: null });
  }

  setTags(partId: string, names: string[]): void {
    const before = readPartTags(this.db, partId);
    const seen = new Set<string>();
    const unique = names.filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    this.db.prepare('DELETE FROM part_tags WHERE part_id = ?').run(partId);
    const link = this.db.prepare('INSERT INTO part_tags (part_id, tag_id) VALUES (?, ?)');
    for (const name of unique)
      link.run(
        partId,
        ensureTag(this.db, name, (c) => this.note(c)),
      );
    this.note({ type: 'tags', partId, before, after: readPartTags(this.db, partId) });
  }

  /** Saves the action so it can be undone. Does nothing if nothing changed. */
  commit(label: string): void {
    if (!this.track || this.changes.length === 0) return;
    this.db.prepare('DELETE FROM history WHERE undone = 1').run();
    this.db
      .prepare('INSERT INTO history (label, changes_json, undone, created_at) VALUES (?, ?, 0, ?)')
      .run(label, JSON.stringify(this.changes), new Date().toISOString());
    this.db
      .prepare(
        `DELETE FROM history WHERE id NOT IN
         (SELECT id FROM history ORDER BY id DESC LIMIT ${HISTORY_LIMIT})`,
      )
      .run();
  }
}

export function applyChange(db: Database, change: Change, direction: 'undo' | 'redo'): void {
  const target = direction === 'undo' ? 'before' : 'after';
  if (change.type === 'tags') {
    const recorder = new ActionRecorder(db, false);
    recorder.setTags(change.partId, change[target]);
    return;
  }
  const row = change[target];
  if (row === null) {
    assertSafeName(change.table);
    db.prepare(`DELETE FROM ${change.table} WHERE id = ?`).run(change.id);
  } else {
    writeRow(db, change.table, row);
  }
}
