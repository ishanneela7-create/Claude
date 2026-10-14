import type { Database } from 'better-sqlite3';
import { customPartImportSchema } from '@shared/otherSchemas';
import { partInputSchema } from '@shared/partSchemas';
import type { PartRecord } from '@shared/types';
import { badRequest, conflict, parse } from '../http';
import { createCustomColor, findColorByName } from './colors';
import { createPart, getPart } from './parts';
import { listVersions } from './partVersions';

/** Fields that only make sense on this computer, so they are left out of shared files. */
const LOCAL_ONLY = ['id', 'location_id', 'location_path', 'parent_part_id', 'image_path'] as const;

function portable(part: PartRecord): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...part };
  for (const key of LOCAL_ONLY) delete copy[key];
  return copy;
}

export function exportCustomPart(db: Database, id: string): object {
  const part = getPart(db, id);
  if (part.kind !== 'custom') throw conflict('Only custom parts can be exported this way');
  return {
    format: 'lego-library-custom-part',
    formatVersion: 1,
    part: portable(part),
    color: { name: part.color_name, rgb: part.color_rgb },
    versions: listVersions(db, id).map(portable),
  };
}

/** Always creates a new part (never overwrites). The shared color is matched by name or created. */
export function importCustomPart(db: Database, payload: unknown): PartRecord {
  const file = parse(customPartImportSchema, payload);
  let colorId: number | undefined;
  if (file.color) {
    const found = findColorByName(db, file.color.name);
    colorId =
      found?.id ??
      createCustomColor(db, {
        name: file.color.name,
        rgb: file.color.rgb.replace('#', '').toUpperCase(),
        is_transparent: false,
        is_metallic: false,
      }).id;
  }
  const candidate = {
    ...file.part,
    kind: 'custom',
    color_id: colorId ?? file.part.color_id,
    location_id: null,
    parent_part_id: null,
    image_path: null,
    quantity: typeof file.part.quantity === 'number' ? file.part.quantity : 0,
  };
  const input = partInputSchema.safeParse(candidate);
  if (!input.success) throw badRequest('The file does not hold a valid custom part', input.error.issues);
  return createPart(db, input.data);
}
