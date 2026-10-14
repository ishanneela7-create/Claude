import { Router } from 'express';
import { historyActionSchema, importPreviewSchema, importRunSchema } from '@shared/importSchemas';
import { idParamSchema } from '@shared/otherSchemas';
import type { AppContext } from '../db';
import { parse } from '../http';
import { exportCsv, exportJson, exportSqliteBackup } from '../services/exporter';
import { listHistory, moveHistory } from '../services/history';
import { listImports, previewImport, rollbackImport, runImport } from '../services/importer';

const previewSchema = importPreviewSchema.extend({
  mapping: importRunSchema.shape.mapping,
});

export function dataRouter({ db, dataDir }: AppContext): Router {
  const router = Router();

  router.get('/history', (_request, response) => {
    response.json(listHistory(db));
  });
  router.post('/history/undo', (request, response) => {
    const { steps } = parse(historyActionSchema, request.body ?? {});
    response.json(moveHistory(db, 'undo', steps));
  });
  router.post('/history/redo', (request, response) => {
    const { steps } = parse(historyActionSchema, request.body ?? {});
    response.json(moveHistory(db, 'redo', steps));
  });

  router.post('/imports/preview', (request, response) => {
    response.json(previewImport(db, parse(previewSchema, request.body)));
  });
  router.post('/imports', (request, response) => {
    response.status(201).json(runImport(db, parse(importRunSchema, request.body)));
  });
  router.get('/imports', (_request, response) => {
    response.json(listImports(db));
  });
  router.post('/imports/:id/rollback', (request, response) => {
    response.json(rollbackImport(db, parse(idParamSchema, request.params).id));
  });

  router.get('/export/csv', (_request, response) => {
    response.type('text/csv').attachment('lego-library.csv').send(exportCsv(db));
  });
  router.get('/export/json', (_request, response) => {
    response.attachment('lego-library.json').json(exportJson(db));
  });
  router.get('/export/sqlite', async (_request, response) => {
    const file = await exportSqliteBackup(db, dataDir);
    response.download(file, 'lego-library-backup.db', (error) => {
      if (error && !response.headersSent) response.status(500).end();
    });
  });

  return router;
}
