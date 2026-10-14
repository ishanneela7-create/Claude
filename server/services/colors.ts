import type { Database } from 'better-sqlite3';
import { CUSTOM_COLOR_ID_START } from '@shared/constants';
import type { ColorInput } from '@shared/otherSchemas';
import type { ColorRecord } from '@shared/types';
import { conflict, notFound } from '../http';
import { ActionRecorder } from '../recorder';
import { reindexParts } from './searchIndex';

interface ColorRow {
  id: number;
  name: string;
  rgb: string;
  is_transparent: number;
  is_metallic: number;
  is_custom: number;
}

function toRecord(row: ColorRow): ColorRecord {
  return {
    id: row.id,
    name: row.name,
    rgb: row.rgb,
    is_transparent: row.is_transparent === 1,
    is_metallic: row.is_metallic === 1,
    is_custom: row.is_custom === 1,
  };
}

export function listColors(db: Database): ColorRecord[] {
  const rows = db.prepare('SELECT * FROM colors ORDER BY name COLLATE NOCASE').all() as ColorRow[];
  return rows.map(toRecord);
}

export function getColor(db: Database, id: number): ColorRecord {
  const row = db.prepare('SELECT * FROM colors WHERE id = ?').get(id) as ColorRow | undefined;
  if (!row) throw notFound('Color');
  return toRecord(row);
}

export function findColorByName(db: Database, name: string): ColorRecord | null {
  const row = db.prepare('SELECT * FROM colors WHERE name = ? COLLATE NOCASE').get(name) as
    | ColorRow
    | undefined;
  return row ? toRecord(row) : null;
}

export function createCustomColor(db: Database, input: ColorInput): ColorRecord {
  if (findColorByName(db, input.name)) throw conflict('A color with this name already exists');
  const recorder = new ActionRecorder(db);
  const next = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS next FROM colors WHERE is_custom = 1').get() as {
    next: number;
  };
  const id = Math.max(CUSTOM_COLOR_ID_START, next.next);
  db.transaction(() => {
    recorder.insert('colors', {
      id,
      name: input.name,
      rgb: input.rgb,
      is_transparent: input.is_transparent ? 1 : 0,
      is_metallic: input.is_metallic ? 1 : 0,
      is_custom: 1,
    });
    recorder.commit(`Add color ${input.name}`);
  })();
  return getColor(db, id);
}

function requireCustom(db: Database, id: number): ColorRecord {
  const color = getColor(db, id);
  if (!color.is_custom) throw conflict('Official colors cannot be changed');
  return color;
}

export function updateCustomColor(db: Database, id: number, patch: Partial<ColorInput>): ColorRecord {
  requireCustom(db, id);
  const recorder = new ActionRecorder(db);
  db.transaction(() => {
    recorder.update('colors', id, {
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.rgb !== undefined && { rgb: patch.rgb }),
      ...(patch.is_transparent !== undefined && { is_transparent: patch.is_transparent ? 1 : 0 }),
      ...(patch.is_metallic !== undefined && { is_metallic: patch.is_metallic ? 1 : 0 }),
    });
    const used = db.prepare('SELECT id FROM parts WHERE color_id = ?').all(id) as { id: string }[];
    reindexParts(
      db,
      used.map((row) => row.id),
    );
    recorder.commit('Edit color');
  })();
  return getColor(db, id);
}

export function deleteCustomColor(db: Database, id: number): void {
  const color = requireCustom(db, id);
  const used = db.prepare('SELECT COUNT(*) AS n FROM parts WHERE color_id = ?').get(id) as {
    n: number;
  };
  if (used.n > 0) throw conflict('This color is used by parts, so it cannot be deleted');
  const recorder = new ActionRecorder(db);
  db.transaction(() => {
    recorder.remove('colors', id);
    recorder.commit(`Delete color ${color.name}`);
  })();
}
