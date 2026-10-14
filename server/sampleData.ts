import type { Database } from 'better-sqlite3';
import { CATEGORIES } from '@shared/constants';
import type { PartInput } from '@shared/partSchemas';
import { ActionRecorder } from './recorder';
import { ensureLocationPath } from './services/importer';
import { STARTER_COLORS, seedColors } from './services/colorSeed';
import { rebuildSearchIndex } from './services/searchIndex';
import { insertPart } from './services/partWrites';

type Category = (typeof CATEGORIES)[number];

/** [design id, name, category]. Plain descriptions only; no LEGO images or artwork. */
const OFFICIAL_SAMPLES: Array<[string, string, Category]> = [
  ['3001', 'Brick 2 x 4', 'Bricks'],
  ['3002', 'Brick 2 x 3', 'Bricks'],
  ['3003', 'Brick 2 x 2', 'Bricks'],
  ['3004', 'Brick 1 x 2', 'Bricks'],
  ['3005', 'Brick 1 x 1', 'Bricks'],
  ['3010', 'Brick 1 x 4', 'Bricks'],
  ['3020', 'Plate 2 x 4', 'Plates'],
  ['3022', 'Plate 2 x 2', 'Plates'],
  ['3023', 'Plate 1 x 2', 'Plates'],
  ['3024', 'Plate 1 x 1', 'Plates'],
  ['3710', 'Plate 1 x 4', 'Plates'],
  ['3068b', 'Tile 2 x 2', 'Tiles'],
  ['3069b', 'Tile 1 x 2', 'Tiles'],
  ['3070b', 'Tile 1 x 1', 'Tiles'],
  ['3040b', 'Slope 45 2 x 1', 'Slopes'],
  ['3039', 'Slope 45 2 x 2', 'Slopes'],
  ['3037', 'Slope 45 2 x 4', 'Slopes'],
  ['3673', 'Technic Pin', 'Technic'],
  ['3647', 'Technic Gear 8 Tooth', 'Technic'],
  ['32523', 'Technic Beam 3', 'Technic'],
];

const CUSTOM_SAMPLES: Array<[string, Category, string, number, number, number]> = [
  ['Printed Brick 2 x 6', 'Bricks', 'PLA', 6, 2, 3],
  ['Printed Corner Plate', 'Plates', 'PETG', 4, 4, 1],
  ['Resin Curved Slope', 'Slopes', 'resin', 4, 2, 2],
  ['Printed Gear Cover', 'Technic', 'PLA', 3, 3, 3],
  ['Custom Wheel Hub', 'Wheels', 'PETG', 2, 2, 2],
];

const LOCATION_PATHS = [
  'Playroom > Cabinet A > Drawer 1 > Bin 1',
  'Playroom > Cabinet A > Drawer 1 > Bin 2',
  'Playroom > Cabinet A > Drawer 2 > Bin 1',
  'Playroom > Cabinet A > Drawer 2 > Bin 2',
  'Playroom > Cabinet B > Drawer 3 > Bin 1',
  'Garage > Shelf 1 > Box 1',
];

const SAMPLE_COLOR_IDS = STARTER_COLORS.slice(0, 10).map((color) => color.id);
const TAGS = ['favorite', 'rare', 'needs sorting', 'technic build'];

/** Same numbers every time, so the sample library is always the same. */
function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export function insertSampleLibrary(db: Database): void {
  const random = makeRandom(42);
  const pick = <T>(list: T[]): T => list[Math.floor(random() * list.length)] as T;
  const recorder = new ActionRecorder(db, false);
  const locationCache = new Map<string, string>();
  const locationIds = LOCATION_PATHS.map((path) =>
    ensureLocationPath(recorder, path, locationCache),
  );

  db.transaction(() => {
    for (const [designId, name, category] of OFFICIAL_SAMPLES) {
      const colorCount = 2 + Math.floor(random() * 3);
      for (const colorId of [...SAMPLE_COLOR_IDS].sort(() => random() - 0.5).slice(0, colorCount)) {
        const missingLocation = random() < 0.1;
        const input: PartInput = {
          kind: 'official',
          name,
          category,
          subcategory: null,
          color_id: colorId,
          quantity: Math.floor(random() * 60),
          location_id: missingLocation ? null : pick(locationIds),
          notes: null,
          tags: random() < 0.15 ? [pick(TAGS)] : [],
          design_id: designId,
        };
        insertPart(recorder, input);
      }
    }
    insertPart(recorder, {
      kind: 'official',
      name: 'Brick 2 x 4',
      category: 'Bricks',
      color_id: 4,
      quantity: 6,
      location_id: locationIds[0],
      tags: ['needs sorting'],
      design_id: '3001',
    });
    insertPart(recorder, {
      kind: 'official',
      name: 'Brick 2 x 4',
      category: 'Bricks',
      color_id: 4,
      quantity: 9,
      location_id: locationIds[2],
      tags: [],
      design_id: '3001',
    });
    for (const [name, category, material, width, depth, height] of CUSTOM_SAMPLES) {
      insertPart(recorder, {
        kind: 'custom',
        name,
        category,
        color_id: pick(SAMPLE_COLOR_IDS),
        quantity: 1 + Math.floor(random() * 12),
        location_id: pick(locationIds),
        notes: 'Sample custom part. Edit the design to see a new version appear.',
        tags: ['favorite'],
        source: material === 'resin' ? 'scratch_built' : '3d_printed',
        material: material as 'PLA' | 'PETG' | 'resin',
        width_plates: width,
        depth_plates: depth,
        height_plates: height,
        stud_pattern: `${width} x ${depth} grid`,
      });
    }
  })();
  rebuildSearchIndex(db);
}

/** On the very first start there are no parts at all, so we add sample data. */
export async function seedSampleDataIfEmpty(db: Database): Promise<void> {
  const colors = db.prepare('SELECT COUNT(*) AS n FROM colors').get() as { n: number };
  if (colors.n === 0) seedColors(db, STARTER_COLORS);
  const parts = db.prepare('SELECT COUNT(*) AS n FROM parts').get() as { n: number };
  const locations = db.prepare('SELECT COUNT(*) AS n FROM locations').get() as { n: number };
  if (parts.n === 0 && locations.n === 0 && process.env.NO_SAMPLE !== '1') insertSampleLibrary(db);
}
