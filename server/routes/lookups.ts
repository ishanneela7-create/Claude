import { Router } from 'express';
import {
  colorIdParamSchema,
  colorInputSchema,
  colorPatchSchema,
  idParamSchema,
  tagInputSchema,
} from '@shared/otherSchemas';
import { smartViewInputSchema } from '@shared/querySchemas';
import type { AppContext } from '../db';
import { parse } from '../http';
import {
  createCustomColor,
  deleteCustomColor,
  getColor,
  listColors,
  updateCustomColor,
} from '../services/colors';
import {
  createSmartView,
  deleteSmartView,
  listSmartViews,
  updateSmartView,
} from '../services/smartViews';
import { createTag, deleteTag, listTags, renameTag } from '../services/tags';

export function lookupsRouter({ db }: AppContext): Router {
  const router = Router();

  router.get('/colors', (_request, response) => {
    response.json(listColors(db));
  });
  router.get('/colors/:id', (request, response) => {
    response.json(getColor(db, parse(colorIdParamSchema, request.params).id));
  });
  router.post('/colors', (request, response) => {
    response.status(201).json(createCustomColor(db, parse(colorInputSchema, request.body)));
  });
  router.patch('/colors/:id', (request, response) => {
    const { id } = parse(colorIdParamSchema, request.params);
    response.json(updateCustomColor(db, id, parse(colorPatchSchema, request.body)));
  });
  router.delete('/colors/:id', (request, response) => {
    deleteCustomColor(db, parse(colorIdParamSchema, request.params).id);
    response.status(204).end();
  });

  router.get('/tags', (_request, response) => {
    response.json(listTags(db));
  });
  router.post('/tags', (request, response) => {
    response.status(201).json(createTag(db, parse(tagInputSchema, request.body).name));
  });
  router.patch('/tags/:id', (request, response) => {
    const { id } = parse(idParamSchema, request.params);
    response.json(renameTag(db, id, parse(tagInputSchema, request.body).name));
  });
  router.delete('/tags/:id', (request, response) => {
    deleteTag(db, parse(idParamSchema, request.params).id);
    response.status(204).end();
  });

  router.get('/views', (_request, response) => {
    response.json(listSmartViews(db));
  });
  router.post('/views', (request, response) => {
    response.status(201).json(createSmartView(db, parse(smartViewInputSchema, request.body)));
  });
  router.patch('/views/:id', (request, response) => {
    const { id } = parse(idParamSchema, request.params);
    response.json(updateSmartView(db, id, parse(smartViewInputSchema.partial(), request.body)));
  });
  router.delete('/views/:id', (request, response) => {
    deleteSmartView(db, parse(idParamSchema, request.params).id);
    response.status(204).end();
  });

  return router;
}
