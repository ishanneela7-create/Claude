import fs from 'node:fs';
import path from 'node:path';
import { createContext } from '../server/db';
import { runImport } from '../server/services/importer';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run import -- <file.csv> [--rebrickable]');
  process.exit(1);
}
const context = createContext(path.resolve(process.env.DATA_DIR ?? 'data'));
const result = runImport(context.db, {
  format: process.argv.includes('--rebrickable') ? 'rebrickable' : 'csv',
  text: fs.readFileSync(file, 'utf8'),
  source_name: path.basename(file),
});
console.log(
  `Import ${result.import.id}: ${result.import.created_count} added, ${result.import.updated_count} updated, ${result.errors.length} rows skipped.`,
);
for (const error of result.errors.slice(0, 10)) console.log(`  row ${error.row}: ${error.message}`);
console.log('To undo it, use "Import parts" in the app and press "Roll back" on this import.');
