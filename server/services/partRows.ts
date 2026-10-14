import type { Database } from 'better-sqlite3';
import type { PartRecord } from '@shared/types';

export const PART_SELECT = `
  SELECT p.*, c.name AS color_name, c.rgb AS color_rgb, c.is_transparent AS color_is_transparent,
         COALESCE(l.path, '') AS location_path
  FROM parts p
  JOIN colors c ON c.id = p.color_id
  LEFT JOIN locations l ON l.id = p.location_id`;

type RawPartRow = Omit<PartRecord, 'tags' | 'color_is_transparent' | 'is_current'> & {
  color_is_transparent: number;
  is_current: number;
  deleted_at: string | null;
};

export function loadTagsFor(db: Database, ids: string[]): Map<string, string[]> {
  const byPart = new Map<string, string[]>();
  const chunkSize = 500;
  for (let start = 0; start < ids.length; start += chunkSize) {
    const chunk = ids.slice(start, start + chunkSize);
    const marks = chunk.map(() => '?').join(',');
    const rows = db
      .prepare(
        `SELECT pt.part_id AS part_id, t.name AS name FROM part_tags pt
         JOIN tags t ON t.id = pt.tag_id WHERE pt.part_id IN (${marks})
         ORDER BY t.name COLLATE NOCASE`,
      )
      .all(...chunk) as { part_id: string; name: string }[];
    for (const row of rows) {
      const list = byPart.get(row.part_id) ?? [];
      list.push(row.name);
      byPart.set(row.part_id, list);
    }
  }
  return byPart;
}

export function toPartRecords(db: Database, rows: RawPartRow[]): PartRecord[] {
  const tags = loadTagsFor(
    db,
    rows.map((row) => row.id),
  );
  return rows.map((row) => {
    const { deleted_at: _deleted, ...rest } = row;
    void _deleted;
    return {
      ...rest,
      color_is_transparent: row.color_is_transparent === 1,
      is_current: row.is_current === 1,
      tags: tags.get(row.id) ?? [],
    };
  });
}

export function getPartRecord(db: Database, id: string): PartRecord | null {
  const row = db.prepare(`${PART_SELECT} WHERE p.id = ? AND p.deleted_at IS NULL`).get(id) as
    RawPartRow | undefined;
  if (!row) return null;
  return toPartRecords(db, [row])[0] ?? null;
}

export function getPartRecords(db: Database, ids: string[]): PartRecord[] {
  if (ids.length === 0) return [];
  const marks = ids.map(() => '?').join(',');
  const rows = db
    .prepare(`${PART_SELECT} WHERE p.id IN (${marks}) AND p.deleted_at IS NULL`)
    .all(...ids) as RawPartRow[];
  return toPartRecords(db, rows);
}
