import type { Database } from 'better-sqlite3';
import type { PartInput, PartPatch } from '@shared/partSchemas';
import { badRequest, notFound } from '../http';
import { ActionRecorder, readRow, type Row } from '../recorder';

export const OFFICIAL_ONLY_FIELDS = [
  'design_id',
  'rebrickable_part_num',
  'ldraw_id',
  'year_introduced',
] as const;

export const CUSTOM_ONLY_FIELDS = [
  'source',
  'creator',
  'width_plates',
  'depth_plates',
  'height_plates',
  'stud_pattern',
  'material',
  'print_profile_notes',
  'parent_part_id',
] as const;

/** Changing these on a custom part is a design revision, so it makes a new version. */
export const DESIGN_FIELDS = [
  'name',
  'category',
  'subcategory',
  'color_id',
  ...CUSTOM_ONLY_FIELDS,
] as const;

export function nowIso(): string {
  return new Date().toISOString();
}

export function assertReferences(
  db: Database,
  refs: { color_id?: number; location_id?: string | null; parent_part_id?: string | null },
): void {
  if (refs.color_id !== undefined && !db.prepare('SELECT 1 FROM colors WHERE id = ?').get(refs.color_id)) {
    throw badRequest(`Color ${refs.color_id} does not exist`);
  }
  if (refs.location_id && !db.prepare('SELECT 1 FROM locations WHERE id = ?').get(refs.location_id)) {
    throw badRequest('That location does not exist');
  }
  if (
    refs.parent_part_id &&
    !db
      .prepare("SELECT 1 FROM parts WHERE id = ? AND kind = 'official' AND deleted_at IS NULL")
      .get(refs.parent_part_id)
  ) {
    throw badRequest('The parent part must be an existing official part');
  }
}

/** Inserts a part (no commit, no reindex). Used by create and by import. */
export function insertPart(recorder: ActionRecorder, input: PartInput): string {
  assertReferences(recorder.db, {
    color_id: input.color_id,
    location_id: input.location_id,
    parent_part_id: input.kind === 'custom' ? input.parent_part_id : null,
  });
  const id = crypto.randomUUID();
  const stamp = nowIso();
  const row: Row & { id: string } = {
    id,
    kind: input.kind,
    name: input.name,
    category: input.category,
    subcategory: input.subcategory ?? null,
    color_id: input.color_id,
    quantity: input.quantity,
    location_id: input.location_id ?? null,
    notes: input.notes ?? null,
    image_path: input.image_path ?? null,
    created_at: stamp,
    updated_at: stamp,
    deleted_at: null,
    is_current: 1,
    design_id: null,
    rebrickable_part_num: null,
    ldraw_id: null,
    year_introduced: null,
    source: null,
    creator: null,
    width_plates: null,
    depth_plates: null,
    height_plates: null,
    stud_pattern: null,
    material: null,
    print_profile_notes: null,
    version: null,
    version_group_id: null,
    parent_part_id: null,
  };
  if (input.kind === 'official') {
    row.design_id = input.design_id;
    row.rebrickable_part_num = input.rebrickable_part_num ?? null;
    row.ldraw_id = input.ldraw_id ?? null;
    row.year_introduced = input.year_introduced ?? null;
  } else {
    row.source = input.source;
    row.creator = input.creator ?? null;
    row.width_plates = input.width_plates ?? null;
    row.depth_plates = input.depth_plates ?? null;
    row.height_plates = input.height_plates ?? null;
    row.stud_pattern = input.stud_pattern ?? null;
    row.material = input.material ?? null;
    row.print_profile_notes = input.print_profile_notes ?? null;
    row.version = 1;
    row.version_group_id = id;
    row.parent_part_id = input.parent_part_id ?? null;
  }
  recorder.insert('parts', row);
  recorder.setTags(id, input.tags);
  return id;
}

export function requireLivePart(db: Database, id: string): Row {
  const row = readRow(db, 'parts', id);
  if (!row || row.deleted_at !== null) throw notFound('Part');
  return row;
}

/** Checks the edit does not mix fields from the other kind. */
export function assertFieldsMatchKind(kind: string, patch: PartPatch): void {
  const forbidden = kind === 'official' ? CUSTOM_ONLY_FIELDS : OFFICIAL_ONLY_FIELDS;
  const bad = forbidden.filter((field) => (patch as Record<string, unknown>)[field] !== undefined);
  if (bad.length > 0) {
    throw badRequest(`These fields are only for ${kind === 'official' ? 'custom' : 'official'} parts`, bad);
  }
}

export function patchToRow(patch: PartPatch): Row {
  const row: Row = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'tags' || value === undefined) continue;
    row[key] = value as string | number | null;
  }
  return row;
}
