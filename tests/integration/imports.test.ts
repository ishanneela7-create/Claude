import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp, officialBrick, type TestApp } from '../helpers/testApp';

let app: TestApp;
beforeEach(() => {
  app = makeTestApp();
});
afterEach(() => app.cleanup());

const csv = [
  'Part Name,Design No,Colour,Qty,Bin,Category,Tags',
  'Brick 2 x 4,3001,Red,12,Playroom > Drawer 1,Bricks,sorted;rare',
  'Plate 1 x 2,3023,Blue,5,Playroom > Drawer 1,Plates,',
  'Broken row,3024,Nonexistent Color,1,,,',
  'Tile 1 x 1,3070b,Black,abc,,,',
].join('\n');

describe('CSV import', () => {
  it('previews the first rows with guessed column mapping and errors', async () => {
    const response = await app.api.post('/api/imports/preview').send({ format: 'csv', text: csv });
    expect(response.status).toBe(200);
    expect(response.body.mapping).toMatchObject({
      'Part Name': 'name',
      'Design No': 'design_id',
      Colour: 'color',
      Qty: 'quantity',
      Bin: 'location',
    });
    expect(response.body).toMatchObject({ total_rows: 4, valid_rows: 2 });
    expect(response.body.sample).toHaveLength(4);
    expect(response.body.errors.map((error: { row: number }) => error.row)).toEqual([4, 5]);
  });

  it('limits the preview sample to 20 rows', async () => {
    const lines = ['name,design_id,color,quantity'];
    for (let index = 0; index < 30; index++) lines.push(`Part ${index},${5000 + index},Red,1`);
    const response = await app.api
      .post('/api/imports/preview')
      .send({ format: 'csv', text: lines.join('\n') });
    expect(response.body.sample).toHaveLength(20);
    expect(response.body.total_rows).toBe(30);
  });

  it('imports valid rows, makes locations, and reports bad rows', async () => {
    const response = await app.api
      .post('/api/imports')
      .send({ format: 'csv', text: csv, source_name: 'my.csv' });
    expect(response.status).toBe(201);
    expect(response.body.import).toMatchObject({
      created_count: 2,
      updated_count: 0,
      status: 'done',
    });
    expect(response.body.errors).toHaveLength(2);
    const list = (await app.api.get('/api/parts?sort=name')).body;
    expect(list.total).toBe(2);
    expect(list.items[0]).toMatchObject({
      name: 'Brick 2 x 4',
      quantity: 12,
      location_path: 'Playroom > Drawer 1',
      tags: ['rare', 'sorted'],
    });
    expect((await app.api.get('/api/parts?q=loc:"Drawer 1"')).body.total).toBe(2);
    const log = await app.api.get('/api/imports');
    expect(log.body).toHaveLength(1);
    expect(log.body[0].source_name).toBe('my.csv');
  });

  it('uses your own column mapping', async () => {
    const text = 'a,b,c,d\nBrick,3001,Red,4';
    const mapping = { a: 'name', b: 'design_id', c: 'color', d: 'quantity' };
    const response = await app.api.post('/api/imports').send({ format: 'csv', text, mapping });
    expect(response.body.import.created_count).toBe(1);
    const missing = await app.api
      .post('/api/imports')
      .send({ format: 'csv', text, mapping: { a: 'name', b: 'design_id' } });
    expect(missing.status).toBe(400);
  });

  it('adds quantity to an existing part with the same design id and color', async () => {
    await app.api.post('/api/parts').send(officialBrick({ quantity: 10 }));
    const response = await app.api.post('/api/imports').send({
      format: 'csv',
      text: 'name,design_id,color,quantity\nBrick 2 x 4,3001,Red,5',
    });
    expect(response.body.import).toMatchObject({ created_count: 0, updated_count: 1 });
    expect((await app.api.get('/api/parts')).body.items[0].quantity).toBe(15);
  });

  it('rolls an import back, once', async () => {
    await app.api.post('/api/parts').send(officialBrick({ quantity: 10 }));
    const imported = await app.api.post('/api/imports').send({
      format: 'csv',
      text: 'name,design_id,color,quantity\nBrick 2 x 4,3001,Red,5\nPlate,3023,Blue,2',
    });
    expect((await app.api.get('/api/parts')).body.total).toBe(2);
    const rolled = await app.api.post(`/api/imports/${imported.body.import.id}/rollback`);
    expect(rolled.status).toBe(200);
    expect(rolled.body.status).toBe('rolled_back');
    const parts = (await app.api.get('/api/parts')).body;
    expect(parts.total).toBe(1);
    expect(parts.items[0].quantity).toBe(10);
    expect((await app.api.get('/api/parts?q=plate')).body.total).toBe(0);
    expect((await app.api.post(`/api/imports/${imported.body.import.id}/rollback`)).status).toBe(
      409,
    );
    expect((await app.api.post('/api/imports/nope/rollback')).status).toBe(404);
  });

  it('validates the request and the file', async () => {
    expect((await app.api.post('/api/imports').send({ format: 'xml', text: 'a' })).status).toBe(
      400,
    );
    expect(
      (await app.api.post('/api/imports/preview').send({ format: 'csv', text: '' })).status,
    ).toBe(400);
  });
});

describe('Rebrickable import', () => {
  it('reads Part,Color,Quantity exports using color ids', async () => {
    const text = 'Part,Color,Quantity\n3001,4,20\n3023,1,7\n3001,4,5\n9999,555,1';
    const preview = await app.api
      .post('/api/imports/preview')
      .send({ format: 'rebrickable', text });
    expect(preview.body).toMatchObject({ total_rows: 4, valid_rows: 3 });
    const response = await app.api.post('/api/imports').send({ format: 'rebrickable', text });
    expect(response.body.import).toMatchObject({ created_count: 2, updated_count: 1 });
    const brick = (await app.api.get('/api/parts?q=3001')).body.items[0];
    expect(brick).toMatchObject({
      quantity: 25,
      color_name: 'Red',
      rebrickable_part_num: '3001',
      name: 'Part 3001',
    });
  });

  it('also reads inventory style headers and rejects other files', async () => {
    const text = 'inventory_id,part_num,color_id,quantity,is_spare\n1,3001,4,3,f';
    const response = await app.api.post('/api/imports').send({ format: 'rebrickable', text });
    expect(response.body.import.created_count).toBe(1);
    const wrong = await app.api
      .post('/api/imports')
      .send({ format: 'rebrickable', text: 'a,b\n1,2' });
    expect(wrong.status).toBe(400);
  });
});
