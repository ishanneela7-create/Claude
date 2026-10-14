import { create } from 'zustand';
import type { GROUP_FIELDS, SORT_FIELDS } from '@shared/constants';
import { readSetting, writeSetting } from '../lib/storage';

export type ThemeSetting = 'system' | 'light' | 'dark';
export type ViewMode = 'table' | 'grid';
export type Density = 'compact' | 'normal' | 'comfortable';
export type SortField = (typeof SORT_FIELDS)[number];
export type GroupField = (typeof GROUP_FIELDS)[number];
export type PanelMode = 'closed' | 'view' | 'edit' | 'new';
export type DialogName = 'import' | 'shortcuts' | 'duplicates' | 'locations' | 'colors' | 'bulk' | null;

export interface Filters {
  category?: string;
  color_id?: number;
  location_id?: string;
  tag?: string;
  viewId?: string;
}

interface UiState {
  theme: ThemeSetting;
  viewMode: ViewMode;
  density: Density;
  search: string;
  sort: SortField;
  dir: 'asc' | 'desc';
  group: GroupField | null;
  filters: Filters;
  collapsedGroups: Set<string>;
  selectedIds: Set<string>;
  activePartId: string | null;
  panelMode: PanelMode;
  newKind: 'official' | 'custom';
  sidebarOpen: boolean;
  dialog: DialogName;
  focusedLocationId: string | null;

  setTheme(theme: ThemeSetting): void;
  setViewMode(mode: ViewMode): void;
  setDensity(density: Density): void;
  setSearch(text: string): void;
  setSort(sort: SortField, dir?: 'asc' | 'desc'): void;
  setGroup(group: GroupField | null): void;
  setFilters(filters: Filters): void;
  toggleGroup(key: string): void;
  setSelected(ids: Iterable<string>): void;
  toggleSelected(id: string): void;
  clearSelection(): void;
  openPart(id: string, mode?: PanelMode): void;
  startNewPart(kind: 'official' | 'custom'): void;
  setPanelMode(mode: PanelMode): void;
  closePanel(): void;
  setSidebarOpen(open: boolean): void;
  openDialog(name: DialogName): void;
}

const THEMES = ['system', 'light', 'dark'] as const;
const VIEW_MODES = ['table', 'grid'] as const;
const DENSITIES = ['compact', 'normal', 'comfortable'] as const;

export function applyTheme(theme: ThemeSetting): void {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export const useUiStore = create<UiState>((set) => ({
  theme: readSetting('brick-theme', THEMES, 'system'),
  viewMode: readSetting('brick-view', VIEW_MODES, 'table'),
  density: readSetting('brick-density', DENSITIES, 'normal'),
  search: '',
  sort: 'name',
  dir: 'asc',
  group: null,
  filters: {},
  collapsedGroups: new Set(),
  selectedIds: new Set(),
  activePartId: null,
  panelMode: 'closed',
  newKind: 'official',
  sidebarOpen: false,
  dialog: null,
  focusedLocationId: null,

  setTheme: (theme) => {
    writeSetting('brick-theme', theme);
    applyTheme(theme);
    set({ theme });
  },
  setViewMode: (viewMode) => {
    writeSetting('brick-view', viewMode);
    set({ viewMode });
  },
  setDensity: (density) => {
    writeSetting('brick-density', density);
    set({ density });
  },
  setSearch: (search) => set({ search }),
  setSort: (sort, dir) =>
    set((state) => ({
      sort,
      dir: dir ?? (state.sort === sort && state.dir === 'asc' ? 'desc' : 'asc'),
    })),
  setGroup: (group) => set({ group, collapsedGroups: new Set() }),
  setFilters: (filters) => set({ filters, selectedIds: new Set() }),
  toggleGroup: (key) =>
    set((state) => {
      const next = new Set(state.collapsedGroups);
      if (!next.delete(key)) next.add(key);
      return { collapsedGroups: next };
    }),
  setSelected: (ids) => set({ selectedIds: new Set(ids) }),
  toggleSelected: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (!next.delete(id)) next.add(id);
      return { selectedIds: next };
    }),
  clearSelection: () => set({ selectedIds: new Set() }),
  openPart: (id, mode = 'view') => set({ activePartId: id, panelMode: mode }),
  startNewPart: (kind) => set({ activePartId: null, panelMode: 'new', newKind: kind }),
  setPanelMode: (panelMode) => set({ panelMode }),
  closePanel: () => set({ panelMode: 'closed', activePartId: null }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  openDialog: (dialog) => set({ dialog }),
}));
