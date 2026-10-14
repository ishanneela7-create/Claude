import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp, officialBrick, type TestApp } from '../helpers/testApp';

let app: TestApp;
beforeEach(() => {
  app = makeTestApp();
});
afterEach(() => app.cleanup());

describe('colors', () => {
  it('lists seeded colors and adds a custom one', async () => {
    const list = await app.api.get('/api/colors');
    expect(list.body.length).toBeGreaterThan(10);
    const created = await app.api.post('/api/colors').send({ name: 'Sunset', rgb: '#ff8800' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ rgb: 'FF8800', is_custom: true });
    expect(created.body.id).toBeGreaterThanOrEqual(100000);
    expect((await app.api.post('/api/colors').send({ name: 'sunset', rgb: '000000' })).status).toBe(409);
    expect((await app.api.post('/api/colors').send({ name: 'Bad', rgb: 'xyz' })).status).toBe(400);
  });

  it('edits and deletes only custom colors that are unused', async () => {
    const created = await app.api.post('/api/colors').send({ name: 'Sunset', rgb: 'FF8800' });
    const edited = await app.api.patch(`/api/colors/${created.body.id}`).send({ name: 'Dusk' });
    expect(edited.body.name).toBe('Dusk');
    expect((await app.api.patch('/api/colors/4').send({ name: 'x' })).status).toBe(409);
    expect((await app.api.delete('/api/colors/4')).status).toBe(409);
    await app.api.post('/api/parts').send(officialBrick({ color_id: created.body.id }));
    expect((await app.api.delete(`/api/colors/${created.body.id}`)).status).toBe(409);
    const unused = await app.api.post('/api/colors').send({ name: 'Spare', rgb: '111111' });
    expect((await app.api.delete(`/api/colors/${unused.body.id}`)).status).toBe(204);
    expect((await app.api.get('/api/colors/4')).body.name).toBe('Red');
    expect((await app.api.get('/api/colors/987654')).status).toBe(404);
  });
});

describe('tags', () => {
  it('creates, renames and deletes tags and updates parts', async () => {
    const part = await app.api.post('/api/parts').send(officialBrick({ tags: ['old'] }));
    const tags = await app.api.get('/api/tags');
    expect(tags.body).toEqual([expect.objectContaining({ name: 'old', part_count: 1 })]);
    const renamed = await app.api.patch(`/api/tags/${tags.body[0].id}`).send({ name: 'new' });
    expect(renamed.body.name).toBe('new');
    expect((await app.api.get('/api/parts?q=tag:new')).body.total).toBe(1);
    const created = await app.api.post('/api/tags').send({ name: 'extra' });
    expect(created.status).toBe(201);
    expect((await app.api.post('/api/tags').send({ name: 'EXTRA' })).status).toBe(409);
    expect((await app.api.patch(`/api/tags/${created.body.id}`).send({ name: 'new' })).status).toBe(409);
    expect((await app.api.delete(`/api/tags/${tags.body[0].id}`)).status).toBe(204);
    expect((await app.api.get(`/api/parts/${part.body.id}`)).body.tags).toEqual([]);
    expect((await app.api.delete('/api/tags/missing')).status).toBe(404);
  });
});

describe('smart views', () => {
  it('has built-in views and manages your own', async () => {
    const list = await app.api.get('/api/views');
    expect(list.body.map((view: { name: string }) => view.name)).toEqual(
      expect.arrayContaining(['Low stock', 'Custom parts', 'Needs sorting', 'Missing location']),
    );
    const created = await app.api.post('/api/views').send({ name: 'Red bricks', filter: { q: 'color:red' } });
    expect(created.status).toBe(201);
    const edited = await app.api.patch(`/api/views/${created.body.id}`).send({ name: 'Reds' });
    expect(edited.body.name).toBe('Reds');
    expect((await app.api.delete('/api/views/builtin-low-stock')).status).toBe(409);
    expect((await app.api.patch('/api/views/builtin-low-stock').send({ name: 'x' })).status).toBe(409);
    expect((await app.api.delete(`/api/views/${created.body.id}`)).status).toBe(204);
    expect((await app.api.post('/api/views').send({ name: '' })).status).toBe(400);
  });

  it('the built-in views really filter', async () => {
    await app.api.post('/api/parts').send(officialBrick({ quantity: 1, tags: ['needs sorting'] }));
    for (const id of ['builtin-low-stock', 'builtin-needs-sorting', 'builtin-missing-location']) {
      const view = (await app.api.get('/api/views')).body.find((item: { id: string }) => item.id === id);
      const query = new URLSearchParams(
        Object.entries(view.filter).map(([key, value]) => [key, String(value)]),
      );
      expect((await app.api.get(`/api/parts?${query}`)).body.total).toBe(1);
    }
  });
});

describe('misc', () => {
  it('reports health and unknown routes', async () => {
    expect((await app.api.get('/api/health')).body).toEqual({ ok: true });
    const missing = await app.api.get('/api/nothing-here');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('not_found');
    const bad = await app.api.post('/api/parts').set('Content-Type', 'application/json').send('{oops');
    expect(bad.status).toBe(400);
  });
});
