import fs from 'node:fs';
import path from 'node:path';
import type { Database } from 'better-sqlite3';
import { MIGRATIONS } from './migrations';
import type { Migration } from './migrations/types';

function ensureMigrationTable(db: Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);
}

export function appliedVersions(db: Database): number[] {
  ensureMigrationTable(db);
  const rows = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as {
    version: number;
  }[];
  return rows.map((row) => row.version);
}

/** Copies the database file next to it before any schema change (a safety net). */
export function backupBeforeMigration(db: Database, file: string): string | null {
  if (file === ':memory:' || !fs.existsSync(file)) return null;
  const backupDir = path.join(path.dirname(file), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(backupDir, `pre-migration-${stamp}.db`);
  db.pragma('wal_checkpoint(TRUNCATE)');
  fs.copyFileSync(file, target);
  return target;
}

function runInTransaction(db: Database, migration: Migration, direction: 'up' | 'down'): void {
  db.transaction(() => {
    migration[direction](db);
    if (direction === 'up') {
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        migration.version,
        migration.name,
        new Date().toISOString(),
      );
    } else {
      db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(migration.version);
    }
  })();
}

export function migrateUp(db: Database, file: string): number[] {
  const done = new Set(appliedVersions(db));
  const pending = MIGRATIONS.filter((migration) => !done.has(migration.version));
  if (pending.length === 0) return [];
  if (done.size > 0) backupBeforeMigration(db, file);
  for (const migration of pending) runInTransaction(db, migration, 'up');
  return pending.map((migration) => migration.version);
}

/** Undoes the newest `steps` migrations. A backup copy is made first. */
export function migrateDown(db: Database, file: string, steps = 1): number[] {
  const done = appliedVersions(db).sort((a, b) => b - a).slice(0, steps);
  if (done.length > 0) backupBeforeMigration(db, file);
  for (const version of done) {
    const migration = MIGRATIONS.find((item) => item.version === version);
    if (!migration) throw new Error(`Unknown migration ${version}`);
    runInTransaction(db, migration, 'down');
  }
  return done;
}
