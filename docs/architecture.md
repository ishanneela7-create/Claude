# Architecture

A local-first LEGO part library. One person, one machine, one SQLite file. Nothing leaves your computer unless you export it (the only network call is the optional Rebrickable colors download).

## Folder layout

```
/app       React + Vite + Tailwind frontend
/server    Express API + SQLite (better-sqlite3)
  migrations/   numbered up/down schema steps
  routes/       one file per area (parts, lookups, locations, data)
  services/     all the logic (queries, writes, import, export, photos, history...)
/shared    Types, Zod schemas, constants, search parser, CSV reader (used by app AND server)
/scripts   seed, migrate, import, export, perf
/tests     unit, integration (API), e2e (browser)
/docs      architecture.md, data-model.md, import-guide.md
/data      (git-ignored) library.db, photos/, backups/
```

Every file is under 300 lines (ESLint enforces this). No `any` (ESLint enforces this too).

## How the pieces talk

```
Browser (React)  --HTTP JSON-->  Express API  --SQL-->  SQLite file (WAL mode)
  Zustand: UI state + lookups      Zod checks every route    FTS5 search index
  pages of parts on demand         services do the work      photos saved as files in /data/photos
```

- **Shared Zod schemas** are the single source of truth. The form, the API and the importer all use them.
- **The server owns the data.** The browser asks for pages of 100 parts and never loads all 50,000.
- **Zustand** holds UI state (view, density, filters, selection, open panel) and small lookup lists (colors, locations, tags, smart views). The part list itself is fetched per page.

## Dependencies

You approved the stack list. Extras I added, and why (you chose "no preference", so I used the recommended answer):

| Package | Why |
|---|---|
| `sharp` | Resize photos to 1024px wide and make thumbnails |
| `multer` | Express cannot read file uploads by itself |
| `qrcode` | Make the printable bin QR codes |
| `@tanstack/react-virtual` | Draw only the visible rows (needed for 50,000+ parts) |
| `supertest` | Test every API route |
| `@hookform/resolvers` | Connect Zod to React Hook Form |
| `tsx`, `concurrently` | Run TypeScript on the server; one `npm run dev` for both processes |
| `@vitest/coverage-v8` | Coverage numbers |
| `postcss`, `autoprefixer` | Required by Tailwind |
| `@types/*` | TypeScript types |

Pinned on purpose: **TanStack Table v8** (v9 has a very different, newer API) and **Tailwind v3**.

No other packages: the CSV reader, markdown reader, and search-operator parser are small files in the repo.

## Search (how it stays under 100 ms at 50,000 parts)

1. The search text is parsed into plain words and operators (`color:`, `cat:`, `loc:`, `qty:`, `custom:`, `tag:`) in `shared/searchQuery.ts`.
2. Plain words become an **SQLite FTS5** query where every word matches as a prefix (so results appear as you type). The index holds name, design id, color, category, subcategory, tags, notes, location path, kind, source and creator.
3. Operators become normal indexed `WHERE` clauses.
4. Lists walk a **partial index** (only live, current parts) in sort order and stop after one page. The server first finds the 100 ids, then loads only those rows (so deep pages stay fast).
5. The result count comes from the FTS index itself when only words were typed.
6. **Typos:** if a word matches nothing, **Fuse.js** compares it with the words that really exist in the library (read from the FTS vocabulary) and swaps in the closest one ("brik" becomes "brick"). The screen says what it did.
7. The browser waits 150 ms after typing stops, then asks the server.

Measured numbers are in the README.

## Virtual lists

`LibraryView` turns "N parts, maybe in groups" into screen lines (`app/lib/lines.ts`) and `@tanstack/react-virtual` draws only the lines on screen (about 25 DOM rows for 50,000 parts). Row numbers are positions in the full server result, so scrolling to row 40,000 fetches just that page. Collapsing a group removes its lines but keeps row numbers correct. Table and grid share this code. Images use `loading="lazy"`.

## Undo / redo

- Every write to user data goes through `ActionRecorder` (`server/recorder.ts`). It saves the before and after version of each changed row (and each part's tag list).
- Undo puts the "before" back (in reverse order); redo puts the "after" back. A new edit clears the redo side.
- Only the newest **100** actions are kept. Bulk edits, merges, and "new custom version" are one action each.
- History is saved in the database, so it survives a restart.
- Imports have their own, larger rollback log (see import-guide.md) and are not in the undo list.
- After undo/redo the search index is refreshed for every touched part.

## Never delete user data

- Deleting a part is a **soft delete** (`deleted_at`). The row stays in the database, so undo works.
- A location with children or parts cannot be deleted unless you choose where its contents go.
- Official colors cannot be changed; custom colors cannot be deleted while a part uses them.
- Photos: removing one only removes it from the part. The file stays in `data/photos`.
- Migrations are numbered `up` + `down` pairs run in a transaction. A copy of the database is saved to `data/backups/` before any change to an existing database.
- Import rollback hides the parts the import created and takes back the quantity it added. It does not touch anything else.

## Custom part versions

- Design fields (name, category, subcategory, color, source, creator, size, stud pattern, material, print notes, parent) are **revisions**. Changing any of them makes a new row (version + 1); the old row stays, read only, with `is_current = 0`.
- Inventory fields (quantity, location, notes, tags) change in place and never make a version.
- Photos and tags are copied to the new version.
- Saving a form with nothing changed does nothing (no version, no history entry).

## Frontend layout

```
+----------+-----------------------------+----------------+
| Sidebar  |  Toolbar: search | view |    |  Detail panel  |
| views    |  sort | group | density      |  details       |
| locations+-----------------------------+  photos         |
| categories  Table or grid (virtual)     |  edit form      |
| tags     |  collapsible groups          |  versions       |
+----------+-----------------------------+----------------+
```

- Phone (375 px): the sidebar is a slide-in menu; the detail panel covers the screen.
- Theme: follows the system until you pick light or dark. Colors are CSS variables (blue + green scheme) in `app/index.css`.
- Shortcuts: `/` search, `n` new, `e` edit, `Esc` close, `?` help, `Ctrl/Cmd + Z` undo, `Ctrl/Cmd + Shift + Z` redo.
- Accessibility: visible focus rings, labelled fields with linked error text, swatches have screen-reader text ("Color: Red"), skip link, tables use ARIA grid roles, dialogs trap focus, reduced-motion respected. A unit test checks WCAG AA contrast (4.5:1) for every color pair in both themes.

## 3D preview

Lazy-loaded: three.js is only downloaded the first time you pick an STL or OBJ. The bounding box is measured without needing graphics hardware (1 stud = 8 mm, 1 plate = 3.2 mm tall; the model's Z axis is treated as height), then fills the dimension boxes. You can still edit the numbers.

## Tooling

- TypeScript strict (`noUncheckedIndexedAccess` too), ESLint (`no-explicit-any`, 300-line limit), Prettier.
- `npm test`: Vitest unit + API integration tests (a real temporary SQLite database per test).
- `npm run test:e2e`: Playwright browser tests (builds the app and starts its own server on port 4173).
- `npm run test:coverage`: coverage report.
- `npm run perf`: 50,000 part speed test.
