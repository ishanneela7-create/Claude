import type { Database } from 'better-sqlite3';
import type { Migration } from './types';

export const initialMigration: Migration = {
  version: 1,
  name: 'initial_schema',
  up(db: Database) {
    db.exec(`
      CREATE TABLE colors (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        rgb TEXT NOT NULL,
        is_transparent INTEGER NOT NULL DEFAULT 0,
        is_metallic INTEGER NOT NULL DEFAULT 0,
        is_custom INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_colors_name ON colors(name COLLATE NOCASE);

      CREATE TABLE locations (
        id TEXT PRIMARY KEY,
        parent_id TEXT REFERENCES locations(id),
        name TEXT NOT NULL,
        level_label TEXT,
        label TEXT,
        color_code TEXT,
        path TEXT NOT NULL DEFAULT '',
        id_path TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_locations_parent ON locations(parent_id);
      CREATE INDEX idx_locations_id_path ON locations(id_path);

      CREATE TABLE parts (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('official','custom')),
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        subcategory TEXT,
        color_id INTEGER NOT NULL REFERENCES colors(id),
        quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
        location_id TEXT REFERENCES locations(id),
        notes TEXT,
        image_path TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        design_id TEXT,
        rebrickable_part_num TEXT,
        ldraw_id TEXT,
        year_introduced INTEGER,
        source TEXT CHECK (source IS NULL OR source IN ('3d_printed','modified_official','scratch_built','other')),
        creator TEXT,
        width_plates REAL,
        depth_plates REAL,
        height_plates REAL,
        stud_pattern TEXT,
        material TEXT,
        print_profile_notes TEXT,
        version INTEGER,
        version_group_id TEXT,
        is_current INTEGER NOT NULL DEFAULT 1,
        parent_part_id TEXT REFERENCES parts(id),
        CHECK (kind <> 'official' OR design_id IS NOT NULL),
        CHECK (kind <> 'custom' OR (source IS NOT NULL AND version >= 1))
      );
      CREATE INDEX idx_parts_live ON parts(deleted_at, is_current);
      CREATE INDEX idx_parts_name ON parts(name COLLATE NOCASE);
      CREATE INDEX idx_parts_kind ON parts(kind);
      CREATE INDEX idx_parts_category ON parts(category);
      CREATE INDEX idx_parts_color ON parts(color_id);
      CREATE INDEX idx_parts_location ON parts(location_id);
      CREATE INDEX idx_parts_design_color ON parts(design_id, color_id);
      CREATE INDEX idx_parts_quantity ON parts(quantity);
      CREATE INDEX idx_parts_created ON parts(created_at);
      CREATE INDEX idx_parts_version_group ON parts(version_group_id);

      CREATE TABLE tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE
      );
      CREATE TABLE part_tags (
        part_id TEXT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
        tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (part_id, tag_id)
      );
      CREATE INDEX idx_part_tags_tag ON part_tags(tag_id);

      CREATE TABLE part_photos (
        id TEXT PRIMARY KEY,
        part_id TEXT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        thumb_path TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_photos_part ON part_photos(part_id);

      CREATE TABLE smart_views (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        filter_json TEXT NOT NULL,
        is_builtin INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        changes_json TEXT NOT NULL,
        undone INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE imports (
        id TEXT PRIMARY KEY,
        source_name TEXT NOT NULL,
        format TEXT NOT NULL,
        mapping_json TEXT,
        row_count INTEGER NOT NULL DEFAULT 0,
        created_count INTEGER NOT NULL DEFAULT 0,
        updated_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('done','rolled_back')),
        created_at TEXT NOT NULL
      );
      CREATE TABLE import_rows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        import_id TEXT NOT NULL REFERENCES imports(id),
        part_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('created','updated')),
        before_json TEXT
      );
      CREATE INDEX idx_import_rows_import ON import_rows(import_id);
    `);
  },
  down(db: Database) {
    db.exec(`
      DROP TABLE IF EXISTS import_rows;
      DROP TABLE IF EXISTS imports;
      DROP TABLE IF EXISTS history;
      DROP TABLE IF EXISTS smart_views;
      DROP TABLE IF EXISTS part_photos;
      DROP TABLE IF EXISTS part_tags;
      DROP TABLE IF EXISTS tags;
      DROP TABLE IF EXISTS parts;
      DROP TABLE IF EXISTS locations;
      DROP TABLE IF EXISTS colors;
    `);
  },
};
