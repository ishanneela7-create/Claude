# Import and export guide

Open **More (list icon) > Import…** in the app, or use the command line (see the end).

## Any CSV

1. Choose "Any CSV" and pick your file. The first row must be column names.
2. The app guesses what each column means from its name. Fix any guess with the drop-downs.
3. Look at the **first 20 rows**. Green means the row is ready; red tells you what is wrong.
4. Press **Import**. Rows with problems are skipped; the rest are added.

### Fields you can map

| Field | Notes |
|---|---|
| name | Required (not needed for Rebrickable files) |
| design_id | Required for official parts |
| color | Required. A color name (any letter case) or a color id |
| quantity | Whole number, default 0 |
| category | One of Bricks, Plates, Tiles, Slopes, Technic, Wheels, Minifig Parts, Specialty. Anything else becomes Specialty |
| subcategory, notes | Free text |
| location | A path like `Playroom > Cabinet A > Drawer 3 > Bin 1`. Missing locations are created |
| tags | Separate with `;` |
| kind | `custom` makes a custom part; anything else is official |
| rebrickable_part_num, ldraw_id, year_introduced | Optional |
| source, creator, material, width_plates, depth_plates, height_plates, stud_pattern | For custom parts (same names as the export, so an export can be imported again) |

### What happens to matching parts

If an **official** row has the same design id and color as a part you already have, the quantity is **added** to the existing part (no duplicate is made). Custom parts are always added as new parts.

## Rebrickable parts export

Choose "Rebrickable parts export". The app reads files with the columns `Part, Color, Quantity` (the parts list export) or `part_num, color_id, quantity` (inventory style). The color column holds Rebrickable color ids, so make sure the colors list has been seeded (`npm run seed`). Rebrickable files have no part names, so each part is named `Part <number>`; rename them later or search by design id. **Please check your own Rebrickable export against these column names, since Rebrickable can change its formats.**

## Every import is logged and can be rolled back

The import window lists past imports. **Roll back** hides the parts that import created and takes back the quantities it added. Nothing else is touched, and an import can be rolled back once. (Locations the import created are kept; they are empty and harmless.) Imports are not part of the Ctrl+Z undo list because they can be very large.

## Export

| What | How |
|---|---|
| CSV | More > Export CSV (columns match the importer, so it can be imported again) |
| JSON | More > Export JSON (parts including old versions, locations, tags, custom colors) |
| SQLite backup | More > Download SQLite backup (a safe copy even while the app is running) |
| One custom part | Open it > Export (a small JSON file you can share) |
| Import a custom part file | More > Import custom part file… (always makes a new part) |

## Command line

```
npm run import -- my-parts.csv                 # guess the columns
npm run import -- rebrickable-parts.csv --rebrickable
npm run export -- csv my-library.csv           # or json / sqlite
npm run seed                                   # download the Rebrickable colors
npm run seed -- --file=colors.csv.gz           # use a file you downloaded
```
