import path from 'node:path';
import { openDatabase } from '../server/db';
import { appliedVersions, migrateDown, migrateUp } from '../server/migrate';

const direction = process.argv[2] ?? 'up';
const steps = Number(process.argv[3] ?? 1);
const file = path.resolve(process.env.DATA_DIR ?? 'data', 'library.db');
const db = openDatabase(file);

if (direction === 'up') {
  const applied = migrateUp(db, file);
  console.log(applied.length ? `Applied migrations: ${applied.join(', ')}` : 'Already up to date');
} else if (direction === 'down') {
  const undone = migrateDown(db, file, steps);
  console.log(`Reverted migrations: ${undone.join(', ') || 'none'} (a backup copy was saved first)`);
} else {
  console.error('Usage: tsx scripts/migrate.ts up | down [steps]');
  process.exitCode = 1;
}
console.log(`Now at version: ${Math.max(0, ...appliedVersions(db))}`);
