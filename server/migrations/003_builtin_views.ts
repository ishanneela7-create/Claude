import type { Database } from 'better-sqlite3';
import type { Migration } from './types';

const BUILTIN_VIEWS = [
  { id: 'builtin-low-stock', name: 'Low stock', filter: { low_stock: true }, order: 1 },
  { id: 'builtin-custom', name: 'Custom parts', filter: { kind: 'custom' }, order: 2 },
  { id: 'builtin-needs-sorting', name: 'Needs sorting', filter: { needs_sorting: true }, order: 3 },
  {
    id: 'builtin-missing-location',
    name: 'Missing location',
    filter: { missing_location: true },
    order: 4,
  },
];

export const builtinViewsMigration: Migration = {
  version: 3,
  name: 'builtin_smart_views',
  up(db: Database) {
    const insert = db.prepare(
      'INSERT OR IGNORE INTO smart_views (id, name, filter_json, is_builtin, sort_order) VALUES (?, ?, ?, 1, ?)',
    );
    for (const view of BUILTIN_VIEWS) {
      insert.run(view.id, view.name, JSON.stringify(view.filter), view.order);
    }
  },
  down(db: Database) {
    db.prepare("DELETE FROM smart_views WHERE is_builtin = 1 AND id LIKE 'builtin-%'").run();
  },
};
