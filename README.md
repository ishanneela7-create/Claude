# Brick Library

A local-first app to catalog every LEGO part you own (official **and** your own custom parts), store them in bins and boxes, and find anything fast. Everything lives in one file on your computer.

> This is a fan project. It is not made or endorsed by the LEGO Group. It contains no LEGO images or artwork: parts without a photo show a simple drawn brick in the part's color.

## Set up (about 5 minutes)

You need **Node.js 20 or newer** (22 is what it was built with) and npm. No other tools.

```bash
git clone <this repository>
cd <the folder>
npm install          # downloads the packages (a minute or two)
npm run dev          # starts the app with sample data
```

Open **http://localhost:5173**. That's it. The first start creates `data/library.db`, adds a small sample library (about 70 parts, 6 bins, 5 custom parts, one deliberate duplicate), and tries to download the full Rebrickable color list in the background. If you are offline it uses a small starter list; run `npm run seed` later when you are online.

To start with an **empty** library (no sample parts), run `NO_SAMPLE=1 npm run dev` (on Windows PowerShell: `$env:NO_SAMPLE=1; npm run dev`) the very first time.

### Start fresh

Stop the app, move the `data` folder somewhere safe (or delete it), then start again with `NO_SAMPLE=1 npm run dev`. Then add parts by hand or import your own (see `docs/import-guide.md`).

### Run it like a normal app (no dev tools)

```bash
npm run build        # builds the web app into /dist
npm start            # serves the app AND the API on http://localhost:3001
```

## Using it

| I want to… | Do this |
|---|---|
| Find a part | Press `/`, type. Try `color:red`, `cat:plates`, `loc:"Drawer 3"`, `qty:>5`, `custom:true`, `tag:rare`. Words can be mixed with operators. A small typo is fixed for you |
| Add a part | Press `n` (official) or use **New > Custom part** |
| Edit a part | Click it, press `e` |
| Organize | Sort, group (collapsible), switch table/grid, set density (compact, normal, comfortable) |
| Smart views | Sidebar: Low stock, Custom parts, Needs sorting, Missing location. Any search or filter can be saved with "Save as smart view" |
| Bins and boxes | Sidebar **Locations > Manage**: add rooms, cabinets, drawers, bins; move them (the parts go with them); print a QR code for a bin |
| Change many at once | Tick parts, **Edit selected…** (location, quantity, tags). "Select everything that matches" picks all results |
| Duplicates | **More > Find duplicates** (same design id + color) and merge |
| Undo | `Ctrl/Cmd + Z`, redo `Ctrl/Cmd + Shift + Z` (last 100 actions, kept after restart) |
| Custom part builder | **New > Custom part**: name, size, stud pattern, material, up to 10 photos, optional STL/OBJ preview that fills in the size. Editing the design makes a new version; old versions stay viewable |
| Share a custom part | Open it > **Export** (JSON). Others use **More > Import custom part file…** |
| Import / export | **More** menu. CSV with a column mapper (20 row preview), Rebrickable exports, every import can be rolled back. Export CSV, JSON, or SQLite |
| Dark mode | The sun/moon button (follows your system until you choose) |
| All shortcuts | Press `?` |

## Backup guide

Your whole library is in the **`data` folder**:

- `data/library.db` (all your parts, bins, history)
- `data/photos/` (your photos)
- `data/backups/` (copies made automatically before any database change, and SQLite backups you download)

**Easy backup:** stop the app, copy the whole `data` folder somewhere safe (cloud drive, USB stick). **To restore,** put it back (with the app stopped).

**While the app is running:** use **More > Download SQLite backup** (a safe copy of `library.db`) and also copy `data/photos`. Command line: `npm run export -- sqlite my-backup.db`.

Also useful: **More > Export CSV** gives you a file that opens in a spreadsheet, as a human-readable backup of your parts list.

Do not copy `library.db` alone while the app is running: it also has `library.db-wal` and `library.db-shm` files next to it, and a copy without them can be missing recent changes.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | App + API with live reload (ports 5173 and 3001) |
| `npm test` | Unit + API tests (fast) |
| `npm run test:coverage` | Same, with a coverage report |
| `npm run test:e2e` | Browser tests with Playwright (builds the app, starts its own server on port 4173) |
| `npm run lint` | ESLint + TypeScript |
| `npm run build` / `npm start` | Production build / run it |
| `npm run seed` | Download Rebrickable colors (`-- --file=colors.csv.gz` to use a file, `-- --sample` to add the sample parts to an empty library) |
| `npm run migrate` / `migrate:down` | Run / undo database migrations (a backup copy is saved first) |
| `npm run import -- file.csv` / `npm run export -- csv` | Command line import / export |
| `npm run perf` | 50,000 part speed test |

Environment variables: `PORT` (API port, default 3001), `DATA_DIR` (where data lives, default `data`), `NO_SAMPLE=1` (do not add sample parts to a brand new library), `SKIP_COLOR_DOWNLOAD=1` (never try the Rebrickable download).

## More documentation

- `docs/architecture.md`: how it is built and why
- `docs/data-model.md`: every table and field
- `docs/import-guide.md`: import and export in detail

## Test and speed results

Last run (Node 22, a small cloud machine; your numbers will differ a bit):

| Check | Result |
|---|---|
| `npm test` (unit + API tests) | 181 passed, 0 failed |
| `npm run test:e2e` (real browser) | 19 passed, 0 failed |
| Coverage, `server/` | 94.8% of statements, 87.6% of branches |
| Coverage, `shared/` | 100% |
| `npm run lint` (ESLint, strict TypeScript, no `any`, 300-line limit) | clean |

### 50,000 parts (`npm run perf`)

50,000 generated parts (about 73 MB database), measured over real HTTP including JSON, 30 runs each. Goal: search under 100 ms.

| Test | median ms | p95 ms | results |
|---|---:|---:|---:|
| Search: `brick` | 19.9 | 26.3 | 15,844 |
| Search: `brick 2 x 4` | 38.8 | 48.8 | 10,594 |
| Search: design id | 2.1 | 4.0 | 24 |
| Search: words in notes | 13.3 | 18.5 | 4,424 |
| Search: `Drawer 3` (matches almost every part) | 36.3 | 42.9 | 36,313 |
| Search: `color:red cat:plates` | 34.4 | 46.2 | 287 |
| Search: `qty:>150 custom:true` | 7.0 | 10.6 | 602 |
| Search: `loc:"Room 2 > Cabinet 3"` | 7.7 | 10.4 | 2,316 |
| Search: typo `brik` (auto-fixed to `brick`) | 18.0 | 19.6 | 15,844 |
| List: first page | 13.4 | 22.3 | 50,000 |
| List: deep page (row 40,000) | 16.1 | 22.0 | 50,000 |
| List: sorted by color | 11.6 | 15.2 | 50,000 |
| List: sorted by location | 56.6 | 74.8 | 50,000 |
| List: grouped by category | 13.6 | 16.8 | 50,000 |
| Smart view: low stock | 8.8 | 11.6 | 1,549 |
| Duplicate scan | 26.7 | 30.2 | 0 |

**Slowest search p95: 48.8 ms, so the 100 ms goal is met.** In a real browser with the 50,000 part database: the first screen is ready in about 0.3 s, only about 25 to 35 rows exist on the page at any time, jumping to 80% down the list draws in under 0.1 s, and a typed search is on screen in about 0.25 s (0.15 s of that is the wait after you stop typing).

The test data is synthetic: real libraries have fewer broad matches, so everyday searches should be faster. How it was made fast is explained in `docs/architecture.md`.
