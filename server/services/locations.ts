import type { Database } from 'better-sqlite3';
import type { LocationInput } from '@shared/otherSchemas';
import type { LocationNode, LocationRecord } from '@shared/types';
import { badRequest, conflict, notFound } from '../http';
import { ActionRecorder, type Row } from '../recorder';
import { reindexLocationParts } from './searchIndex';

interface LocationRow {
  id: string;
  parent_id: string | null;
  name: string;
  level_label: string | null;
  label: string | null;
  color_code: string | null;
  path: string;
  id_path: string;
  part_count: number;
}

export function listLocations(db: Database): LocationRecord[] {
  const rows = db
    .prepare(
      `SELECT l.id, l.parent_id, l.name, l.level_label, l.label, l.color_code,
              (SELECT COUNT(*) FROM parts p WHERE p.location_id = l.id
                 AND p.deleted_at IS NULL AND p.is_current = 1) AS part_count
       FROM locations l ORDER BY l.name COLLATE NOCASE`,
    )
    .all() as LocationRecord[];
  return rows;
}

export function buildLocationTree(records: LocationRecord[]): LocationNode[] {
  const nodes = new Map<string, LocationNode>();
  for (const record of records) {
    nodes.set(record.id, { ...record, children: [], total_part_count: record.part_count });
  }
  const roots: LocationNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const addTotals = (node: LocationNode): number => {
    for (const child of node.children) node.total_part_count += addTotals(child);
    return node.total_part_count;
  };
  roots.forEach(addTotals);
  return roots;
}

export function getLocationRow(db: Database, id: string): LocationRow {
  const row = db.prepare('SELECT * FROM locations WHERE id = ?').get(id) as LocationRow | undefined;
  if (!row) throw notFound('Location');
  return row;
}

function now(): string {
  return new Date().toISOString();
}

/** Recomputes the text paths of a location and everything below it. */
function rebuildPaths(recorder: ActionRecorder, rootId: string): void {
  const { db } = recorder;
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    const row = getLocationRow(db, id);
    const parent = row.parent_id ? getLocationRow(db, row.parent_id) : null;
    const path = parent ? `${parent.path} > ${row.name}` : row.name;
    const idPath = `${parent ? parent.id_path : '/'}${row.id}/`;
    if (path !== row.path || idPath !== row.id_path) {
      recorder.update('locations', id, { path, id_path: idPath, updated_at: now() });
    } else {
      recorder.touchedLocationIds.add(id);
    }
    const children = db.prepare('SELECT id FROM locations WHERE parent_id = ?').all(id) as {
      id: string;
    }[];
    queue.push(...children.map((child) => child.id));
  }
}

export function createLocation(db: Database, input: LocationInput): LocationNode {
  if (input.parent_id) getLocationRow(db, input.parent_id);
  const recorder = new ActionRecorder(db);
  const id = crypto.randomUUID();
  db.transaction(() => {
    recorder.insert('locations', {
      id,
      parent_id: input.parent_id ?? null,
      name: input.name,
      level_label: input.level_label ?? null,
      label: input.label ?? null,
      color_code: input.color_code ?? null,
      path: '',
      id_path: '',
      created_at: now(),
      updated_at: now(),
    });
    rebuildPaths(recorder, id);
    recorder.commit(`Add location ${input.name}`);
  })();
  return findNode(db, id);
}

function findNode(db: Database, id: string): LocationNode {
  const walk = (nodes: LocationNode[]): LocationNode | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = walk(node.children);
      if (found) return found;
    }
    return undefined;
  };
  const node = walk(buildLocationTree(listLocations(db)));
  if (!node) throw notFound('Location');
  return node;
}

export function updateLocation(
  db: Database,
  id: string,
  patch: Partial<LocationInput>,
): LocationNode {
  const existing = getLocationRow(db, id);
  if (patch.parent_id !== undefined) throw badRequest('Use the move route to change the parent');
  const recorder = new ActionRecorder(db);
  db.transaction(() => {
    const changes: Row = { updated_at: now() };
    if (patch.name !== undefined) changes.name = patch.name;
    if (patch.level_label !== undefined) changes.level_label = patch.level_label;
    if (patch.label !== undefined) changes.label = patch.label;
    if (patch.color_code !== undefined) changes.color_code = patch.color_code;
    recorder.update('locations', id, changes);
    if (patch.name !== undefined && patch.name !== existing.name) rebuildPaths(recorder, id);
    reindexLocationParts(db, recorder.touchedLocationIds);
    recorder.commit(`Edit location ${existing.name}`);
  })();
  return findNode(db, id);
}

/** Moving a location only changes its parent; every part inside stays linked to it. */
export function moveLocation(db: Database, id: string, parentId: string | null): LocationNode {
  const location = getLocationRow(db, id);
  if (parentId) {
    const parent = getLocationRow(db, parentId);
    if (parent.id_path.startsWith(location.id_path)) {
      throw badRequest('A location cannot be moved inside itself');
    }
  }
  const recorder = new ActionRecorder(db);
  db.transaction(() => {
    recorder.update('locations', id, { parent_id: parentId, updated_at: now() });
    rebuildPaths(recorder, id);
    reindexLocationParts(db, recorder.touchedLocationIds);
    recorder.commit(`Move location ${location.name}`);
  })();
  return findNode(db, id);
}

/** Deleting needs an empty location, or a place to move its contents to. Nothing is lost. */
export function deleteLocation(db: Database, id: string, moveTo?: string): void {
  const location = getLocationRow(db, id);
  const children = db.prepare('SELECT id FROM locations WHERE parent_id = ?').all(id) as {
    id: string;
  }[];
  const parts = db
    .prepare('SELECT id FROM parts WHERE location_id = ? AND deleted_at IS NULL AND is_current = 1')
    .all(id) as { id: string }[];
  if ((children.length > 0 || parts.length > 0) && !moveTo) {
    throw conflict('This location is not empty. Choose where to move its contents.', {
      children: children.length,
      parts: parts.length,
    });
  }
  if (moveTo) {
    const target = getLocationRow(db, moveTo);
    if (target.id_path.startsWith(location.id_path)) {
      throw badRequest('Cannot move the contents into the location being deleted');
    }
  }
  const recorder = new ActionRecorder(db);
  db.transaction(() => {
    const attachedParts = db.prepare('SELECT id FROM parts WHERE location_id = ?').all(id) as {
      id: string;
    }[];
    for (const part of attachedParts) {
      recorder.update('parts', part.id, { location_id: moveTo ?? null, updated_at: now() });
    }
    if (moveTo) {
      for (const child of children) {
        recorder.update('locations', child.id, { parent_id: moveTo, updated_at: now() });
        rebuildPaths(recorder, child.id);
      }
    }
    recorder.remove('locations', id);
    reindexLocationParts(
      db,
      [...recorder.touchedLocationIds].filter((item) => item !== id),
    );
    if (moveTo) reindexLocationParts(db, [moveTo]);
    recorder.commit(`Delete location ${location.name}`);
  })();
}
