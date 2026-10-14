import type { Database } from 'better-sqlite3';
import type { HistoryEntry } from '@shared/types';
import { applyChange, type Change } from '../recorder';
import { reindexLocationParts, reindexParts } from './searchIndex';

interface HistoryRow {
  id: number;
  label: string;
  changes_json: string;
  undone: number;
  created_at: string;
}

export function listHistory(db: Database): HistoryEntry[] {
  const rows = db.prepare('SELECT * FROM history ORDER BY id DESC').all() as HistoryRow[];
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    undone: row.undone === 1,
    created_at: row.created_at,
  }));
}

function refreshIndexes(db: Database, changes: Change[]): void {
  const partIds = new Set<string>();
  const locationIds = new Set<string>();
  for (const change of changes) {
    if (change.type === 'tags') partIds.add(change.partId);
    else if (change.table === 'parts') partIds.add(String(change.id));
    else if (change.table === 'locations') locationIds.add(String(change.id));
    else if (change.table === 'colors' || change.table === 'tags') {
      const rows = db
        .prepare(
          change.table === 'colors'
            ? 'SELECT id FROM parts WHERE color_id = ?'
            : 'SELECT part_id AS id FROM part_tags WHERE tag_id = ?',
        )
        .all(change.id) as { id: string }[];
      rows.forEach((row) => partIds.add(row.id));
    }
  }
  reindexParts(db, partIds);
  reindexLocationParts(db, locationIds);
}

function step(db: Database, direction: 'undo' | 'redo'): HistoryEntry | null {
  const row = db
    .prepare(
      direction === 'undo'
        ? 'SELECT * FROM history WHERE undone = 0 ORDER BY id DESC LIMIT 1'
        : 'SELECT * FROM history WHERE undone = 1 ORDER BY id ASC LIMIT 1',
    )
    .get() as HistoryRow | undefined;
  if (!row) return null;
  const changes = JSON.parse(row.changes_json) as Change[];
  const ordered = direction === 'undo' ? [...changes].reverse() : changes;
  for (const change of ordered) applyChange(db, change, direction);
  refreshIndexes(db, changes);
  db.prepare('UPDATE history SET undone = ? WHERE id = ?').run(direction === 'undo' ? 1 : 0, row.id);
  return { id: row.id, label: row.label, undone: direction === 'undo', created_at: row.created_at };
}

/** Undoes or redoes up to `steps` actions. Returns what was changed. */
export function moveHistory(db: Database, direction: 'undo' | 'redo', steps = 1): HistoryEntry[] {
  const done: HistoryEntry[] = [];
  db.transaction(() => {
    for (let index = 0; index < steps; index++) {
      const entry = step(db, direction);
      if (!entry) break;
      done.push(entry);
    }
  })();
  return done;
}
