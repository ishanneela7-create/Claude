import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../server/db';
import { appliedVersions, migrateDown, migrateUp } from '../../server/migrate';
import { MIGRATIONS } from '../../server/migrations';

let dir: string;
let file: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lego-migrate-'));
  file = path.join(dir, 'library.db');
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const tableNames = (db: ReturnType<typeof openDatabase>) =>
  (
    db
      .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','index') ORDER BY name")
      .all() as { name: string }[]
  ).map((row) => row.name);

describe('migrations', () => {
  it('apply in order, once, and are recorded', () => {
    const db = openDatabase(file);
    expect(migrateUp(db, file)).toEqual(MIGRATIONS.map((migration) => migration.version));
    expect(migrateUp(db, file)).toEqual([]);
    expect(appliedVersions(db)).toEqual(MIGRATIONS.map((migration) => migration.version));
    expect(tableNames(db)).toEqual(
      expect.arrayContaining(['parts', 'colors', 'locations', 'tags', 'parts_search']),
    );
    db.close();
  });

  it('can be reversed one by one, all the way, and re-applied', () => {
    const db = openDatabase(file);
    migrateUp(db, file);
    const full = tableNames(db);
    expect(migrateDown(db, file, 1)).toEqual([MIGRATIONS.length]);
    expect(tableNames(db)).not.toContain('parts_search_vocab');
    migrateDown(db, file, 10);
    expect(appliedVersions(db)).toEqual([]);
    expect(
      tableNames(db).filter((name) => !name.startsWith('sqlite_') && name !== 'schema_migrations'),
    ).toEqual([]);
    migrateUp(db, file);
    expect(tableNames(db)).toEqual(full);
    db.close();
  });

  it('keeps user data when stepping the search migrations down and up', () => {
    const db = openDatabase(file);
    migrateUp(db, file);
    db.prepare("INSERT INTO colors (id, name, rgb) VALUES (1, 'Blue', '0055BF')").run();
    db.prepare(
      `INSERT INTO parts (id, kind, name, category, color_id, created_at, updated_at, design_id)
       VALUES ('p1', 'official', 'Brick', 'Bricks', 1, 'x', 'x', '3001')`,
    ).run();
    migrateDown(db, file, 2);
    migrateUp(db, file);
    expect((db.prepare('SELECT COUNT(*) AS n FROM parts').get() as { n: number }).n).toBe(1);
    db.close();
  });

  it('copies the database file to a backups folder before changing an existing database', () => {
    const db = openDatabase(file);
    migrateUp(db, file);
    expect(fs.existsSync(path.join(dir, 'backups'))).toBe(false);
    migrateDown(db, file, 1);
    const backups = fs.readdirSync(path.join(dir, 'backups'));
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^pre-migration-.*\.db$/);
    db.close();
  });

  it('enforces the table rules (official needs a design id, quantity cannot be negative)', () => {
    const db = openDatabase(file);
    migrateUp(db, file);
    db.prepare("INSERT INTO colors (id, name, rgb) VALUES (1, 'Blue', '0055BF')").run();
    const insert = (kind: string, design: string | null, quantity: number) =>
      db
        .prepare(
          `INSERT INTO parts (id, kind, name, category, color_id, created_at, updated_at, design_id, quantity)
           VALUES (?, ?, 'x', 'Bricks', 1, 'x', 'x', ?, ?)`,
        )
        .run(crypto.randomUUID(), kind, design, quantity);
    expect(() => insert('official', null, 1)).toThrow();
    expect(() => insert('official', '3001', -1)).toThrow();
    expect(() => insert('weird', '3001', 1)).toThrow();
    expect(() => insert('custom', null, 1)).toThrow(); // custom needs a source and version
    db.close();
  });
});
