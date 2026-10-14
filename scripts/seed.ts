import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createContext } from '../server/db';
import { insertSampleLibrary } from '../server/sampleData';
import {
  parseRebrickableColors,
  seedColors,
  STARTER_COLORS,
  type SeedColor,
} from '../server/services/colorSeed';

const COLORS_URL = 'https://cdn.rebrickable.com/media/downloads/colors.csv.gz';

/** Reads colors from a local file (--file=path) or downloads Rebrickable's list. */
async function loadColors(): Promise<{ colors: SeedColor[]; source: string }> {
  const fileArgument = process.argv.find((argument) => argument.startsWith('--file='));
  try {
    let text: string;
    if (fileArgument) {
      const file = fileArgument.slice('--file='.length);
      const raw = fs.readFileSync(file);
      text = file.endsWith('.gz') ? zlib.gunzipSync(raw).toString('utf8') : raw.toString('utf8');
    } else {
      const response = await fetch(COLORS_URL, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      text = zlib.gunzipSync(Buffer.from(await response.arrayBuffer())).toString('utf8');
    }
    const colors = parseRebrickableColors(text);
    if (colors.length === 0) throw new Error('no colors found in the file');
    return { colors, source: fileArgument ? 'local file' : 'Rebrickable download' };
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
