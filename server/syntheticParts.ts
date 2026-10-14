import type { Database } from 'better-sqlite3';
import { CATEGORIES } from '@shared/constants';
import { ActionRecorder } from './recorder';
import { ensureLocationPath } from './services/importer';
import { rebuildSearchIndex } from './services/searchIndex';

const SHAPES = ['Brick', 'Plate', 'Tile', 'Slope', 'Technic Beam', 'Wheel', 'Round Brick', 'Arch', 'Panel'];
const SIZES = ['1 x 1', '1 x 2', '1 x 4', '2 x 2', '2 x 3', '2 x 4', '2 x 6', '4 x 4', '6 x 6', '8 x 8'];
const WORDS = ['smooth', 'studded', 'worn', 'new', 'rare', 'bulk', 'sorted', 'mixed', 'spare', 'broken'];
const TAGS = Array.from({ length: 24 }, (_, index) => `tag-${index}`);

function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Adds a lot of fake parts quickly (straight SQL, no undo history) for speed tests.
 * Every design id + color pair is different, so there are no duplicates.
 */
export function insertSyntheticParts(db: Database, count: number, customShare = 0.05): number {
  const random = makeRandom(7);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)] as T;
  const colorIds = (db.prepare('SELECT id FROM colors').all() as { id: number }[]).map((row) => row.id);
  const recorder = new ActionRecorder(db, false);
  const cache = new Map<string, string>();
  const locationIds: string[] = [];
  db.transaction(() => {
    for (let room = 1; room <= 4; room++) {
      for (let cabinet = 1; cabinet <= 5; cabinet++) {
        for (let drawer = 1; drawer <= 5; drawer++) {
          for (let bin = 1; bin <= 4; bin++) {
            locationIds.push(
              ensureLocationPath(recorder, `Room ${room} > Cabinet ${cabinet} > Drawer ${drawer} > Bin ${bin}`, cache),
            );
          }
        }
      }
    }
    const tagIds = TAGS.map((name) => {
      const id = crypto.randomUUID();
      db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run(id, name);
      return id;
    });

    const insertPart = db.prepare(`
      INSERT INTO parts (id, kind, name, category, subcategory, color_id, quantity, location_id, notes,
        created_at, updated_at, is_current, design_id, source, material, width_plates, depth_plates,
        height_plates, version, version_group_id)
      VALUES (@id, @kind, @name, @category, @subcategory, @color_id, @quantity, @location_id, @notes,
        @created_at, @created_at, 1, @design_id, @source, @material, @width, @depth, @height, @version, @group)`);
    const insertTag = db.prepare('INSERT OR IGNORE INTO part_tags (part_id, tag_id) VALUES (?, ?)');
    const started = Date.now() - count * 1000;

    for (let index = 0; index < count; index++) {
      const id = crypto.randomUUID();
      const custom = random() < customShare;
      const designNumber = 10000 + Math.floor(index / colorIds.length);
      insertPart.run({
        id,
        kind: custom ? 'custom' : 'official',
        name: `${pick(SHAPES)} ${pick(SIZES)} ${pick(WORDS)} ${index}`,
        category: pick(CATEGORIES),
        subcategory: random() < 0.3 ? pick(WORDS) : null,
        color_id: colorIds[index % colorIds.length],
        quantity: Math.floor(random() * 200),
        location_id: random() < 0.95 ? pick(locationIds) : null,
        notes: random() < 0.3 ? `${pick(WORDS)} ${pick(WORDS)} note` : null,
        created_at: new Date(started + index * 1000).toISOString(),
        design_id: custom ? null : String(designNumber),
        source: custom ? '3d_printed' : null,
        material: custom ? 'PLA' : null,
        width: custom ? 2 : null,
        depth: custom ? 4 : null,
        height: custom ? 3 : null,
        version: custom ? 1 : null,
        group: custom ? id : null,
      });
      if (random() < 0.4) insertTag.run(id, pick(tagIds));
    }
  })();
  rebuildSearchIndex(db);
  return count;
}
