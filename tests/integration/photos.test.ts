import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { customPart, makeTestApp, type TestApp } from '../helpers/testApp';

let app: TestApp;
beforeEach(() => {
  app = makeTestApp();
});
afterEach(() => app.cleanup());

async function bigImage(width = 2400, height = 1200) {
  return sharp({ create: { width, height, channels: 3, background: '#2266cc' } }).png().toBuffer();
}

describe('photos', () => {
  it('resizes uploads to 1024px wide and makes a thumbnail', async () => {
    const part = (await app.api.post('/api/parts').send(customPart())).body;
    const response = await app.api
      .post(`/api/parts/${part.id}/photos`)
      .attach('photo', await bigImage(), 'big.png');
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ width: 1024, height: 512 });
    const saved = await sharp(path.join(app.context.photosDir, `${response.body.id}.webp`)).metadata();
    expect(saved.width).toBe(1024);
    const thumb = await sharp(path.join(app.context.photosDir, `${response.body.id}_thumb.webp`)).metadata();
    expect(thumb.width).toBe(256);
    const detail = (await app.api.get(`/api/parts/${part.id}`)).body;
    expect(detail.photos).toHaveLength(1);
    expect(detail.image_path).toBe(response.body.thumb_url);
    const served = await app.api.get(response.body.url);
    expect(served.status).toBe(200);
  });

  it('does not enlarge small images', async () => {
    const part = (await app.api.post('/api/parts').send(customPart())).body;
    const response = await app.api
      .post(`/api/parts/${part.id}/photos`)
      .attach('photo', await bigImage(300, 200), 'small.png');
    expect(response.body.width).toBe(300);
  });

  it('allows at most 10 photos per part', async () => {
    const part = (await app.api.post('/api/parts').send(customPart())).body;
    const image = await bigImage(100, 100);
    for (let index = 0; index < 10; index++) {
      const ok = await app.api.post(`/api/parts/${part.id}/photos`).attach('photo', image, 'a.png');
      expect(ok.status).toBe(201);
    }
    const eleventh = await app.api.post(`/api/parts/${part.id}/photos`).attach('photo', image, 'a.png');
    expect(eleventh.status).toBe(409);
  });

  it('rejects files that are not images and missing files', async () => {
    const part = (await app.api.post('/api/parts').send(customPart())).body;
    const text = await app.api
      .post(`/api/parts/${part.id}/photos`)
      .attach('photo', Buffer.from('hello'), 'note.png');
    expect(text.status).toBe(400);
    expect((await app.api.post(`/api/parts/${part.id}/photos`)).status).toBe(400);
    const unknown = await app.api
      .post('/api/parts/nope/photos')
      .attach('photo', await bigImage(50, 50), 'a.png');
    expect(unknown.status).toBe(404);
  });

  it('removes a photo from the part but keeps the file, and undo brings it back', async () => {
    const part = (await app.api.post('/api/parts').send(customPart())).body;
    const photo = (
      await app.api.post(`/api/parts/${part.id}/photos`).attach('photo', await bigImage(80, 80), 'a.png')
    ).body;
    expect((await app.api.delete(`/api/parts/${part.id}/photos/${photo.id}`)).status).toBe(204);
    expect((await app.api.get(`/api/parts/${part.id}`)).body).toMatchObject({ photos: [], image_path: null });
    expect(fs.existsSync(path.join(app.context.photosDir, `${photo.id}.webp`))).toBe(true);
    expect((await app.api.delete(`/api/parts/${part.id}/photos/${photo.id}`)).status).toBe(404);
    await app.api.post('/api/history/undo').send({});
    expect((await app.api.get(`/api/parts/${part.id}`)).body.photos).toHaveLength(1);
  });

  it('carries photos over to a new version', async () => {
    const part = (await app.api.post('/api/parts').send(customPart())).body;
    await app.api.post(`/api/parts/${part.id}/photos`).attach('photo', await bigImage(80, 80), 'a.png');
    const next = (await app.api.patch(`/api/parts/${part.id}`).send({ stud_pattern: 'x' })).body;
    const detail = (await app.api.get(`/api/parts/${next.id}`)).body;
    expect(detail.photos).toHaveLength(1);
    expect(detail.image_path).toBeTruthy();
  });
});
