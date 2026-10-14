import type { Database } from 'better-sqlite3';
import type { Migration } from './types';

/**
 * Partial indexes only hold live, current parts, so list queries can walk them in order
 * and stop after one page. fts5vocab lets us fix typos using the words really in the library.
 */
export const speedIndexesMigration: Migration = {
  version: 4,
  name: 'speed_indexes_and_vocabulary',
  up(db: Database) {
    const live = 'WHERE deleted_at IS NULL AND is_current = 1';
    db.exec(`
      DROP INDEX idx_parts_live;
      CREATE INDEX idx_live_name ON parts(name COLLATE NOCASE, id) ${live};
      CREATE INDEX idx_live_created ON parts(created_at, id) ${live};
      CREATE INDEX idx_live_quantity ON parts(quantity, name COLLATE NOCASE, id) ${live};
      CREATE INDEX idx_live_category ON parts(category, name COLLATE NOCASE, id) ${live};
      CREATE INDEX idx_live_kind ON parts(kind, name COLLATE NOCASE, id) ${live};
      CREATE INDEX idx_live_location ON parts(location_id) ${live};
      CREATE INDEX idx_live_color ON parts(color_id) ${live};
      CREATE VIRTUAL TABLE parts_search_vocab USING fts5vocab(parts_search, row);
    `);
  },
  down(db: Database) {
    db.exec(`
      DROP TABLE IF EXISTS parts_search_vocab;
      DROP INDEX IF EXISTS idx_live_color;
      DROP INDEX IF EXISTS idx_live_location;
      DROP INDEX IF EXISTS idx_live_kind;
      DROP INDEX IF EXISTS idx_live_category;
      DROP INDEX IF EXISTS idx_live_quantity;
      DROP INDEX IF EXISTS idx_live_created;
      DROP INDEX IF EXISTS idx_live_name;
      CREATE INDEX idx_parts_live ON parts(deleted_at, is_current);
    `);
  },
};
