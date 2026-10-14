import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp, officialBrick, type TestApp } from '../helpers/testApp';

let app: TestApp;
beforeEach(() => {
  app = makeTestApp();
});
afterEach(() => app.cleanup());

async function addLocation(name: string, parent_id?: string) {
  const response = await app.api.post('/api/locations').send({ name, parent_id });
  expect(response.status).toBe(201);
  return response.body as { id: string; path?: string };
}

describe('locations', () => {
  it('builds a tree with part counts', async () => {
    const room = await addLocation('Room');
    const cabinet = await addLocation('Cabinet', room.id);
    const bin = await addLocation('Bin 1', cabinet.id);
    await app.api.post('/api/parts').send(officialBrick({ location_id: bin.id, quantity: 4 }));
    const tree = await app.api.get('/api/locations');
    expect(tree.body).toHaveLength(1);
    expect(tree.body[0].total_part_count).toBe(1);
    expect(tree.body[0].children[0].children[0]).toMatchObject({ name: 'Bin 1', part_count: 1 });
    const part = await app.api.get('/api/parts');
    expect(part.body.items[0].location_path).toBe('Room > Cabinet > Bin 1');
  });

  it('moving a bin keeps its parts and updates their path and search', async () => {
    const roomA = await addLocation('Room A');
    const roomB = await addLocation('Room B');
    const bin = await addLocation('Bin 7', roomA.id);
    const created = await app.api.post('/api/parts').send(officialBrick({ location_id: bin.id }));
    const moved = await app.api.post(`/api/locations/${bin.id}/move`).send({ parent_id: roomB.id });
    expect(moved.status).toBe(200);
    const part = await app.api.get(`/api/parts/${created.body.id}`);
    expect(part.body.location_id).toBe(bin.id);
    expect(part.body.location_path).toBe('Room B > Bin 7');
    expect((await app.api.get('/api/parts?q=loc:"Room B"')).body.total).toBe(1);
    expect((await app.api.get('/api/parts?q=loc:"Room A"')).body.total).toBe(0);
    expect((await app.api.get(`/api/parts?location_id=${roomB.id}`)).body.total).toBe(1);
  });

  it('refuses to move a location inside itself', async () => {
    const room = await addLocation('Room');
    const child = await addLocation('Child', room.id);
    const response = await app.api.post(`/api/locations/${room.id}/move`).send({ parent_id: child.id });
    expect(response.status).toBe(400);
  });

  it('renames and updates label and color', async () => {
    const room = await addLocation('Room');
    const child = await addLocation('Child', room.id);
    await app.api.patch(`/api/locations/${room.id}`).send({ name: 'Den', label: 'D', color_code: '#00AA55' });
    const tree = await app.api.get('/api/locations');
    expect(tree.body[0]).toMatchObject({ name: 'Den', label: 'D', color_code: '00AA55' });
    const part = await app.api.post('/api/parts').send(officialBrick({ location_id: child.id }));
    expect((await app.api.get(`/api/parts/${part.body.id}`)).body.location_path).toBe('Den > Child');
    expect((await app.api.patch(`/api/locations/${room.id}`).send({ parent_id: null })).status).toBe(400);
  });

  it('will not delete a location that still holds things, unless contents move', async () => {
    const room = await addLocation('Room');
    const bin = await addLocation('Bin', room.id);
    const other = await addLocation('Other');
    const part = await app.api.post('/api/parts').send(officialBrick({ location_id: bin.id }));
    const blocked = await app.api.delete(`/api/locations/${room.id}`);
    expect(blocked.status).toBe(409);
    const moved = await app.api.delete(`/api/locations/${room.id}?move_to=${other.id}`);
    expect(moved.status).toBe(204);
    const found = await app.api.get(`/api/parts/${part.body.id}`);
    expect(found.body.location_path).toBe('Other > Bin');
    const empty = await app.api.delete(`/api/locations/${other.id}?move_to=${other.id}`);
    expect(empty.status).toBe(400);
  });

  it('returns a QR code image', async () => {
    const room = await addLocation('Room');
    const response = await app.api.get(`/api/locations/${room.id}/qr?base=http://localhost:5173`);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('image/svg+xml');
    expect(response.body.toString()).toContain('<svg');
    expect((await app.api.get('/api/locations/nope/qr')).status).toBe(404);
  });

  it('validates input', async () => {
    expect((await app.api.post('/api/locations').send({ name: '' })).status).toBe(400);
    expect((await app.api.post('/api/locations').send({ name: 'X', parent_id: 'missing' })).status).toBe(404);
  });
});
