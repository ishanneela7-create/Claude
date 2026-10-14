import path from 'node:path';
import { createContext } from '../server/db';
import { insertSampleLibrary } from '../server/sampleData';
import { SeedColor, STARTER_COLORS, seedColors } from '../server/services/colorSeed';
import { downloadRebrickableColors, readColorsFile } from '../server/services/colorDownload';

/** Reads colors from a local file (--file=path) or downloads Rebrickable's list. */
async function loadColors(): Promise<{ colors: SeedColor[]; source: string }> {
  const fileArgument = process.argv.find((argument) => argument.startsWith('--file='));
  try {
    if (fileArgument) {
      return { colors: readColorsFile(fileArgument.slice('--file='.length)), source: 'local file' };
    }
    return { colors: await downloadRebrickableColors(), source: 'Rebrickable download' };
  } catch (error) {
    console.warn(`Could not load the Rebrickable list (${String(error)}).`);
    console.warn('Using the small built-in starter colors instead. Run this again when online.');
    return { colors: STARTER_COLORS, source: 'built-in starter list' };
  }
}

const context = createContext(path.resolve(process.env.DATA_DIR ?? 'data'));
const { colors, source } = await loadColors();
console.log(`Seeded ${seedColors(context.db, colors)} colors from the ${source}.`);

const parts = context.db.prepare('SELECT COUNT(*) AS n FROM parts').get() as { n: number };
if (process.argv.includes('--sample') && parts.n === 0) {
  insertSampleLibrary(context.db);
  console.log('Added the sample library.');
}
