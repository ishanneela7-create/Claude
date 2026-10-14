# Architecture

A local-first LEGO part library. One person, one machine, one SQLite file.

## Decisions (from your answers: "no preference", so recommended defaults)

| Topic | Decision |
|---|---|
| Extra dependencies | sharp, multer, qrcode, @tanstack/react-virtual, supertest, @hookform/resolvers (reasons below) |
| Colors seed | Download Rebrickable `colors.csv` at seed time; fall back to a small built-in list if offline |
| Undo/redo | Saved in the database, last 100 actions, survives restart |

## Extra dependencies (not in your stack list)

| Package | Why |
|---|---|
| `sharp` | Resize uploaded photos to 1024px wide |
| `multer` | Express cannot read file uploads by itself |
| `qrcode` | Make the printable bin QR codes |
| `@tanstack/react-virtual` | Only draw visible rows; needed for 50,000+ parts |
| `supertest` | Test every API route (rule: a test per route) |
| `@hookform/resolvers` | Connects Zod to React Hook Form |

Also needed but part of the named stack's normal setup: `tsx` (run TypeScript in Node), `concurrently` (one `npm run dev`), `@vitest/coverage-v8` (coverage numbers), `@types/*`, `postcss`, `autoprefixer`. I will list these again when scaffolding.

## Folder layout

```
/app       React + Vite + Tailwind frontend
/server    Express API + SQLite (better-sqlite3)
/shared    Types, Zod schemas, constants (used by both sides)
/scripts   seed, import, export, migrate, perf
/tests     unit, integration, e2e
/docs      architecture.md, data-model.md, import-guide.md
/data      (git-ignored) library.db + photos/
```

Files stay under 300 lines. Split by feature (e.g. `server/routes/parts.ts`, `server/services/partQueries.ts`).

## How the pieces talk

```
Browser (React)  --HTTP JSON-->  Express API  --SQL-->  SQLite file
   |                                |
   |  Zod schemas from /shared      |  same Zod schemas validate every route
   |  Zustand = UI state only       |  better-sqlite3 (sync, fast)
```

- **Shared Zod schemas** are the single source of truth. Types come from `z.infer`. No `any`.
- **Server owns the data.** The browser asks for pages of parts; it never loads all 50,000.
- **Zustand** holds UI state only (selected part, view mode, density, theme, filters). Server data is fetched per query.

## Search (the 100ms target)

Fuse.js over 50,000 parts in the browser is too slow & heavy. Plan:

1. **Server side:** parse the search text into operators (`color:red`, `cat:plates`, `loc:"Drawer 3"`, `qty:>5`, `custom:true`) and plain words.
2. Operators become indexed SQL `WHERE` clauses.
3. Plain words use SQLite **FTS5** (built into better-sqlite3) over name, design_id, color name, category, tags, notes, location path. Prefix matching gives "as you type".
4. **Fuse.js** is used where it is fast & useful: fuzzy matching on small lists (locations, colors, tags, categories in the sidebar and pickers) and to re-rank the top ~50 FTS results for typo tolerance.
5. Client debounces 150ms. Results are paged (e.g. 100 rows at a time).

If FTS5 plus Fuse re-ranking cannot hit <100ms at 50,000 parts, step 14 will report real numbers & I will say so.

## Virtualization & images

- Table and grid both use `@tanstack/react-virtual`. Only visible rows exist in the DOM.
- Pages are fetched on scroll (infinite loading with a row-count from the server).
- Images use `loading="lazy"`, thumbnails (256px) are created on upload next to the 1024px copy.
- Official parts show a generated placeholder (color swatch + design id). No LEGO images or artwork.

## API shape

REST + JSON under `/api`. Every route validates params, query and body with Zod. Errors return `{ error: { code, message, details? } }`.

| Area | Routes |
|---|---|
| Parts | `GET /parts` (search, filter, sort, group, page), `GET/POST/PATCH/DELETE /parts/:id`, `POST /parts/bulk`, `GET /parts/duplicates`, `POST /parts/merge` |
| Custom versions | `GET /parts/:id/versions`, `POST /parts/:id/versions`, `GET /parts/:id/export` |
| Photos | `POST /parts/:id/photos`, `DELETE /parts/:id/photos/:photoId` |
| Colors | `GET/POST/PATCH/DELETE /colors` |
| Locations | `GET /locations` (tree), `POST/PATCH/DELETE /locations/:id`, `POST /locations/:id/move`, `GET /locations/:id/qr` |
| Tags | `GET/POST/PATCH/DELETE /tags` |
| Smart views | `GET/POST/PATCH/DELETE /views` |
| History | `GET /history`, `POST /history/undo`, `POST /history/redo` |
| Import/Export | `POST /imports/preview`, `POST /imports`, `GET /imports`, `POST /imports/:id/rollback`, `GET /export/csv`, `/export/json`, `/export/sqlite` |

## Undo / redo

- Every write goes through one service that records an **action**: `{ id, label, forward changes, inverse changes, created_at }` in the `history` table.
- Undo applies the inverse; redo applies the forward. A new edit clears the redo side.
- Keep only the newest 100 actions (older rows are pruned).
- Bulk edits and merges are **one** action each.
- Pruning history never touches real data.

## Never delete user data

- Deleting a part is a **soft delete** (`deleted_at`), so undo works and nothing vanishes silently.
- Deleting a location with children or parts is refused unless the user chooses where to move them.
- Migrations are numbered `up` + `down` pairs, run in a transaction, and the DB file is copied to `data/backups/` before any migration runs.
- Import rollback only removes rows created by that import and restores rows it changed.

## Custom part versions

- A custom part has a stable `version_group_id`. Each edit makes a **new row** with `version + 1`; the older row gets `is_current = 0`.
- Lists show only `is_current = 1`. The detail panel lists all versions, each viewable.
- Quantity stays with the current version (moving to a new version carries it over).

## Frontend layout

```
+----------+-----------------------------+----------------+
| Sidebar  |  Toolbar: search | view |    |  Detail panel  |
| locations|  density | undo/redo          |  details       |
| categories+----------------------------+  photos         |
| views    |  Table or grid (virtualized)|  edit form      |
| tags     |  collapsible groups         |  versions       |
+----------+-----------------------------+----------------+
```

- Phone (375px): sidebar becomes a slide-in drawer; detail panel becomes a full-screen sheet.
- Dark/light follows the system by default; a toggle overrides it.
- Shortcuts: `/` search, `n` new, `e` edit, `Esc` close, `?` help sheet.
- Accessibility (WCAG 2.1 AA): visible focus rings, labelled inputs, swatches have screen-reader text (e.g. "Color: Bright Red"), contrast checked in both themes, full keyboard use.

## 3D preview (optional module)

- Lazy-loaded (`import()`), so three.js is not in the main bundle.
- STL/OBJ is read in the browser. Bounding box (mm) converts to studs/plate units (1 stud = 8mm wide; 1 plate = 3.2mm tall) and fills the dimension fields.

## Tooling

- TypeScript strict, `noImplicitAny`, ESLint rule `@typescript-eslint/no-explicit-any` = error.
- Prettier for formatting.
- Vitest: unit (shared, server services) + integration (API via supertest on a temp DB).
- Playwright: end-to-end flows.
- Coverage target: 80%+ on `/server` and `/shared`.
- Scripts: `npm run dev`, `build`, `test`, `lint`, `seed`, `migrate`, `migrate:down`, `perf`.

## Build order

The 15 steps from your spec, in order, each checked before moving on, each with a short summary (changed / passed / next).
