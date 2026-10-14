import type { Database } from 'better-sqlite3';
import type { SmartViewInput } from '@shared/querySchemas';
import type { SmartViewRecord } from '@shared/types';
import { conflict, notFound } from '../http';
import { ActionRecorder } from '../recorder';

interface ViewRow {
  id: string;
  name: string;
  filter_json: string;
  is_builtin: number;
}

function toRecord(row: ViewRow): SmartViewRecord {
  return {
    id: row.id,
    name: row.name,
    filter: JSON.parse(row.filter_json) as Record<string, unknown>,
    is_builtin: row.is_builtin === 1,
  };
}

export function listSmartViews(db: Database): SmartViewRecord[] {
  const rows = db
    .prepare('SELECT * FROM smart_views ORDER BY is_builtin DESC, sort_order, name COLLATE NOCASE')
    .all() as ViewRow[];
  return rows.map(toRecord);
}

function getView(db: Database, id: string): ViewRow {
  const row = db.prepare('SELECT * FROM smart_views WHERE id = ?').get(id) as ViewRow | undefined;
  if (!row) throw notFound('Smart view');
  return row;
}

export function createSmartView(db: Database, input: SmartViewInput): SmartViewRecord {
  const recorder = new ActionRecorder(db);
  const id = crypto.randomUUID();
  db.transaction(() => {
    recorder.insert('smart_views', {
      id,
      name: input.name,
      filter_json: JSON.stringify(input.filter),
      is_builtin: 0,
      sort_order: 100,
    });
    recorder.commit(`Save view ${input.name}`);
  })();
  return toRecord(getView(db, id));
}

export function updateSmartView(
  db: Database,
  id: string,
  input: Partial<SmartViewInput>,
): SmartViewRecord {
  const view = getView(db, id);
  if (view.is_builtin) throw conflict('Built-in views cannot be changed');
  const recorder = new ActionRecorder(db);
  db.transaction(() => {
    recorder.update('smart_views', id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.filter !== undefined && { filter_json: JSON.stringify(input.filter) }),
    });
    recorder.commit(`Edit view ${view.name}`);
  })();
  return toRecord(getView(db, id));
}

export function deleteSmartView(db: Database, id: string): void {
  const view = getView(db, id);
  if (view.is_builtin) throw conflict('Built-in views cannot be deleted');
  const recorder = new ActionRecorder(db);
  db.transaction(() => {
    recorder.remove('smart_views', id);
    recorder.commit(`Delete view ${view.name}`);
  })();
}
