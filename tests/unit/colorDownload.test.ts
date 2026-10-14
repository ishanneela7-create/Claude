import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadRebrickableColors, readColorsFile } from '../../server/services/colorDownload';

const csv = 'id,name,rgb,is_trans\n0,Black,05131D,f\n33,Trans-Dark Blue,0020A0,t\n';

afterEach(() => vi.unstubAllGlobals());

describe('colors download', () => {
  it('reads a downloaded, compressed list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(zlib.gzipSync(csv), { status: 200 })),
    );
    const colors = await downloadRebrickableColors();
    expect(colors.map((color) => color.name)).toEqual(['Black', 'Trans-Dark Blue']);
  });

  it('fails clearly when the download is blocked or the file is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('no', { status: 403 })),
    );
    await expect(downloadRebrickableColors()).rejects.toThrow('HTTP 403');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(zlib.gzipSync('id,name,rgb\n'), { status: 200 })),
    );
    await expect(downloadRebrickableColors()).rejects.toThrow('no colors');
  });

  it('reads a file you downloaded yourself (plain or .gz)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lego-colors-'));
    fs.writeFileSync(path.join(dir, 'colors.csv'), csv);
    fs.writeFileSync(path.join(dir, 'colors.csv.gz'), zlib.gzipSync(csv));
    expect(readColorsFile(path.join(dir, 'colors.csv'))).toHaveLength(2);
    expect(readColorsFile(path.join(dir, 'colors.csv.gz'))).toHaveLength(2);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
