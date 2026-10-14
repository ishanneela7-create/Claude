import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { customPart, makeTestApp, officialBrick, type TestApp } from '../helpers/testApp';

let app: TestApp;
let drawerId: string;

async function search(q: string, extra = '') {
  const response = await app.api.get(`/api/parts?q=${encodeURIComponent(q)}${extra}`);
  expect(response.status).toBe(200);
  return response.body as { total: number; items: Array<{ name: string; quantity: number }> };
}

beforeEach(async () => {
  app = makeTestApp();
  const drawer = await app.api.post('/api/locations').send({ name: 'Drawer 3' });
  drawerId = drawer.body.id;
  await app.api
    .post('/api/parts')
    .send(
      officialBrick({
        name: 'Brick 2 x 4',
        quantity: 10,
        tags: ['favorite'],
        location_id: drawerId,
      }),
    );
  await app.api
    .post('/api/parts')
    .send(
      officialBrick({
        name: 'Plate 1 x 2',
        category: 'Plates',
        design_id: '3023',
        color_id: 1,
        quantity: 3,
      }),
    );
  await app.api
    .post('/api/parts')
    .send(customPart({ name: 'Printed Slope', category: 'Slopes', notes: 'rough surface' }));
});
afterEach(() => app.cleanup());

describe('search', () => {
  it('finds by name, design id, notes, category and tag', async () => {
    expect((await search('brick')).total).toBe(1);
    expect((await search('3023')).items[0]?.name).toBe('Plate 1 x 2');
    expect((await search('rough')).items[0]?.name).toBe('Printed Slope');
    expect((await search('plates')).total).toBe(1);
    expect((await search('favorite')).items[0]?.name).toBe('Brick 2 x 4');
  });

  it('matches word starts while typing', async () => {
    expect((await search('bri')).total).toBe(1);
    expect((await search('Drawer 3')).total).toBe(1);
  });

  it('supports the color, cat, loc, qty and custom operators', async () => {
    expect((await search('color:red')).items.map((part) => part.name)).toEqual(['Brick 2 x 4']);
    expect((await search('cat:plates')).items.map((part) => part.name)).toEqual(['Plate 1 x 2']);
    expect((await search('loc:"Drawer 3"')).total).toBe(1);
    expect((await search('qty:>5')).total).toBe(1);
    expect((await search('qty:<=3')).total).toBe(2);
    expect((await search('custom:true')).items.map((part) => part.name)).toEqual(['Printed Slope']);
    expect((await search('custom:false')).total).toBe(2);
    expect((await search('color:blue custom:true')).total).toBe(1);
  });

  it('forgives small typos when nothing else matches', async () => {
    expect((await search('brik')).items[0]?.name).toBe('Brick 2 x 4');
  });

  it('is safe against odd characters', async () => {
    expect((await search('"')).total).toBe(3);
    expect((await search('brick) OR (')).total).toBeGreaterThanOrEqual(0);
  });

  it('sorts, pages and groups', async () => {
    const byQuantity = await app.api.get('/api/parts?sort=quantity&dir=desc');
    expect(byQuantity.body.items[0].quantity).toBe(10);
    const page = await app.api.get('/api/parts?limit=1&offset=1');
    expect(page.body.items).toHaveLength(1);
    expect(page.body.total).toBe(3);
    const groups = await app.api.get('/api/parts/groups?group=category');
    expect(groups.body).toEqual([
      { key: 'Bricks', count: 1 },
      { key: 'Plates', count: 1 },
      { key: 'Slopes', count: 1 },
    ]);
    expect((await app.api.get('/api/parts/groups?group=bogus')).status).toBe(400);
    expect((await app.api.get('/api/parts?sort=bogus')).status).toBe(400);
  });

  it('filters by saved-view style flags', async () => {
    expect((await app.api.get('/api/parts?low_stock=true')).body.total).toBe(2);
    expect((await app.api.get('/api/parts?missing_location=true')).body.total).toBe(2);
    expect((await app.api.get(`/api/parts?location_id=${drawerId}`)).body.total).toBe(1);
    expect((await app.api.get('/api/parts?kind=custom')).body.total).toBe(1);
  });

  it('returns ids and stats', async () => {
    expect((await app.api.get('/api/parts/ids')).body).toHaveLength(3);
    expect((await app.api.get('/api/parts/stats')).body).toEqual({ parts: 3, pieces: 15 });
  });
});
