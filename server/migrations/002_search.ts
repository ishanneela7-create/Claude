import type { Database } from 'better-sqlite3';
import type { Migration } from './types';

/** Full text search table. It is rebuilt from parts, so dropping it never loses user data. */
export const searchMigration: Migration = {
  version: 2,
  name: 'full_text_search',
  up(db: Database) {
    db.exec(`
      CREATE VIRTUAL TABLE parts_search USING fts5(
        part_id UNINDEXED,
        body,
        tokenize = 'unicode61 remove_diacritics 2',
        prefix = '2 3'
      );
    `);
  },
  down(db: Database) {
    db.exec('DROP TABLE IF EXISTS parts_search;');
  },
};
