import { initialMigration } from './001_initial';
import { searchMigration } from './002_search';
import { builtinViewsMigration } from './003_builtin_views';
import { speedIndexesMigration } from './004_speed_indexes';
import type { Migration } from './types';

export const MIGRATIONS: Migration[] = [
  initialMigration,
  searchMigration,
  builtinViewsMigration,
  speedIndexesMigration,
];
