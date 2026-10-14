import { Router } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import {
  idParamSchema,
  locationDeleteQuerySchema,
  locationInputSchema,
  locationMoveSchema,
  locationPatchSchema,
} from '@shared/otherSchemas';
import type { AppContext } from '../db';
import { badRequest, parse } from '../http';
import {
  buildLocationTree,
  createLocation,
  deleteLocation,
  getLocationRow,
  listLocations,
  moveLocation,
  updateLocation,
} from '../services/locations';

const qrQuerySchema = z.object({ base: z.string().url().optional() });

export function locationsRouter({ db }: AppContext): Router {
  const router = Router();

  router.get('/locations', (_request, response) => {
    response.json(buildLocationTree(listLocations(db)));
  });

  router.post('/locations', (request, response) => {
    response.status(201).json(createLocation(db, parse(locationInputSchema, request.body)));
  });

  router.patch('/locations/:id', (request, response) => {
    const { id } = parse(idParamSchema, request.params);
    response.json(updateLocation(db, id, parse(locationPatchSchema, request.body)));
  });

  router.post('/locations/:id/move', (request, response) => {
    const { id } = parse(idParamSchema, request.params);
    response.json(moveLocation(db, id, parse(locationMoveSchema, request.body).parent_id));
  });

  router.delete('/locations/:id', (request, response) => {
    const { id } = parse(idParamSchema, request.params);
    deleteLocation(db, id, parse(locationDeleteQuerySchema, request.query).move_to);
    response.status(204).end();
  });

  /** A printable QR code (SVG) that opens this bin's page. */
  router.get('/locations/:id/qr', async (request, response) => {
    const { id } = parse(idParamSchema, request.params);
    const { base } = parse(qrQuerySchema, request.query);
    getLocationRow(db, id);
    const origin = base ?? `${request.protocol}://${request.get('host') ?? ''}`;
    if (!/^https?:\/\//.test(origin)) throw badRequest('Bad base url');
    const svg = await QRCode.toString(`${origin.replace(/\/$/, '')}/?location=${id}`, {
      type: 'svg',
      margin: 2,
    });
    response.type('image/svg+xml').send(svg);
  });

  return router;
}
