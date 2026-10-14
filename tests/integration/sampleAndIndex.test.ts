import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../server/app';
import { createContext, refreshStatistics, type AppContext } from '../../server/db';
import { seedSampleDataIfEmpty } from '../../server/sampleData';
import { insertSyntheticParts } from '../../server/syntheticParts';
import {
  rebuildSearchIndex,
  ensureSearchIndex,
  reindexParts,
} from '../../server/services/searchIndex';
import { STARTER_COLORS, seedColors } from '../../server/services/colorSeed';
import { makeTestApp, officialBrick, type TestApp } from '../helpers/testApp';

describe('sample data', () => {
  let dir: string;
  let context: AppContext;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lego-sample-'));
    context = createContext(dir);
  });
  afterEach(() => {
    context.db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('fills an empty library with colors, bins, official and custom parts', async () => {
    await seedSampleDataIfEmpty(context.db);
    const api = request(createApp(context));
    const stats = (await api.get('/api/parts/stats')).body as { parts: number };
    expect(stats.parts).toBeGreaterThan(50);
    expect((await api.get('/api/parts?kind=custom')).body.total).toBe(5);
    expect((await api.get('/api/parts/duplicates')).body).toHaveLength(1);
    expect((await api.get('/api/parts?missing_location=true')).body.total).toBeGreaterThan(0);
    expect((await api.get('/api/locations')).body.length).toBeGreaterThan(0);
    expect((await api.get('/api/history')).body).toEqual([]);
  });

  it('never adds sample data again once there are parts (even if you deleted them all)', async () => {
    await seedSampleDataIfEmpty(context.db);
    const before = (context.db.prepare('SELECT COUNT(*) AS n FROM parts').get() as { n: number }).n;
    context.db.prepare('UPDATE parts SET deleted_at = ?').run(new Date().toISOString());
    await seedSampleDataIfEmpty(context.db);
    expect((context.db.prepare('SELECT COUNT(*) AS n FROM parts').get() as { n: number }).n).toBe(
      before,
    );
  });
});

describe('search index upkeep', () => {
  let app: TestApp;
  beforeEach(() => {
    app = makeTestApp();
  });
  afterEach(() => app.cleanup());

  it('rebuilds itself when it disagrees with the parts table', async () => {
    await app.api.post('/api/parts').send(officialBrick());
    app.context.db.prepare('DELETE FROM parts_search').run();
    expect((await app.api.get('/api/parts?q=brick')).body.total).toBe(0);
    ensureSearchIndex(app.context.db);
    expect((await app.api.get('/api/parts?q=brick')).body.total).toBe(1);
    expect(rebuildSearchIndex(app.context.db)).toBe(1);
  });

  it('drops index entries for parts that no longer exist', async () => {
    const part = (await app.api.post('/api/parts').send(officialBrick())).body;
    app.context.db.prepare('DELETE FROM parts WHERE id = ?').run(part.id);
    reindexParts(app.context.db, [part.id]);
    expect((await app.api.get('/api/parts?q=brick')).body.total).toBe(0);
  });

  it('suggests the closest real word when a typed word matches nothing', async () => {
    await app.api.post('/api/parts').send(officialBrick({ name: 'Gearbox housing' }));
    const result = (await app.api.get('/api/parts?q=gearbx')).body;
    expect(result.total).toBe(1);
    expect(result.corrections).toEqual([{ from: 'gearbx', to: 'gearbox' }]);
    expect((await app.api.get('/api/parts?q=qqqqqqq')).body.total).toBe(0);
    const groups = (await app.api.get('/api/parts/groups?group=category&q=gearbx')).body;
    expect(groups).toEqual([{ key: 'Bricks', count: 1 }]);
  });
});

describe('speed guard (5,000 parts)', () => {
  it('searches and lists in well under 100 ms', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lego-speed-'));
    const context = createContext(dir);
    seedColors(context.db, STARTER_COLORS);
    insertSyntheticParts(context.db, 5000);
    refreshStatistics(context.db);
    const api = request(createApp(context));
    for (const url of [
      '/api/parts?q=brick&limit=100',
      '/api/parts?q=color:red%20cat:plates',
      '/api/parts?offset=4000&limit=100',
    ]) {
      await api.get(url);
      const started = performance.now();
      const response = await api.get(url);
      const took = performance.now() - started;
      expect(response.status).toBe(200);
      expect(took).toBeLessThan(100);
    }
    context.db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('error handling', () => {
  it('reports oversized and bad requests as clean errors', async () => {
    const app = makeTestApp();
    try {
      const big = await app.api
        .post('/api/imports/preview')
        .send({ format: 'csv', text: 'x'.repeat(81 * 1024 * 1024) });
      expect(big.status).toBe(413);
      const bad = await app.api.get('/api/parts?limit=abc');
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe('validation_error');
    } finally {
      app.cleanup();
    }
  });
});

describe('NO_SAMPLE', () => {
  it('starts a brand new library empty when asked', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lego-nosample-'));
    const context = createContext(dir);
    process.env.NO_SAMPLE = '1';
    try {
      await seedSampleDataIfEmpty(context.db);
      expect((context.db.prepare('SELECT COUNT(*) AS n FROM parts').get() as { n: number }).n).toBe(
        0,
      );
      expect(
        (context.db.prepare('SELECT COUNT(*) AS n FROM colors').get() as { n: number }).n,
      ).toBeGreaterThan(0);
    } finally {
      delete process.env.NO_SAMPLE;
      context.db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
