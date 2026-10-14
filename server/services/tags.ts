import type { Database } from 'better-sqlite3';
import type { TagRecord } from '@shared/types';
import { conflict, notFound } from '../http';
import { ActionRecorder, readPartTags } from '../recorder';
import { reindexParts } from './searchIndex';

export function listTags(db: Database): TagRecord[] {
  return db
    .prepare(
      `SELECT t.id, t.name, COUNT(p.id) AS part_count
       FROM tags t
       LEFT JOIN part_tags pt ON pt.tag_id = t.id
       LEFT JOIN parts p ON p.id = pt.part_id AND p.deleted_at IS NULL AND p.is_current = 1
       GROUP BY t.id ORDER BY t.name COLLATE NOCASE`,
    )
    .all() as TagRecord[];
}

function getTag(db: Database, id: string): { id: string; name: string } {
  const tag = db.prepare('SELECT id, name FROM tags WHERE id = ?').get(id) as
    | { id: string; name: string }
    | undefined;
  if (!tag) throw notFound('Tag');
  return tag;
}

function partsWithTag(db: Database, tagId: string): string[] {
  const rows = db.prepare('SELECT part_id FROM part_tags WHERE tag_id = ?').all(tagId) as {
    part_id: string;
  }[];
  return rows.map((row) => row.part_id);
}

export function createTag(db: Database, name: string): TagRecord {
  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name);
  if (existing) throw conflict('This tag already exists');
  const recorder = new ActionRecorder(db);
  const id = crypto.randomUUID();
  db.transaction(() => {
    recorder.insert('tags', { id, name });
    recorder.commit(`Add tag ${name}`);
  })();
  return { id, name, part_count: 0 };
}

export function renameTag(db: Database, id: string, name: string): TagRecord {
  const tag = getTag(db, id);
  const clash = db.prepare('SELECT id FROM tags WHERE name = ? AND id <> ?').get(name, id);
  if (clash) throw conflict('Another tag already has this name');
  const recorder = new ActionRecorder(db);
  db.transaction(() => {
    recorder.update('tags', id, { name });
    reindexParts(db, partsWithTag(db, id));
    recorder.commit(`Rename tag ${tag.name}`);
  })();
  return listTags(db).find((item) => item.id === id) as TagRecord;
}

/** Removes the tag from every part. Each part's old tag list is saved so undo restores it. */
export function deleteTag(db: Database, id: string): void {
  const tag = getTag(db, id);
  const recorder = new ActionRecorder(db);
  db.transaction(() => {
    const partIds = partsWithTag(db, id);
    for (const partId of partIds) {
      const remaining = readPartTags(db, partId).filter(
        (name) => name.toLowerCase() !== tag.name.toLowerCase(),
      );
      recorder.setTags(partId, remaining);
    }
    recorder.remove('tags', id);
    reindexParts(db, partIds);
    recorder.commit(`Delete tag ${tag.name}`);
  })();
}
