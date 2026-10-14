import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { GROUP_FIELDS, MAX_PHOTOS_PER_PART } from '@shared/constants';
import { idParamSchema } from '@shared/otherSchemas';
import { bulkEditSchema, mergeSchema, partInputSchema, partPatchSchema } from '@shared/partSchemas';
import { partFilterSchema, partListQuerySchema } from '@shared/querySchemas';
import type { AppContext } from '../db';
import { badRequest, parse } from '../http';
import { exportCustomPart, importCustomPart } from '../services/customPartFiles';
import { bulkEditParts, findDuplicateGroups, mergeParts } from '../services/partBulk';
import { countGroups, listPartIds, listParts, totalsFor } from '../services/partQuery';
import { listVersions } from '../services/partVersions';
import { createPart, deletePart, getPart, updatePart } from '../services/parts';
import { addPhoto, listPhotos, removePhoto } from '../services/photos';

const groupQuerySchema = partFilterSchema.extend({ group: z.enum(GROUP_FIELDS) });
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});

export function partsRouter({ db, photosDir }: AppContext): Router {
  const router = Router();

  router.get('/parts', (request, response) => {
    const query = parse(partListQuerySchema, request.query);
    const group = GROUP_FIELDS.find((field) => field === request.query.group);
    response.json(listParts(db, query, group));
  });

  router.get('/parts/groups', (request, response) => {
    const { group, ...filter } = parse(groupQuerySchema, request.query);
    response.json(countGroups(db, filter, group));
  });

  router.get('/parts/ids', (request, response) => {
    response.json(listPartIds(db, parse(partFilterSchema, request.query)));
  });

  router.get('/parts/stats', (_request, response) => {
    response.json(totalsFor(db));
  });

  router.get('/parts/duplicates', (_request, response) => {
    response.json(findDuplicateGroups(db));
  });

  router.post('/parts/bulk', (request, response) => {
    response.json(bulkEditParts(db, parse(bulkEditSchema, request.body)));
  });

  router.post('/parts/merge', (request, response) => {
    response.json(mergeParts(db, parse(mergeSchema, request.body)));
  });

  router.post('/parts/import-custom', (request, response) => {
    response.status(201).json(importCustomPart(db, request.body));
  });

  router.post('/parts', (request, response) => {
    response.status(201).json(createPart(db, parse(partInputSchema, request.body)));
  });

  router.get('/parts/:id', (request, response) => {
    const { id } = parse(idParamSchema, request.params);
    response.json({ ...getPart(db, id), photos: listPhotos(db, id) });
  });

  router.patch('/parts/:id', (request, response) => {
    const { id } = parse(idParamSchema, request.params);
    response.json(updatePart(db, id, parse(partPatchSchema, request.body)));
  });

  router.delete('/parts/:id', (request, response) => {
    const { id } = parse(idParamSchema, request.params);
    deletePart(db, id);
    response.status(204).end();
  });

  router.get('/parts/:id/versions', (request, response) => {
    const { id } = parse(idParamSchema, request.params);
    response.json(listVersions(db, id));
  });

  router.get('/parts/:id/export', (request, response) => {
    const { id } = parse(idParamSchema, request.params);
    const file = exportCustomPart(db, id);
    response.setHeader('Content-Disposition', `attachment; filename="custom-part-${id}.json"`);
    response.json(file);
  });

  router.post('/parts/:id/photos', photoUpload.single('photo'), async (request, response) => {
    const { id } = parse(idParamSchema, request.params);
    if (!request.file)
      throw badRequest(`Send one image in the "photo" field (max ${MAX_PHOTOS_PER_PART} per part)`);
    response.status(201).json(await addPhoto(db, photosDir, id, request.file.buffer));
  });

  router.delete('/parts/:id/photos/:photoId', (request, response) => {
    const params = parse(idParamSchema.extend({ photoId: z.string().min(1) }), request.params);
    removePhoto(db, params.id, params.photoId);
    response.status(204).end();
  });

  return router;
}
