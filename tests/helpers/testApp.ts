import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../../server/app';
import { createContext, type AppContext } from '../../server/db';
import { STARTER_COLORS, seedColors } from '../../server/services/colorSeed';

export interface TestApp {
  context: AppContext;
  api: ReturnType<typeof request>;
  cleanup(): void;
}

/** A fresh app with its own temporary database and the starter colors. */
export function makeTestApp(): TestApp {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lego-test-'));
  const context = createContext(dataDir);
  seedColors(context.db, STARTER_COLORS);
  return {
    context,
    api: request(createApp(context)),
    cleanup() {
      context.db.close();
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

export const officialBrick = (overrides: Record<string, unknown> = {}) => ({
  kind: 'official',
  name: 'Brick 2 x 4',
  category: 'Bricks',
  color_id: 4,
  quantity: 10,
  design_id: '3001',
  tags: [],
  ...overrides,
});

export const customPart = (overrides: Record<string, unknown> = {}) => ({
  kind: 'custom',
  name: 'Printed Brick',
  category: 'Bricks',
  color_id: 1,
  quantity: 2,
  source: '3d_printed',
  material: 'PLA',
  width_plates: 4,
  depth_plates: 2,
  height_plates: 3,
  tags: [],
  ...overrides,
});
