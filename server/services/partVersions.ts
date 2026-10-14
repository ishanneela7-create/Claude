import type { Database } from 'better-sqlite3';
import type { PartPatch } from '@shared/partSchemas';
import type { PartRecord } from '@shared/types';
import { conflict, notFound } from '../http';
import { ActionRecorder, readPartTags, type Row } from '../recorder';
import { DESIGN_FIELDS, nowIso, patchToRow } from './partWrites';
import { PART_SELECT, toPartRecords } from './partRows';

export function changesDesign(patch: PartPatch): boolean {
  return DESIGN_FIELDS.some((field) => (patch as Record<string, unknown>)[field] !== undefined);
}

/**
 * Editing the design of a custom part keeps the old row as a read-only version
 * and makes a new current row (version + 1). Photos and tags carry over.
 */
export function createNewVersion(recorder: ActionRecorder, current: Row, patch: PartPatch): string {
  const { db } = recorder;
  const newId = crypto.randomUUID();
  const stamp = nowIso();
  recorder.update('parts', String(current.id), { is_current: 0 });
  recorder.insert('parts', {
    ...current,
    ...patchToRow(patch),
    id: newId,
    version: Number(current.version) + 1,
    version_group_id: String(current.version_group_id),
    is_current: 1,
    updated_at: stamp,
  });
  recorder.setTags(newId, patch.tags ?? readPartTags(db, String(current.id)));
  const photos = db
    .prepare('SELECT * FROM part_photos WHERE part_id = ?')
    .all(current.id) as Row[];
  for (const photo of photos) {
    recorder.insert('part_photos', { ...photo, id: crypto.randomUUID(), part_id: newId });
  }
  return newId;
}

export function listVersions(db: Database, id: string): PartRecord[] {
  const row = db.prepare('SELECT kind, version_group_id FROM parts WHERE id = ?').get(id) as
    | { kind: string; version_group_id: string | null }
    | undefined;
  if (!row) throw notFound('Part');
  if (row.kind !== 'custom' || !row.version_group_id) {
    throw conflict('Only custom parts have versions');
  }
  const rows = db
    .prepare(
      `${PART_SELECT} WHERE p.version_group_id = ? AND p.deleted_at IS NULL ORDER BY p.version DESC`,
    )
    .all(row.version_group_id) as Parameters<typeof toPartRecords>[1];
  return toPartRecords(db, rows);
}
