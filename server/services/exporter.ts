import fs from 'node:fs';
import path from 'node:path';
import type { Database } from 'better-sqlite3';
import { toCsv } from '@shared/csv';
import type { PartRecord } from '@shared/types';
import { PART_SELECT, toPartRecords } from './partRows';
import { listColors } from './colors';
import { listLocations } from './locations';
import { listTags } from './tags';

const CSV_COLUMNS = [
  'name',
  'design_id',
  'category',
  'subcategory',
  'color',
  'quantity',
  'location',
  'notes',
  'tags',
  'kind',
  'rebrickable_part_num',
  'ldraw_id',
  'year_introduced',
  'source',
  'creator',
  'width_plates',
  'depth_plates',
  'height_plates',
  'stud_pattern',
  'material',
  'version',
  'created_at',
] as const;

function allParts(db: Database, includeOldVersions: boolean): PartRecord[] {
  const rows = db
    .prepare(
      `${PART_SELECT} WHERE p.deleted_at IS NULL ${includeOldVersions ? '' : 'AND p.is_current = 1'}
       ORDER BY p.name COLLATE NOCASE, p.id`,
    )
    .all() as Parameters<typeof toPartRecords>[1];
  return toPartRecords(db, rows);
}

/** One row per part; the columns match what the CSV import understands. */
export function exportCsv(db: Database): string {
  const rows = allParts(db, false).map((part) =>
    CSV_COLUMNS.map((column) => {
      if (column === 'color') return part.color_name;
      if (column === 'location') return part.location_path;
      if (column === 'tags') return part.tags.join(';');
      return part[column];
    }),
  );
  return toCsv([[...CSV_COLUMNS], ...rows]);
}

export function exportJson(db: Database): object {
  return {
    format: 'lego-library-export',
    formatVersion: 1,
    exported_at: new Date().toISOString(),
    colors: listColors(db).filter((color) => color.is_custom),
    locations: listLocations(db),
    tags: listTags(db),
    parts: allParts(db, true),
  };
}

/** Makes a safe copy of the whole database file (uses SQLite's own backup, safe while running). */
export async function exportSqliteBackup(db: Database, dataDir: string): Promise<string> {
  const backupDir = path.join(dataDir, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(backupDir, `backup-${stamp}.db`);
  await db.backup(target);
  return target;
}
