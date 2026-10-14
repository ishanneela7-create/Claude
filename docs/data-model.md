# Data model

SQLite, one file: `data/library.db`. Foreign keys ON, WAL mode ON. IDs are UUID text (`crypto.randomUUID()`), except colors (numbers). Times are ISO-8601 text in UTC.

Schema lives in `server/migrations/` (001 to 004). Every migration has an `up` and a `down`.

## parts (one table for both kinds)

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| kind | TEXT NOT NULL | `official` or `custom` |
| name | TEXT NOT NULL | |
| category | TEXT NOT NULL | Bricks, Plates, Tiles, Slopes, Technic, Wheels, Minifig Parts, Specialty |
| subcategory | TEXT | optional free text |
| color_id | INTEGER NOT NULL | FK colors.id |
| quantity | INTEGER NOT NULL DEFAULT 0 | CHECK >= 0 |
| location_id | TEXT | FK locations.id; NULL = "Missing location" |
| notes | TEXT | markdown |
| image_path | TEXT | URL of the main photo thumbnail (set from the first photo) |
| created_at, updated_at | TEXT NOT NULL | |
| deleted_at | TEXT | soft delete (row stays, hidden) |
| **official only** | | |
| design_id | TEXT | text, because some are like `3068b` |
| rebrickable_part_num | TEXT | optional |
| ldraw_id | TEXT | optional |
| year_introduced | INTEGER | optional, 1949 to 2100 |
| **custom only** | | |
| source | TEXT | `3d_printed`, `modified_official`, `scratch_built`, `other` |
| creator | TEXT | optional |
| width_plates, depth_plates, height_plates | REAL | width/depth in studs, height in plates |
| stud_pattern | TEXT | |
| material | TEXT | `PLA`, `PETG`, `resin`, `other` (optional) |
| print_profile_notes | TEXT | |
| version | INTEGER | starts at 1 |
| version_group_id | TEXT | the same for every version of one custom part (= id of version 1) |
| is_current | INTEGER NOT NULL DEFAULT 1 | 1 = newest version (old versions are 0) |
| parent_part_id | TEXT | FK parts.id, optional: the official part this is a variant of |

**Database rules (CHECK):** `kind` is official/custom; official needs `design_id`; custom needs `source` and `version >= 1`; `quantity >= 0`; `source` is one of the four values. The API also checks everything with Zod before it gets here.

**Indexes:** partial indexes on live, current parts for name, created, quantity, category, kind, location and color (these make sorted lists and deep pages fast), plus `(design_id, color_id)` for duplicate checks, and `version_group_id`.

## parts_search (FTS5) and parts_search_vocab

`parts_search(part_id UNINDEXED, body)` has one row per live, current part. Its rowid equals the part's rowid (so joins are direct). `body` holds name, design id, Rebrickable number, LDraw id, kind, source, creator, color name, category, subcategory, tags, notes and location path. It is kept up to date by the services after every change and rebuilt on startup if the counts disagree (`ensureSearchIndex`). It is derived data, so rebuilding never loses anything. `parts_search_vocab` (fts5vocab) lists the words in the index and is used for typo fixing.

## colors

| Column | Notes |
|---|---|
| id INTEGER PK | Rebrickable ids kept as they are; custom colors get ids from 100000 up |
| name, rgb | rgb is 6 hex characters, no `#` |
| is_transparent, is_metallic | 0 or 1 |
| is_custom | 1 = made by you |

Seeded from Rebrickable's `colors.csv` (`npm run seed`, or automatically in the background on first start). If the download is not possible, a small built-in starter list of 24 colors is used. Rebrickable has no metallic column, so **metallic is guessed from the name** (`metallic`, `chrome` or `pearl`): please double-check this against your own parts. Official colors are read-only; seeding never touches custom colors.

## locations (tree, any depth)

| Column | Notes |
|---|---|
| id, parent_id | parent NULL = top level |
| name | "Playroom", "Cabinet A", "Drawer 3", "Bin 12" |
| level_label | Room / Cabinet / Drawer / Bin (just a label; depth is free) |
| label | printed bin label |
| color_code | 6 hex characters |
| path | text path, e.g. `Playroom > Cabinet A > Drawer 3` (kept up to date) |
| id_path | e.g. `/id1/id2/id3/` (used to find everything under a location) |

A part points to exactly one location by id. **Moving a location only changes its `parent_id`** (and the stored paths), so every part inside moves with it and no part row changes. Moving into your own child is refused. QR codes are made on request (`GET /api/locations/:id/qr`) and open the app at `/?location=<id>`. Nothing is stored.

## tags, part_tags

`tags(id, name UNIQUE NOCASE)` and `part_tags(part_id, tag_id)` (composite primary key, index on tag_id).

## part_photos

`id, part_id, file_path, thumb_path, width, height, sort_order, created_at`. At most 10 per part. Files are in `data/photos/` as WebP: 1024px wide at most (never enlarged) plus a 256px thumbnail. A new custom version gets its own rows pointing at the same files.

## smart_views

`id, name, filter_json, is_builtin, sort_order`. Built in: **Low stock** (quantity <= 5), **Custom parts**, **Needs sorting** (tagged `needs sorting` or `needs-sorting`), **Missing location**. You can save your own from any search or filter.

## history (undo / redo)

`id, label, changes_json, undone, created_at`. `changes_json` lists each changed row with its `before` and `after` (and each part's tag list). Newest 100 kept.

## imports, import_rows

| Table | Columns |
|---|---|
| `imports` | id, source_name, format (`csv`, `rebrickable`), mapping_json, row_count, created_count, updated_count, status (`done`, `rolled_back`), created_at |
| `import_rows` | id, import_id, part_id, action (`created`, `updated`), before_json (`{"quantity_added": n}` for updates) |

## schema_migrations

`version, name, applied_at`.

## Custom part JSON file

```json
{
  "format": "lego-library-custom-part",
  "formatVersion": 1,
  "part": { "name": "...", "version": 2, "source": "3d_printed", "width_plates": 4, "...": "..." },
  "color": { "name": "Blue", "rgb": "0055BF" },
  "versions": [ { "version": 2, "...": "..." }, { "version": 1, "...": "..." } ]
}
```

Left out because they only make sense on one computer: id, location, parent part, photo. Importing always makes a **new** part (version 1) and never overwrites anything. The color is matched by name, or created as a custom color.
