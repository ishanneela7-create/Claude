import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { customPart, makeTestApp, officialBrick, type TestApp } from '../helpers/testApp';

let app: TestApp;
beforeEach(() => {
  app = makeTestApp();
});
afterEach(() => app.cleanup());

describe('POST /api/parts', () => {
  it('creates an official part with its color and tags', async () => {
    const response = await app.api.post('/api/parts').send(officialBrick({ tags: ['rare', 'Rare'] }));
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      kind: 'official',
      design_id: '3001',
      color_name: 'Red',
      color_rgb: 'C91A09',
      quantity: 10,
      tags: ['rare'],
    });
  });

  it('rejects bad data with readable details', async () => {
    const response = await app.api.post('/api/parts').send({ kind: 'official', name: '' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_error');
    expect(response.body.error.details.length).toBeGreaterThan(0);
  });

  it('rejects an unknown color and an unknown location', async () => {
    const badColor = await app.api.post('/api/parts').send(officialBrick({ color_id: 99999 }));
    expect(badColor.status).toBe(400);
    const badLocation = await app.api.post('/api/parts').send(officialBrick({ location_id: 'nope' }));
    expect(badLocation.status).toBe(400);
  });

  it('creates a custom part starting at version 1', async () => {
    const response = await app.api.post('/api/parts').send(customPart());
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ kind: 'custom', version: 1, is_current: true });
    expect(response.body.version_group_id).toBe(response.body.id);
  });

  it('requires a design id for official parts', async () => {
    const { design_id: _removed, ...rest } = officialBrick();
    void _removed;
    const response = await app.api.post('/api/parts').send(rest);
    expect(response.status).toBe(400);
  });
});

describe('GET /api/parts/:id', () => {
  it('returns the part with photos, and 404 for unknown ids', async () => {
    const created = await app.api.post('/api/parts').send(officialBrick());
    const found = await app.api.get(`/api/parts/${created.body.id}`);
    expect(found.status).toBe(200);
    expect(found.body.photos).toEqual([]);
    const missing = await app.api.get('/api/parts/does-not-exist');
    expect(missing.status).toBe(404);
  });
});

describe('PATCH /api/parts/:id', () => {
  it('edits an official part in place', async () => {
    const created = await app.api.post('/api/parts').send(officialBrick());
    const response = await app.api
      .patch(`/api/parts/${created.body.id}`)
      .send({ quantity: 25, tags: ['sorted'] });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: created.body.id, quantity: 25, tags: ['sorted'] });
  });

  it('refuses custom-only fields on an official part', async () => {
    const created = await app.api.post('/api/parts').send(officialBrick());
    const response = await app.api.patch(`/api/parts/${created.body.id}`).send({ material: 'PLA' });
    expect(response.status).toBe(400);
  });

  it('refuses unknown fields', async () => {
    const created = await app.api.post('/api/parts').send(officialBrick());
    const response = await app.api.patch(`/api/parts/${created.body.id}`).send({ bogus: 1 });
    expect(response.status).toBe(400);
  });

  it('creates a new version when a custom part design changes', async () => {
    const created = await app.api.post('/api/parts').send(customPart({ tags: ['printed'] }));
    const edited = await app.api
      .patch(`/api/parts/${created.body.id}`)
      .send({ stud_pattern: '2 x 4 grid', width_plates: 6 });
    expect(edited.status).toBe(200);
    expect(edited.body.id).not.toBe(created.body.id);
    expect(edited.body).toMatchObject({ version: 2, is_current: true, tags: ['printed'] });

    const versions = await app.api.get(`/api/parts/${edited.body.id}/versions`);
    expect(versions.body.map((part: { version: number }) => part.version)).toEqual([2, 1]);
    const old = await app.api.get(`/api/parts/${created.body.id}`);
    expect(old.body).toMatchObject({ version: 1, is_current: false, width_plates: 4 });

    const list = await app.api.get('/api/parts?custom=true');
    expect(list.body.total).toBe(1);
    const editOld = await app.api.patch(`/api/parts/${created.body.id}`).send({ name: 'x' });
    expect(editOld.status).toBe(409);
  });

  it('changes quantity of a custom part without making a version', async () => {
    const created = await app.api.post('/api/parts').send(customPart());
    const edited = await app.api.patch(`/api/parts/${created.body.id}`).send({ quantity: 9 });
    expect(edited.body).toMatchObject({ id: created.body.id, version: 1, quantity: 9 });
  });
});

describe('DELETE /api/parts/:id', () => {
  it('hides the part but keeps the row', async () => {
    const created = await app.api.post('/api/parts').send(officialBrick());
    const response = await app.api.delete(`/api/parts/${created.body.id}`);
    expect(response.status).toBe(204);
    expect((await app.api.get(`/api/parts/${created.body.id}`)).status).toBe(404);
    const row = app.context.db.prepare('SELECT deleted_at FROM parts WHERE id = ?').get(created.body.id);
    expect(row).toMatchObject({ deleted_at: expect.any(String) });
  });
});

describe('custom part files', () => {
  it('exports a custom part and imports it back as a new part', async () => {
    const created = await app.api.post('/api/parts').send(customPart({ name: 'Shared Gear' }));
    const exported = await app.api.get(`/api/parts/${created.body.id}/export`);
    expect(exported.status).toBe(200);
    expect(exported.body.format).toBe('lego-library-custom-part');
    const imported = await app.api.post('/api/parts/import-custom').send(exported.body);
    expect(imported.status).toBe(201);
    expect(imported.body.id).not.toBe(created.body.id);
    expect(imported.body).toMatchObject({ name: 'Shared Gear', version: 1 });
  });

  it('refuses to export an official part and bad import files', async () => {
    const official = await app.api.post('/api/parts').send(officialBrick());
    expect((await app.api.get(`/api/parts/${official.body.id}/export`)).status).toBe(409);
    expect((await app.api.post('/api/parts/import-custom').send({ format: 'nope' })).status).toBe(400);
  });

  it('versions only exist for custom parts', async () => {
    const official = await app.api.post('/api/parts').send(officialBrick());
    expect((await app.api.get(`/api/parts/${official.body.id}/versions`)).status).toBe(409);
  });
});
