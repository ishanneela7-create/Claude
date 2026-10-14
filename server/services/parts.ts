import type { Database } from 'better-sqlite3';
import type { PartInput, PartPatch } from '@shared/partSchemas';
import type { PartRecord } from '@shared/types';
import { conflict, notFound } from '../http';
import { ActionRecorder } from '../recorder';
import { changesDesign, createNewVersion } from './partVersions';
import { getPartRecord } from './partRows';
import { reindexParts } from './searchIndex';
import {
  assertFieldsMatchKind,
  assertReferences,
  insertPart,
  nowIso,
  patchToRow,
  requireLivePart,
} from './partWrites';

export function getPart(db: Database, id: string): PartRecord {
  const part = getPartRecord(db, id);
  if (!part) throw notFound('Part');
  return part;
}

export function createPart(db: Database, input: PartInput): PartRecord {
  const recorder = new ActionRecorder(db);
  let id = '';
  db.transaction(() => {
    id = insertPart(recorder, input);
    reindexParts(db, recorder.touchedPartIds);
    recorder.commit(`Add part ${input.name}`);
  })();
  return getPart(db, id);
}

export function updatePart(db: Database, id: string, patch: PartPatch): PartRecord {
  const existing = requireLivePart(db, id);
  if (existing.is_current !== 1) {
    throw conflict('This is an old version. Open the current version to edit.');
  }
  assertFieldsMatchKind(String(existing.kind), patch);
  assertReferences(db, {
    color_id: patch.color_id,
    location_id: patch.location_id,
    parent_part_id: patch.parent_part_id,
  });
  const recorder = new ActionRecorder(db);
  let resultId = id;
  db.transaction(() => {
    if (existing.kind === 'custom' && changesDesign(patch)) {
      resultId = createNewVersion(recorder, existing, patch);
    } else {
      recorder.update('parts', id, { ...patchToRow(patch), updated_at: nowIso() });
      if (patch.tags) recorder.setTags(id, patch.tags);
    }
    reindexParts(db, [id, resultId]);
    recorder.commit(`Edit part ${patch.name ?? String(existing.name)}`);
  })();
  return getPart(db, resultId);
}

/** Soft delete: the row stays in the database (hidden), so undo can bring it back. */
export function deletePart(db: Database, id: string): void {
  const existing = requireLivePart(db, id);
  const recorder = new ActionRecorder(db);
  db.transaction(() => {
    const stamp = nowIso();
    const group = existing.version_group_id
      ? (db
          .prepare('SELECT id FROM parts WHERE version_group_id = ? AND deleted_at IS NULL')
          .all(existing.version_group_id) as { id: string }[])
      : [{ id }];
    for (const row of group) recorder.update('parts', row.id, { deleted_at: stamp });
    reindexParts(db, recorder.touchedPartIds);
    recorder.commit(`Delete part ${String(existing.name)}`);
  })();
}
