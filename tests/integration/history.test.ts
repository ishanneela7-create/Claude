import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { customPart, makeTestApp, officialBrick, type TestApp } from '../helpers/testApp';

let app: TestApp;
beforeEach(() => {
  app = makeTestApp();
});
afterEach(() => app.cleanup());

const total = async () => (await app.api.get('/api/parts')).body.total as number;

describe('undo and redo', () => {
  it('undoes and redoes creating a part (and keeps search in sync)', async () => {
    await app.api.post('/api/parts').send(officialBrick({ tags: ['rare'] }));
    expect(await total()).toBe(1);
    const undo = await app.api.post('/api/history/undo').send({});
    expect(undo.body).toHaveLength(1);
    expect(await total()).toBe(0);
    expect((await app.api.get('/api/parts?q=brick')).body.total).toBe(0);
    await app.api.post('/api/history/redo').send({});
    expect(await total()).toBe(1);
    expect((await app.api.get('/api/parts?q=brick')).body.total).toBe(1);
    expect((await app.api.get('/api/parts?q=tag:rare')).body.total).toBe(1);
  });

  it('undoes edits, tag changes and deletes', async () => {
    const part = await app.api.post('/api/parts').send(officialBrick({ tags: ['a'] }));
    await app.api.patch(`/api/parts/${part.body.id}`).send({ quantity: 99, tags: ['b'] });
    await app.api.post('/api/history/undo').send({});
    let current = (await app.api.get(`/api/parts/${part.body.id}`)).body;
    expect(current).toMatchObject({ quantity: 10, tags: ['a'] });
    await app.api.post('/api/history/redo').send({});
    current = (await app.api.get(`/api/parts/${part.body.id}`)).body;
    expect(current).toMatchObject({ quantity: 99, tags: ['b'] });

    await app.api.delete(`/api/parts/${part.body.id}`);
    expect(await total()).toBe(0);
    await app.api.post('/api/history/undo').send({});
    expect(await total()).toBe(1);
  });

  it('undoes a new custom version as one step', async () => {
    const part = await app.api.post('/api/parts').send(customPart());
    await app.api.patch(`/api/parts/${part.body.id}`).send({ stud_pattern: 'new' });
    await app.api.post('/api/history/undo').send({});
    const list = await app.api.get('/api/parts');
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ id: part.body.id, version: 1, is_current: true });
  });

  it('undoes location moves and deleting a tag', async () => {
    const a = (await app.api.post('/api/locations').send({ name: 'A' })).body;
    const b = (await app.api.post('/api/locations').send({ name: 'B' })).body;
    const part = await app.api
      .post('/api/parts')
      .send(officialBrick({ location_id: b.id, tags: ['x'] }));
    await app.api.post(`/api/locations/${b.id}/move`).send({ parent_id: a.id });
    expect((await app.api.get(`/api/parts/${part.body.id}`)).body.location_path).toBe('A > B');
    await app.api.post('/api/history/undo').send({});
    expect((await app.api.get(`/api/parts/${part.body.id}`)).body.location_path).toBe('B');
    expect((await app.api.get('/api/parts?q=loc:A')).body.total).toBe(0);

    const tags = (await app.api.get('/api/tags')).body;
    await app.api.delete(`/api/tags/${tags[0].id}`);
    expect((await app.api.get(`/api/parts/${part.body.id}`)).body.tags).toEqual([]);
    await app.api.post('/api/history/undo').send({});
    expect((await app.api.get(`/api/parts/${part.body.id}`)).body.tags).toEqual(['x']);
  });

  it('clears redo after a new edit and lists history', async () => {
    await app.api.post('/api/parts').send(officialBrick({ name: 'One' }));
    await app.api.post('/api/history/undo').send({});
    await app.api.post('/api/parts').send(officialBrick({ name: 'Two', design_id: '3002' }));
    expect((await app.api.post('/api/history/redo').send({})).body).toEqual([]);
    const history = await app.api.get('/api/history');
    expect(history.body).toHaveLength(1);
    expect(history.body[0].label).toContain('Two');
  });

  it('keeps only the last 100 actions', async () => {
    for (let index = 0; index < 105; index++) {
      await app.api.post('/api/tags').send({ name: `tag-${index}` });
    }
    expect((await app.api.get('/api/history')).body).toHaveLength(100);
  });

  it('does nothing when there is nothing to undo, and checks input', async () => {
    expect((await app.api.post('/api/history/undo').send({})).body).toEqual([]);
    expect((await app.api.post('/api/history/undo').send({ steps: 0 })).status).toBe(400);
    await app.api.post('/api/parts').send(officialBrick());
    await app.api.post('/api/parts').send(officialBrick({ design_id: '3002' }));
    expect((await app.api.post('/api/history/undo').send({ steps: 5 })).body).toHaveLength(2);
    expect((await app.api.post('/api/history/redo').send({ steps: 2 })).body).toHaveLength(2);
  });
});
