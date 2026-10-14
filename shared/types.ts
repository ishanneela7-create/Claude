import type { PartInput } from './partSchemas';

export interface ColorRecord {
  id: number;
  name: string;
  rgb: string;
  is_transparent: boolean;
  is_metallic: boolean;
  is_custom: boolean;
}

export interface LocationRecord {
  id: string;
  parent_id: string | null;
  name: string;
  level_label: string | null;
  label: string | null;
  color_code: string | null;
  part_count: number;
}

export interface LocationNode extends LocationRecord {
  children: LocationNode[];
  /** Parts in this location plus every location below it. */
  total_part_count: number;
}

export interface TagRecord {
  id: string;
  name: string;
  part_count: number;
}

export interface PhotoRecord {
  id: string;
  part_id: string;
  url: string;
  thumb_url: string;
  width: number;
  height: number;
}

export interface PartRecord {
  id: string;
  kind: PartInput['kind'];
  name: string;
  category: string;
  subcategory: string | null;
  color_id: number;
  color_name: string;
  color_rgb: string;
  color_is_transparent: boolean;
  quantity: number;
  location_id: string | null;
  location_path: string;
  notes: string | null;
  image_path: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  design_id: string | null;
  rebrickable_part_num: string | null;
  ldraw_id: string | null;
  year_introduced: number | null;
  source: string | null;
  creator: string | null;
  width_plates: number | null;
  depth_plates: number | null;
  height_plates: number | null;
  stud_pattern: string | null;
  material: string | null;
  print_profile_notes: string | null;
  version: number | null;
  version_group_id: string | null;
  is_current: boolean;
  parent_part_id: string | null;
}

export interface PartListResult {
  items: PartRecord[];
  total: number;
  offset: number;
  limit: number;
}

export interface DuplicateGroup {
  design_id: string;
  color_id: number;
  color_name: string;
  parts: PartRecord[];
}

export interface SmartViewRecord {
  id: string;
  name: string;
  filter: Record<string, unknown>;
  is_builtin: boolean;
}

export interface HistoryEntry {
  id: number;
  label: string;
  undone: boolean;
  created_at: string;
}

export interface ImportRecord {
  id: string;
  source_name: string;
  format: string;
  row_count: number;
  created_count: number;
  updated_count: number;
  status: 'done' | 'rolled_back';
  created_at: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
