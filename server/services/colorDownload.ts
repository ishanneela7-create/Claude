import fs from 'node:fs';
import zlib from 'node:zlib';
import { parseRebrickableColors, type SeedColor } from './colorSeed';

export const REBRICKABLE_COLORS_URL = 'https://cdn.rebrickable.com/media/downloads/colors.csv.gz';

function decode(raw: Buffer, gzipped: boolean): SeedColor[] {
  const text = (gzipped ? zlib.gunzipSync(raw) : raw).toString('utf8');
  const colors = parseRebrickableColors(text);
  if (colors.length === 0) throw new Error('no colors found in the file');
  return colors;
}

/** Downloads Rebrickable's public colors list. Throws if the network is unavailable. */
export async function downloadRebrickableColors(timeoutMs = 20000): Promise<SeedColor[]> {
  const response = await fetch(REBRICKABLE_COLORS_URL, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return decode(Buffer.from(await response.arrayBuffer()), true);
}

/** Reads a colors.csv (or colors.csv.gz) you downloaded yourself. */
export function readColorsFile(file: string): SeedColor[] {
  return decode(fs.readFileSync(file), file.endsWith('.gz'));
}
