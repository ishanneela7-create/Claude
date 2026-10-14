export const CATEGORIES = [
  'Bricks',
  'Plates',
  'Tiles',
  'Slopes',
  'Technic',
  'Wheels',
  'Minifig Parts',
  'Specialty',
] as const;

export const PART_KINDS = ['official', 'custom'] as const;
export const CUSTOM_SOURCES = [
  '3d_printed',
  'modified_official',
  'scratch_built',
  'other',
] as const;
export const MATERIALS = ['PLA', 'PETG', 'resin', 'other'] as const;

export const CUSTOM_SOURCE_LABELS: Record<(typeof CUSTOM_SOURCES)[number], string> = {
  '3d_printed': '3D printed',
  modified_official: 'Modified official',
  scratch_built: 'Scratch-built',
  other: 'Other',
};

export const MAX_PHOTOS_PER_PART = 10;
export const PHOTO_MAX_WIDTH = 1024;
export const THUMBNAIL_WIDTH = 256;
export const HISTORY_LIMIT = 100;
export const LOW_STOCK_THRESHOLD = 5;
export const SEARCH_DEBOUNCE_MS = 150;
export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 500;
/** Custom colors get ids at or above this, so they never clash with Rebrickable ids. */
export const CUSTOM_COLOR_ID_START = 100000;

/** Real LEGO sizes: one stud is 8mm wide; one plate is 3.2mm tall. */
export const STUD_PITCH_MM = 8;
export const PLATE_HEIGHT_MM = 3.2;

export const SORT_FIELDS = [
  'category',
  'color',
  'name',
  'quantity',
  'location',
  'created_at',
] as const;

export const GROUP_FIELDS = ['category', 'color', 'location', 'kind', 'subcategory'] as const;
