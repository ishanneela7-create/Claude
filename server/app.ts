import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { AppContext } from './db';
import { errorHandler, ApiError } from './http';
import { dataRouter } from './routes/data';
import { locationsRouter } from './routes/locations';
import { lookupsRouter } from './routes/lookups';
import { partsRouter } from './routes/parts';

export function createApp(context: AppContext): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '80mb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true });
  });
  app.use('/api', partsRouter(context));
  app.use('/api', lookupsRouter(context));
  app.use('/api', locationsRouter(context));
  app.use('/api', dataRouter(context));
  app.use('/api', (_request, _response, next) => {
    next(new ApiError(404, 'not_found', 'No such API route'));
  });

  app.use('/photos', express.static(context.photosDir, { maxAge: '7d', immutable: true }));

  const distDir = path.resolve(import.meta.dirname, '../dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^(?!\/api|\/photos).*/, (_request, response) => {
      response.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
