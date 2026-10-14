import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { migrateUp } from './migrate';

export interface AppContext {
  db: SqliteDatabase;
  dataDir: string;
  photosDir: string;
  databaseFile: string;
}

export function openDatabase(file: string): SqliteDatabase {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  return db;
}

export function createContext(dataDir: string, databaseFile?: string): AppContext {
  const file = databaseFile ?? path.join(dataDir, 'library.db');
  const photosDir = path.join(dataDir, 'photos');
  fs.mkdirSync(photosDir, { recursive: true });
  const db = openDatabase(file);
  migrateUp(db, file);
  return { db, dataDir, photosDir, databaseFile: file };
}

/** Gives SQLite fresh statistics so it picks the fastest query plans (cheap, even for 50,000 parts). */
export function refreshStatistics(db: SqliteDatabase): void {
  db.pragma('analysis_limit = 2000');
  db.exec('ANALYZE');
}
