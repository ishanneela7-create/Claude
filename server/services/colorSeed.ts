import type { Database } from 'better-sqlite3';
import { parseCsv } from '@shared/csv';

export interface SeedColor {
  id: number;
  name: string;
  rgb: string;
  is_transparent: boolean;
  is_metallic: boolean;
}

/**
 * Rebrickable has no "metallic" column, so we guess from the name.
 * This is the one place the rule lives (double-check it against your own parts).
 */
export function looksMetallic(name: string): boolean {
  return /metallic|chrome|pearl/i.test(name);
}

/** Reads Rebrickable's colors.csv (columns: id, name, rgb, is_trans, ...). */
export function parseRebrickableColors(csvText: string): SeedColor[] {
  const [header, ...rows] = parseCsv(csvText);
  if (!header) return [];
  const column = (name: string) => header.indexOf(name);
  const idColumn = column('id');
  const nameColumn = column('name');
  const rgbColumn = column('rgb');
  const transColumn = column('is_trans');
  if (idColumn < 0 || nameColumn < 0 || rgbColumn < 0) {
    throw new Error('This does not look like Rebrickable colors.csv (need id, name, rgb columns)');
  }
  const colors: SeedColor[] = [];
  for (const row of rows) {
    const id = Number(row[idColumn]);
    const name = (row[nameColumn] ?? '').trim();
    const rgb = (row[rgbColumn] ?? '').replace('#', '').toUpperCase();
    if (!Number.isInteger(id) || !name || !/^[0-9A-F]{6}$/.test(rgb)) continue;
    const transValue = (row[transColumn] ?? '').toLowerCase();
    colors.push({
      id,
      name,
      rgb,
      is_transparent: transValue === 't' || transValue === 'true',
      is_metallic: looksMetallic(name),
    });
  }
  return colors;
}

/** Small starter list used only when Rebrickable cannot be downloaded. */
export const STARTER_COLORS: SeedColor[] = (
  [
    [0, 'Black', '05131D'],
    [1, 'Blue', '0055BF'],
    [2, 'Green', '237841'],
    [3, 'Dark Turquoise', '008F9B'],
    [4, 'Red', 'C91A09'],
    [5, 'Dark Pink', 'C870A0'],
    [6, 'Brown', '583927'],
    [7, 'Light Gray', '9BA19D'],
    [8, 'Dark Gray', '6D6E5C'],
    [9, 'Light Blue', 'B4D2E3'],
    [10, 'Bright Green', '4B9F4A'],
    [11, 'Light Turquoise', '55A5AF'],
    [12, 'Salmon', 'F2705E'],
    [13, 'Pink', 'FC97AC'],
    [14, 'Yellow', 'F2CD37'],
    [15, 'White', 'FFFFFF'],
    [17, 'Light Green', 'C2DAB8'],
    [18, 'Light Yellow', 'FBE696'],
    [19, 'Tan', 'E4CD9E'],
    [22, 'Purple', '81007B'],
    [25, 'Orange', 'FE8A18'],
    [26, 'Magenta', '923978'],
    [27, 'Lime', 'BBE90B'],
    [28, 'Dark Tan', '958A73'],
  ] as const
).map(([id, name, rgb]) => ({
  id,
  name,
  rgb,
  is_transparent: false,
  is_metallic: false,
}));

/** Adds or refreshes official colors. Custom colors are never touched. */
export function seedColors(db: Database, colors: SeedColor[]): number {
  const upsert = db.prepare(`
    INSERT INTO colors (id, name, rgb, is_transparent, is_metallic, is_custom)
    VALUES (@id, @name, @rgb, @trans, @metal, 0)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, rgb = excluded.rgb,
      is_transparent = excluded.is_transparent, is_metallic = excluded.is_metallic
    WHERE colors.is_custom = 0
  `);
  db.transaction(() => {
    for (const color of colors) {
      upsert.run({
        id: color.id,
        name: color.name,
        rgb: color.rgb,
        trans: color.is_transparent ? 1 : 0,
        metal: color.is_metallic ? 1 : 0,
      });
    }
  })();
  return colors.length;
}
