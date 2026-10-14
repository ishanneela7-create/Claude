import type { Database } from 'better-sqlite3';
import { parseCsv } from '@shared/csv';
import { guessMapping, looksLikeRebrickable, rebrickableMapping } from '@shared/importMapping';
import type { ImportMapping, ImportRunRequest } from '@shared/importSchemas';
import type { ImportRecord } from '@shared/types';
import { badRequest, conflict, notFound } from '../http';
import { ActionRecorder } from '../recorder';
import { loadColorCache, normalizeRow, type NormalizedRow } from './importNormalize';
import { reindexParts } from './searchIndex';
import { insertPart, nowIso } from './partWrites';

const PREVIEW_ROWS = 20;
const MAX_REPORTED_ERRORS = 100;

export interface ImportPreview {
  headers: string[];
  mapping: ImportMapping;
  total_rows: number;
  valid_rows: number;
  sample: Array<{ cells: string[]; error: string | null; result: string | null }>;
  errors: Array<{ row: number; message: string }>;
}

export interface ImportResult {
  import: ImportRecord;
  errors: Array<{ row: number; message: string }>;
}

function readTable(request: Pick<ImportRunRequest, 'format' | 'text' | 'mapping'>) {
  const [headers, ...rows] = parseCsv(request.text);
  if (!headers || headers.length === 0) throw badRequest('The file has no header row');
  const rebrickable = request.format === 'rebrickable';
  if (rebrickable && !looksLikeRebrickable(headers)) {
    throw badRequest('This does not look like a Rebrickable export (need Part, Color, Quantity)');
  }
  const mapping =
    request.mapping ?? (rebrickable ? rebrickableMapping(headers) : guessMapping(headers));
  return { headers, rows, mapping, rebrickable };
}

function assertMappingUsable(mapping: ImportMapping, rebrickable: boolean): void {
  const fields = new Set(Object.values(mapping));
  if (!fields.has('color')) throw badRequest('Map one column to "color"');
  if (!rebrickable && !fields.has('name')) throw badRequest('Map one column to "name"');
  if (!fields.has('design_id') && !fields.has('kind')) {
    throw badRequest('Map one column to "design_id" (or mark rows with a "kind" column)');
  }
}

export function previewImport(
  db: Database,
  request: Pick<ImportRunRequest, 'format' | 'text' | 'mapping'>,
): ImportPreview {
  const { headers, rows, mapping, rebrickable } = readTable(request);
  const cache = loadColorCache(db);
  const errors: ImportPreview['errors'] = [];
  const sample: ImportPreview['sample'] = [];
  let valid = 0;
  rows.forEach((cells, index) => {
    const result = normalizeRow(headers, cells, mapping, cache, rebrickable);
    if (result.ok) valid += 1;
    else if (errors.length < MAX_REPORTED_ERRORS) errors.push({ row: index + 2, message: result.error });
    if (index < PREVIEW_ROWS) {
      sample.push({
        cells,
        error: result.ok ? null : result.error,
        result: result.ok ? `${result.row.input.name} x${result.row.input.quantity}` : null,
      });
    }
  });
  return { headers, mapping, total_rows: rows.length, valid_rows: valid, sample, errors };
}

export function ensureLocationPath(
  recorder: ActionRecorder,
  text: string,
  cache: Map<string, string>,
): string {
  const names = text.split(/\s*>\s*/).map((name) => name.trim()).filter(Boolean);
  let parentId: string | null = null;
  let parentPath = '';
  let parentIdPath = '/';
  let result = '';
  for (const name of names) {
    const path = parentPath ? `${parentPath} > ${name}` : name;
    const key = path.toLowerCase();
    let id = cache.get(key);
    if (!id) {
      const found = recorder.db
        .prepare('SELECT id FROM locations WHERE path = ? COLLATE NOCASE')
        .get(path) as { id: string } | undefined;
      id = found?.id ?? crypto.randomUUID();
      if (!found) {
        recorder.insert('locations', {
          id,
          parent_id: parentId,
          name,
          level_label: null,
          label: null,
          color_code: null,
          path,
          id_path: `${parentIdPath}${id}/`,
          created_at: nowIso(),
          updated_at: nowIso(),
        });
      }
      cache.set(key, id);
    }
    parentId = id;
    parentPath = path;
    parentIdPath = `${parentIdPath}${id}/`;
    result = id;
  }
  return result;
}

