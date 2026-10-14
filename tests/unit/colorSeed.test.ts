import { describe, expect, it } from 'vitest';
import { createContext } from '../../server/db';
import {
  looksMetallic,
  parseRebrickableColors,
  seedColors,
  STARTER_COLORS,
} from '../../server/services/colorSeed';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const csv = [
  'id,name,rgb,is_trans,num_parts,num_sets,y1,y2',
  '0,Black,05131D,f,100,100,1957,2024',
  '1,Blue,0055BF,f,100,100,1949,2024',
  '33,Trans-Dark Blue,0020A0,t,100,100,1949,2024',
  '80,Metallic Silver,A5ADB4,f,10,10,1990,2024',
  '81,Chrome Gold,BBA53D,False,10,10,1990,2024',
  '-1,[Unknown],0033B2,f,0,0,1990,2024',
  'x,Broken,ZZZZZZ,f,0,0,0,0',
].join('\n');

describe('parseRebrickableColors', () => {
  it('reads id, name, rgb and transparency (both t/f and True/False styles)', () => {
    const colors = parseRebrickableColors(csv);
    expect(colors).toHaveLength(6);
    expect(colors.find((color) => color.id === 33)).toMatchObject({
      is_transparent: true,
      rgb: '0020A0',
    });
    expect(colors.find((color) => color.id === 1)).toMatchObject({
      name: 'Blue',
      is_transparent: false,
    });
    expect(colors.find((color) => color.id === -1)?.name).toBe('[Unknown]');
  });

  it('marks metallic colors by name', () => {
    const colors = parseRebrickableColors(csv);
    expect(colors.filter((color) => color.is_metallic).map((color) => color.id)).toEqual([80, 81]);
    expect(looksMetallic('Pearl Gold')).toBe(true);
    expect(looksMetallic('Red')).toBe(false);
  });

  it('rejects files that are not the colors list and handles empty input', () => {
    expect(() => parseRebrickableColors('a,b\n1,2')).toThrow(/colors\.csv/);
    expect(parseRebrickableColors('')).toEqual([]);
  });
});

describe('seedColors', () => {
  it('adds colors, updates official ones and never touches custom colors', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lego-seed-'));
    const { db } = createContext(dir);
    seedColors(db, STARTER_COLORS);
    db.prepare(
      "INSERT INTO colors (id, name, rgb, is_custom) VALUES (100000, 'Mine', 'ABCDEF', 1)",
    ).run();
    seedColors(db, [
      { id: 4, name: 'Renamed Red', rgb: 'FF0000', is_transparent: false, is_metallic: false },
      {
        id: 100000,
        name: 'Overwritten?',
        rgb: '000000',
        is_transparent: false,
        is_metallic: false,
      },
    ]);
    expect(db.prepare('SELECT name FROM colors WHERE id = 4').get()).toEqual({
      name: 'Renamed Red',
    });
    expect(db.prepare('SELECT name, rgb FROM colors WHERE id = 100000').get()).toEqual({
      name: 'Mine',
      rgb: 'ABCDEF',
    });
    expect((db.prepare('SELECT COUNT(*) AS n FROM colors').get() as { n: number }).n).toBe(
      STARTER_COLORS.length + 1,
    );
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
