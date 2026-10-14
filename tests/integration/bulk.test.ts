import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { customPart, makeTestApp, officialBrick, type TestApp } from '../helpers/testApp';

let app: TestApp;
beforeEach(() => {
  app = makeTestApp();
});
afterEach(() => app.cleanup());

describe('duplicates and merge', () => {
  it('finds parts with the same design id and color, and merges them', async () => {
    const first = await app.api
      .post('/api/parts')
      .send(officialBrick({ quantity: 4, tags: ['a'], notes: 'one' }));
    const second = await app.api
      .post('/api/parts')
      .send(officialBrick({ quantity: 6, tags: ['b'], notes: 'two' }));
    await app.api.post('/api/parts').send(officialBrick({ color_id: 1 }));
    const groups = await app.api.get('/api/parts/duplicates');
    expect(groups.body).toHaveLength(1);
    expect(groups.body[0]).toMatchObject({ design_id: '3001', color_id: 4, color_name: 'Red' });
    expect(groups.body[0].parts).toHaveLength(2);

    const merged = await app.api
      .post('/api/parts/merge')
      .send({ keep_id: first.body.id, merge_ids: [second.body.id] });
    expect(merged.status).toBe(200);
    expect(merged.body).toMatchObject({ quantity: 10, tags: ['a', 'b'], notes: 'one\n\ntwo' });
    expect((await app.api.get('/api/parts/duplicates')).body).toEqual([]);
    expect((await app.api.get(`/api/parts/${second.body.id}`)).status).toBe(404);

    await app.api.post('/api/history/undo').send({});
    expect((await app.api.get('/api/parts/duplicates')).body).toHaveLength(1);
    expect((await app.api.get(`/api/parts/${first.body.id}`)).body.quantity).toBe(4);
  });

  it('refuses to merge parts that are not duplicates', async () => {
    const a = await app.api.post('/api/parts').send(officialBrick());
    const b = await app.api.post('/api/parts').send(officialBrick({ color_id: 1 }));
    const c = await app.api.post('/api/parts').send(customPart());
    const different = await app.api
      .post('/api/parts/merge')
      .send({ keep_id: a.body.id, merge_ids: [b.body.id] });
    expect(different.status).toBe(400);
    const custom = await app.api
      .post('/api/parts/merge')
      .send({ keep_id: a.body.id, merge_ids: [c.body.id] });
    expect(custom.status).toBe(400);
    const self = await app.api
      .post('/api/parts/merge')
      .send({ keep_id: a.body.id, merge_ids: [a.body.id] });
    expect(self.status).toBe(400);
  });
});

describe('bulk edit', () => {
  it('changes location, quantity and tags for many parts in one undoable step', async () => {
    const bin = (await app.api.post('/api/locations').send({ name: 'Bin' })).body;
    const a = (await app.api.post('/api/parts').send(officialBrick({ tags: ['old'] }))).body;
    const b = (
      await app.api.post('/api/parts').send(officialBrick({ design_id: '3002', quantity: 3 }))
    ).body;

    const moved = await app.api.post('/api/parts/bulk').send({
      ids: [a.id, b.id],
      changes: { location_id: bin.id, add_tags: ['batch'], remove_tags: ['OLD'] },
    });
    expect(moved.body).toEqual({ updated: 2 });
    const parts = (await app.api.get('/api/parts?sort=name')).body.items as Array<{
      location_id: string;
      tags: string[];
    }>;
    expect(parts.every((part) => part.location_id === bin.id)).toBe(true);
    expect(parts.map((part) => part.tags)).toEqual([['batch'], ['batch']]);

    await app.api
      .post('/api/parts/bulk')
      .send({ ids: [a.id, b.id], changes: { quantity_delta: -5 } });
    const after = (await app.api.get(`/api/parts/${b.id}`)).body;
    expect(after.quantity).toBe(0);
    await app.api.post('/api/parts/bulk').send({ ids: [a.id], changes: { quantity: 77 } });
    expect((await app.api.get(`/api/parts/${a.id}`)).body.quantity).toBe(77);

    await app.api.post('/api/history/undo').send({ steps: 3 });
    const restored = (await app.api.get(`/api/parts/${a.id}`)).body;
    expect(restored).toMatchObject({ quantity: 10, location_id: null, tags: ['old'] });
  });

  it('validates the request', async () => {
    const part = (await app.api.post('/api/parts').send(officialBrick())).body;
    expect(
      (await app.api.post('/api/parts/bulk').send({ ids: [], changes: { quantity: 1 } })).status,
    ).toBe(400);
    expect(
      (await app.api.post('/api/parts/bulk').send({ ids: [part.id], changes: {} })).status,
    ).toBe(400);
    expect(
      (
        await app.api
          .post('/api/parts/bulk')
          .send({ ids: [part.id], changes: { location_id: 'nope' } })
      ).status,
    ).toBe(400);
    expect(
      (await app.api.post('/api/parts/bulk').send({ ids: ['nope'], changes: { quantity: 1 } }))
        .status,
    ).toBe(404);
    expect(
      (
        await app.api
          .post('/api/parts/bulk')
          .send({ ids: [part.id], changes: { quantity: 1, quantity_delta: 1 } })
      ).status,
    ).toBe(400);
  });
});
