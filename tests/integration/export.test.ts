import fs from 'node:fs';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseCsv } from '../../shared/csv';
import { customPart, makeTestApp, officialBrick, type TestApp } from '../helpers/testApp';

let app: TestApp;
beforeEach(async () => {
  app = makeTestApp();
  const bin = (await app.api.post('/api/locations').send({ name: 'Bin, "special"' })).body;
  await app.api.post('/api/parts').send(officialBrick({ location_id: bin.id, tags: ['a', 'b'], notes: 'line\nbreak' }));
  await app.api.post('/api/parts').send(customPart());
});
afterEach(() => app.cleanup());

describe('export', () => {
  it('exports CSV that reads back correctly', async () => {
    const response = await app.api.get('/api/export/csv');
    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toContain('lego-library.csv');
    const [header, ...rows] = parseCsv(response.text);
    expect(rows).toHaveLength(2);
    const brick = rows.find((row) => row[header?.indexOf('kind') ?? 0] === 'official') ?? [];
    expect(brick[header?.indexOf('location') ?? 0]).toBe('Bin, "special"');
    expect(brick[header?.indexOf('notes') ?? 0]).toBe('line\nbreak');
    expect(brick[header?.indexOf('tags') ?? 0]).toBe('a;b');
  });

  it('a CSV export can be imported into a fresh library', async () => {
    const csv = (await app.api.get('/api/export/csv')).text;
    const other = makeTestApp();
    try {
      const response = await other.api.post('/api/imports').send({ format: 'csv', text: csv });
      expect(response.body.import.created_count).toBe(2);
      expect(response.body.errors).toHaveLength(0);
      const custom = (await other.api.get('/api/parts?kind=custom')).body.items[0];
      expect(custom).toMatchObject({ source: '3d_printed', material: 'PLA', width_plates: 4 });
    } finally {
      other.cleanup();
    }
  });

  it('exports JSON with parts, locations and tags', async () => {
    const response = await app.api.get('/api/export/json');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ format: 'lego-library-export', formatVersion: 1 });
    expect(response.body.parts).toHaveLength(2);
    expect(response.body.locations).toHaveLength(1);
    expect(response.body.tags).toHaveLength(2);
  });

  it('exports a real SQLite backup', async () => {
    const response = await app.api.get('/api/export/sqlite').buffer(true).parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => done(null, Buffer.concat(chunks)));
    });
    expect(response.status).toBe(200);
    const file = `${app.context.dataDir}/downloaded.db`;
    fs.writeFileSync(file, response.body as Buffer);
    const copy = new Database(file, { readonly: true });
    const count = copy.prepare('SELECT COUNT(*) AS n FROM parts').get() as { n: number };
    copy.close();
    expect(count.n).toBe(2);
  });
});
