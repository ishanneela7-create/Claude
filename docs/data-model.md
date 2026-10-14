# Data model

SQLite, one file: `data/library.db`. Foreign keys ON, WAL mode ON. IDs are UUID text (made with `crypto.randomUUID()`). Times are ISO-8601 text in UTC.

## parts (one table for both kinds)

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| kind | TEXT NOT NULL | `official` or `custom` (CHECK) |
| name | TEXT NOT NULL | |
| category | TEXT NOT NULL | Bricks, Plates, Tiles, Slopes, Technic, Wheels, Minifig Parts, Specialty |
| subcategory | TEXT | optional |
| color_id | INTEGER NOT NULL | FK colors.id |
| quantity | INTEGER NOT NULL DEFAULT 0 | CHECK >= 0 |
| location_id | TEXT | FK locations.id, NULL = "Missing location" |
| notes | TEXT | markdown |
| image_path | TEXT | optional main photo |
| created_at, updated_at | TEXT NOT NULL | |
| deleted_at | TEXT | soft delete |
| **official only** | | |
| design_id | TEXT | e.g. `3001` (text, because some have letters like `3001a`) |
| rebrickable_part_num | TEXT | |
| ldraw_id | TEXT | |
| year_introduced | INTEGER | |
| **custom only** | | |
| source | TEXT | `3d_printed`, `modified_official`, `scratch_built`, `other` |
| creator | TEXT | |
| width_plates, depth_plates, height_plates | REAL | dimensions in stud/plate units |
| stud_pattern | TEXT | |
| material | TEXT | `PLA`, `PETG`, `resin`, `other` |
| print_profile_notes | TEXT | |
| version | INTEGER | starts at 1 |
| version_group_id | TEXT | same for all versions of one custom part |
| is_current | INTEGER | 1 = newest version |
| parent_part_id | TEXT | FK parts.id (variant of an official part) |

**Rules (CHECK / Zod):**
- `official` rows need `design_id`; custom-only columns must be NULL.
- `custom` rows need `source`, `version >= 1`; official-only columns must be NULL.

**Indexes:** `(kind)`, `(category)`, `(color_id)`, `(location_id)`, `(design_id, color_id)`, `(quantity)`, `(created_at)`, `(version_group_id)`, `(deleted_at, is_current)`.

**Duplicate detection:** non-unique index on `(design_id, color_id)` for official rows; query finds groups with more than one live row.

## parts_search (FTS5, virtual table)

Searchable text per part: name, design_id, color name, category, subcategory, tag names, notes, location path. Kept in sync by the service layer (and rebuilt by `npm run migrate`/`seed` when needed).

## colors

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Rebrickable ids kept as is; custom colors get ids >= 100000 |
| name | TEXT NOT NULL | |
| rgb | TEXT NOT NULL | 6 hex chars, no `#` |
| is_transparent | INTEGER NOT NULL | 0/1 |
| is_metallic | INTEGER NOT NULL | 0/1 |
| is_custom | INTEGER NOT NULL DEFAULT 0 | 1 = user-made |

Seeded from Rebrickable `colors.csv` (columns: `id, name, rgb, is_trans, ...`). Metallic = name contains "Metallic" or "Chrome" or "Pearl Gold"-style entries, as Rebrickable has no metallic column; the rule lives in one function and is unit tested. **Double-check this rule when we reach step 3.**

## locations (tree, unlimited depth)

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| parent_id | TEXT | FK locations.id, NULL = top level |
| name | TEXT NOT NULL | "Garage", "Cabinet A", "Drawer 3", "Bin 12" |
| level_label | TEXT | Room / Cabinet / Drawer / Bin (just a label, depth is free) |
| label | TEXT | printed bin label |
| color_code | TEXT | hex, for the bin color |
| created_at, updated_at | TEXT | |

Parts point to **one** location by id. Moving a location changes only its `parent_id`, so everything inside moves with it and no part rows are touched. Moving a location into its own child is refused (cycle check).

QR codes are made on demand (`GET /api/locations/:id/qr`) and point to `/locations/:id`. Nothing is stored.

## tags and part_tags

- `tags(id TEXT PK, name TEXT UNIQUE NOCASE)`
- `part_tags(part_id, tag_id)` with composite PK and index on `tag_id`.

## part_photos

`id, part_id, file_path, thumb_path, width, height, sort_order, created_at`. Max 10 per part (enforced in the service and tested). Files live in `data/photos/`, resized to 1024px wide, plus a 256px thumbnail. Photos belong to a version row; a new version copies the references (files are not duplicated).

## smart_views

`id, name, filter_json, is_builtin, sort_order`. Built in: **Low stock** (quantity <= 5, threshold editable), **Custom parts** (`custom:true`), **Needs sorting** (tag `needs-sorting` or no subcategory), **Missing location** (no location). Users can save their own.

## history (undo/redo)

`id INTEGER PK AUTOINCREMENT, label, forward_json, inverse_json, undone INTEGER, created_at`. Newest 100 kept.

## imports

| Table | Columns |
|---|---|
| `imports` | id, source_name, format (`csv`, `rebrickable`), mapping_json, row_count, created_count, updated_count, status (`done`, `rolled_back`), created_at |
| `import_rows` | id, import_id, part_id, action (`created`, `updated`), before_json (NULL for created) |

Rollback: delete parts with action `created` (soft delete), restore `before_json` for `updated`. Marks the import `rolled_back`. Cannot be rolled back twice.

## schema_migrations

`version INTEGER PK, name, applied_at`. Files are in `server/migrations/NNN_name.ts`, each exporting `up(db)` and `down(db)`. A DB backup copy is made before each run.

## Enums and types (in /shared)

Category list, source list, material list, and every Zod schema (`partSchema` as a discriminated union on `kind`, `colorSchema`, `locationSchema`, `tagSchema`, `searchQuerySchema`, `importMappingSchema`, `smartViewSchema`) live in `/shared` and are imported by both app and server.

## Custom part JSON export format

```json
{
  "format": "lego-library-custom-part",
  "formatVersion": 1,
  "part": { "name": "...", "version": 2, "source": "3d_printed", "...": "..." },
  "color": { "name": "...", "rgb": "FF0000" },
  "versions": [ { "version": 1, "...": "..." } ]
}
```

Photos are not embedded (keeps files small); they are listed by file name only. Import validates with Zod and creates a new part (never overwrites).
