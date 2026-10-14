import fs from 'node:fs';
import path from 'node:path';
import type { Database } from 'better-sqlite3';
import sharp, { type OutputInfo } from 'sharp';
import { MAX_PHOTOS_PER_PART, PHOTO_MAX_WIDTH, THUMBNAIL_WIDTH } from '@shared/constants';
import type { PhotoRecord } from '@shared/types';
import { badRequest, conflict, notFound } from '../http';
import { ActionRecorder } from '../recorder';
import { nowIso, requireLivePart } from './partWrites';

interface PhotoRow {
  id: string;
  part_id: string;
  file_path: string;
  thumb_path: string;
  width: number;
  height: number;
}

function toRecord(row: PhotoRow): PhotoRecord {
  return {
    id: row.id,
    part_id: row.part_id,
    url: `/photos/${row.file_path}`,
    thumb_url: `/photos/${row.thumb_path}`,
    width: row.width,
    height: row.height,
  };
}

export function listPhotos(db: Database, partId: string): PhotoRecord[] {
  const rows = db
    .prepare('SELECT * FROM part_photos WHERE part_id = ? ORDER BY sort_order, created_at')
    .all(partId) as PhotoRow[];
  return rows.map(toRecord);
}

/** Resizes to 1024px wide (never bigger than the original) and makes a small thumbnail. */
export async function addPhoto(
  db: Database,
  photosDir: string,
  partId: string,
  upload: Buffer,
): Promise<PhotoRecord> {
  const part = requireLivePart(db, partId);
  const count = (
    db.prepare('SELECT COUNT(*) AS n FROM part_photos WHERE part_id = ?').get(partId) as {
      n: number;
    }
  ).n;
  if (count >= MAX_PHOTOS_PER_PART) {
    throw conflict(`A part can have at most ${MAX_PHOTOS_PER_PART} photos`);
  }
  let main: { data: Buffer; info: OutputInfo };
  let thumb: Buffer;
  try {
    const image = sharp(upload, { failOn: 'error' }).rotate();
    main = await image
      .clone()
      .resize({ width: PHOTO_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    thumb = await image
      .clone()
      .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
  } catch {
    throw badRequest('That file is not a readable image');
  }

  const id = crypto.randomUUID();
  const filePath = `${id}.webp`;
  const thumbPath = `${id}_thumb.webp`;
  fs.writeFileSync(path.join(photosDir, filePath), main.data);
  fs.writeFileSync(path.join(photosDir, thumbPath), thumb);

  const recorder = new ActionRecorder(db);
  db.transaction(() => {
    recorder.insert('part_photos', {
      id,
      part_id: partId,
      file_path: filePath,
      thumb_path: thumbPath,
      width: main.info.width,
      height: main.info.height,
      sort_order: count,
      created_at: nowIso(),
    });
    if (!part.image_path) recorder.update('parts', partId, { image_path: `/photos/${thumbPath}` });
    recorder.commit('Add photo');
  })();
  return toRecord(db.prepare('SELECT * FROM part_photos WHERE id = ?').get(id) as PhotoRow);
}

/** Removes the photo from the part. The image file stays on disk so undo works. */
export function removePhoto(db: Database, partId: string, photoId: string): void {
  const photo = db
    .prepare('SELECT * FROM part_photos WHERE id = ? AND part_id = ?')
    .get(photoId, partId) as PhotoRow | undefined;
  if (!photo) throw notFound('Photo');
  const part = requireLivePart(db, partId);
  const recorder = new ActionRecorder(db);
  db.transaction(() => {
    recorder.remove('part_photos', photoId);
    if (part.image_path === `/photos/${photo.thumb_path}`) {
      const next = db
        .prepare('SELECT thumb_path FROM part_photos WHERE part_id = ? ORDER BY sort_order LIMIT 1')
        .get(partId) as { thumb_path: string } | undefined;
      recorder.update('parts', partId, { image_path: next ? `/photos/${next.thumb_path}` : null });
    }
    recorder.commit('Remove photo');
  })();
}