export function runImport(db: Database, request: ImportRunRequest): ImportResult {
  const { headers, rows, mapping, rebrickable } = readTable(request);
  assertMappingUsable(mapping, rebrickable);
  const cache = loadColorCache(db);
  const locationCache = new Map<string, string>();
  const recorder = new ActionRecorder(db, false);
  const importId = crypto.randomUUID();
  const errors: ImportResult['errors'] = [];
  let created = 0;
  let updated = 0;

  const findExisting = db.prepare(
    `SELECT id FROM parts WHERE kind = 'official' AND design_id = ? AND color_id = ?
     AND deleted_at IS NULL AND is_current = 1 LIMIT 1`,
  );
  const logRow = db.prepare(
    'INSERT INTO import_rows (import_id, part_id, action, before_json) VALUES (?, ?, ?, ?)',
  );

  db.transaction(() => {
    db.prepare(
      `INSERT INTO imports (id, source_name, format, mapping_json, row_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(importId, request.source_name, request.format, JSON.stringify(mapping), rows.length, nowIso());

    rows.forEach((cells, index) => {
      const result = normalizeRow(headers, cells, mapping, cache, rebrickable);
      if (!result.ok) {
        if (errors.length < MAX_REPORTED_ERRORS) errors.push({ row: index + 2, message: result.error });
        return;
      }
      const { input, locationPath }: NormalizedRow = result.row;
      if (locationPath) input.location_id = ensureLocationPath(recorder, locationPath, locationCache);

      const existing =
        input.kind === 'official'
          ? (findExisting.get(input.design_id, input.color_id) as { id: string } | undefined)
          : undefined;
      if (existing) {
        const row = db.prepare('SELECT quantity FROM parts WHERE id = ?').get(existing.id) as {
          quantity: number;
        };
        recorder.update('parts', existing.id, {
          quantity: row.quantity + input.quantity,
          updated_at: nowIso(),
        });
        logRow.run(importId, existing.id, 'updated', JSON.stringify({ quantity_added: input.quantity }));
        updated += 1;
      } else {
        const id = insertPart(recorder, input);
        logRow.run(importId, id, 'created', null);
        created += 1;
      }
    });

    db.prepare('UPDATE imports SET created_count = ?, updated_count = ? WHERE id = ?').run(
      created,
      updated,
      importId,
    );
    reindexParts(db, recorder.touchedPartIds);
  })();
  return { import: getImport(db, importId), errors };
}

interface ImportRow extends Omit<ImportRecord, never> {
  mapping_json?: string | null;
}

export function getImport(db: Database, id: string): ImportRecord {
  const row = db.prepare('SELECT * FROM imports WHERE id = ?').get(id) as ImportRow | undefined;
  if (!row) throw notFound('Import');
  const { mapping_json: _mapping, ...record } = row;
  void _mapping;
  return record;
}

export function listImports(db: Database): ImportRecord[] {
  const rows = db.prepare('SELECT id FROM imports ORDER BY created_at DESC').all() as { id: string }[];
  return rows.map((row) => getImport(db, row.id));
}

/** Hides parts the import created and takes back the quantity it added. Nothing else is touched. */
export function rollbackImport(db: Database, id: string): ImportRecord {
  const record = getImport(db, id);
  if (record.status === 'rolled_back') throw conflict('This import was already rolled back');
  const rows = db
    .prepare('SELECT part_id, action, before_json FROM import_rows WHERE import_id = ? ORDER BY id DESC')
    .all(id) as Array<{ part_id: string; action: string; before_json: string | null }>;
  const recorder = new ActionRecorder(db, false);
  db.transaction(() => {
    for (const row of rows) {
      if (row.action === 'created') {
        recorder.update('parts', row.part_id, { deleted_at: nowIso() });
      } else {
        const added = (JSON.parse(row.before_json ?? '{}') as { quantity_added?: number })
          .quantity_added ?? 0;
        const current = db.prepare('SELECT quantity FROM parts WHERE id = ?').get(row.part_id) as {
          quantity: number;
        };
        recorder.update('parts', row.part_id, {
          quantity: Math.max(0, current.quantity - added),
          updated_at: nowIso(),
        });
      }
    }
    reindexParts(db, recorder.touchedPartIds);
    db.prepare("UPDATE imports SET status = 'rolled_back' WHERE id = ?").run(id);
  })();
  return getImport(db, id);
}
