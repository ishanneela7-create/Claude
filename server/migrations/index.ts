import { initialMigration } from './001_initial';
import { searchMigration } from './002_search';
import { builtinViewsMigration } from './003_builtin_views';
import type { Migration } from './types';

export const MIGRATIONS: Migration[] = [initialMigration, searchMigration, builtinViewsMigration];
