import fs from 'node:fs';
import path from 'node:path';
import { createContext } from '../server/db';
import { exportCsv, exportJson, exportSqliteBackup } from '../server/services/exporter';

const [format = 'csv', output] = process.argv.slice(2);
const context = createContext(path.resolve(process.env.DATA_DIR ?? 'data'));

if (format === 'csv') {
  const file = output ?? 'lego-library.csv';
  fs.writeFileSync(file, exportCsv(context.db));
  console.log(`Wrote ${file}`);
} else if (format === 'json') {
  const file = output ?? 'lego-library.json';
  fs.writeFileSync(file, JSON.stringify(exportJson(context.db), null, 2));
  console.log(`Wrote ${file}`);
} else if (format === 'sqlite') {
  const copy = await exportSqliteBackup(context.db, context.dataDir);
  if (output) fs.copyFileSync(copy, output);
  console.log(`Backup saved to ${output ?? copy}`);
} else {
  console.error('Usage: npm run export -- csv|json|sqlite [output file]');
  process.exitCode = 1;
}
