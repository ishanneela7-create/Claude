import type { Database } from 'better-sqlite3';
import type { BulkEdit, MergeRequest } from '@shared/partSchemas';
import type { DuplicateGroup, PartRecord } from '@shared/types';
import { badRequest } from '../http';
import { ActionRecorder, readPartTags, type Row } from '../recorder';
import { getPart } from './parts';
import { getPartRecords } from './partRows';
import { reindexParts } from './searchIndex';
import { assertReferences, nowIso, requireLivePart } from './partWrites';

export function findDuplicateGroups(db: Database): DuplicateGroup[] {
  const keys = db
    .prepare(
      `SELECT design_id, color_id FROM parts
       WHERE kind = 'official' AND deleted_at IS NULL AND is_current = 1
       GROUP BY design_id, color_id HAVING COUNT(*) > 1
       ORDER BY design_id LIMIT 500`,
    )
    .all() as { design_id: string; color_id: number }[];
  const select = db.prepare(
    `SELECT id FROM parts WHERE kind = 'official' AND design_id = ? AND color_id = ?
     AND deleted_at IS NULL AND is_current = 1 ORDER BY created_at`,
  );
  return keys.map((key) => {
    const ids = (select.all(key.design_id, key.color_id) as { id: string }[]).map((row) => row.id);
    const parts = getPartRecords(db, ids);
    return {
      design_id: key.design_id,
      color_id: key.color_id,
      color_name: parts[0]?.color_name ?? '',
      parts,
    };
  });
}

/** Changes many parts in one undoable action. */
export function bulkEditParts(db: Database, request: BulkEdit): { updated: number } {
  const { ids, changes } = request;
  if (changes.location_id !== undefined) assertReferences(db, { location_id: changes.location_id });
  if (changes.quantity !== undefined && changes.quantity_delta !== undefined) {
    throw badRequest('Use either quantity or quantity_delta, not both');
  }
  const recorder = new ActionRecorder(db);
  db.transaction(() => {
    for (const id of ids) {
      const row = requireLivePart(db, id);
      if (row.is_current !== 1) continue;
      const patch: Row = { updated_at: nowIso() };
      if (changes.location_id !== undefined) patch.location_id = changes.location_id;
      if (changes.quantity !== undefined) patch.quantity = changes.quantity;
      if (changes.quantity_delta !== undefined) {
        patch.quantity = Math.max(0, Number(row.quantity) + changes.quantity_delta);
      }
      recorder.update('parts', id, patch);
      if (changes.add_tags || changes.remove_tags) {
        const removed = new Set((changes.remove_tags ?? []).map((tag) => tag.toLowerCase()));
        const next = [...readPartTags(db, id), ...(changes.add_tags ?? [])].filter(
          (tag) => !removed.has(tag.toLowerCase()),
        );
        recorder.setTags(id, next);
      }
    }
    reindexParts(db, recorder.touchedPartIds);
    recorder.commit(`Bulk edit ${ids.length} parts`);
  })();
  return { updated: ids.length };
}

/** Folds duplicate parts into one: quantities add up, tags and notes are combined. */
export function mergeParts(db: Database, request: MergeRequest): PartRecord {
  const keep = requireLivePart(db, request.keep_id);
  const others = request.merge_ids.map((id) => requireLivePart(db, id));
  for (const other of others) {
    const same =
      other.kind === 'official' &&
      keep.kind === 'official' &&
      other.design_id === keep.design_id &&
      other.color_id === keep.color_id;
    if (!same || other.id === keep.id) {
      throw badRequest('Only official parts with the same design id and color can be merged');
    }
  }
  const recorder = new ActionRecorder(db);
  db.transaction(() => {
    const quantity = others.reduce((sum, row) => sum + Number(row.quantity), Number(keep.quantity));
    const notes = [keep.notes, ...others.map((row) => row.notes)]
      .filter((text): text is string => typeof text === 'string' && text.trim() !== '')
      .filter((text, index, list) => list.indexOf(text) === index)
      .join('\n\n');
    const tags = [
      ...readPartTags(db, request.keep_id),
      ...others.flatMap((row) => readPartTags(db, String(row.id))),
    ];
    recorder.update('parts', request.keep_id, {
      quantity,
      notes: notes || null,
      location_id: keep.location_id ?? others.find((row) => row.location_id)?.location_id ?? null,
      updated_at: nowIso(),
    });
    recorder.setTags(request.keep_id, tags);
    for (const other of others) {
      recorder.update('parts', String(other.id), { deleted_at: nowIso() });
    }
    reindexParts(db, recorder.touchedPartIds);
    recorder.commit(`Merge ${others.length + 1} duplicate parts`);
  })();
  return getPart(db, request.keep_id);
}
