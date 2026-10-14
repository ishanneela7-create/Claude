import type { Database } from 'better-sqlite3';

export interface Migration {
  version: number;
  name: string;
  up(db: Database): void;
  down(db: Database): void;
}
