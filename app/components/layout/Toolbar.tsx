import { useRef } from 'react';
import { GROUP_FIELDS, SORT_FIELDS } from '@shared/constants';
import type { PartRecord } from '@shared/types';
import { api, describeError } from '../../lib/api';
import {
  useUiStore,
  type Density,
  type GroupField,
  type SortField,
  type ThemeSetting,
} from '../../store/uiStore';
import { useDataStore } from '../../store/dataStore';
import { Icon } from '../ui/Icon';
import { MenuButton } from './MenuButton';

const SORT_LABELS: Record<SortField, string> = {
  name: 'Name',
  category: 'Category',
  color: 'Color',
  quantity: 'Quantity',
  location: 'Location',
  created_at: 'Date added',
};
const GROUP_LABELS: Record<GroupField, string> = {
  category: 'Category',
  color: 'Color',
  location: 'Location',
  kind: 'Official / custom',
  subcategory: 'Subcategory',
};
const NEXT_THEME: Record<ThemeSetting, ThemeSetting> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

export function Toolbar() {
  const ui = useUiStore();
  const history = useDataStore((state) => state.history);
  const undo = useDataStore((state) => state.undo);
  const redo = useDataStore((state) => state.redo);
  const canUndo = history.some((entry) => !entry.undone);
  const canRedo = history.some((entry) => entry.undone);
  const lastAction = history.find((entry) => !entry.undone)?.label;
  const fileInput = useRef<HTMLInputElement>(null);
  const bump = useDataStore((state) => state.bump);
  const toast = useDataStore((state) => state.toast);

  /** Reads a shared custom part file and adds it as a new part. */
  const importCustomFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const part = await api.post<PartRecord>(
        '/parts/import-custom',
        JSON.parse(await file.text()),
      );
      await bump();
      ui.openPart(part.id);
      toast('success', `Imported custom part "${part.name}"`);
    } catch (error) {
      toast(
        'error',
        error instanceof SyntaxError ? 'That file is not valid JSON' : describeError(error),
      );
    }
  };

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
      <button
        type="button"
        className="btn-icon lg:hidden"
        aria-label="Open menu"
        onClick={() => ui.setSidebarOpen(true)}
      >
        <Icon name="menu" />
      </button>
      <h1 className="mr-2 hidden text-lg font-bold text-brand sm:block">Brick Library</h1>

      <div className="relative min-w-[160px] flex-1">
        <label htmlFor="search" className="sr-only">
          Search parts
        </label>
        <Icon name="search" className="pointer-events-none absolute left-3 top-2.5 text-muted" />
        <input
          id="search"
          type="search"
          className="field pl-9"
          placeholder="Search (press /)  e.g. color:red qty:>5"
          value={ui.search}
          onChange={(event) => ui.setSearch(event.target.value)}
          autoComplete="off"
        />
      </div>

      <MenuButton
        label="New part"
        icon="plus"
        className="btn btn-accent"
        items={[
          { label: 'Official part', icon: 'box', onSelect: () => ui.startNewPart('official') },
          { label: 'Custom part', icon: 'star', onSelect: () => ui.startNewPart('custom') },
        ]}
      >
        <span className="hidden sm:inline">New</span>
      </MenuButton>

      <div className="flex items-center gap-1" role="group" aria-label="View options">
        <button
          type="button"
          className={`btn-icon ${ui.viewMode === 'table' ? 'bg-raised text-brand' : ''}`}
          aria-label="Table view"
          aria-pressed={ui.viewMode === 'table'}
          onClick={() => ui.setViewMode('table')}
        >
          <Icon name="table" />
        </button>
        <button
          type="button"
          className={`btn-icon ${ui.viewMode === 'grid' ? 'bg-raised text-brand' : ''}`}
          aria-label="Grid view"
          aria-pressed={ui.viewMode === 'grid'}
          onClick={() => ui.setViewMode('grid')}
        >
          <Icon name="grid" />
        </button>
      </div>

      <label className="sr-only" htmlFor="density">
        Density
      </label>
      <select
        id="density"
        className="field w-auto"
        value={ui.density}
        onChange={(event) => ui.setDensity(event.target.value as Density)}
      >
        <option value="compact">Compact</option>
        <option value="normal">Normal</option>
        <option value="comfortable">Comfortable</option>
      </select>

      <label className="sr-only" htmlFor="sort">
        Sort by
      </label>
      <select
        id="sort"
        className="field w-auto"
        value={ui.sort}
        onChange={(event) => ui.setSort(event.target.value as SortField, 'asc')}
      >
        {SORT_FIELDS.map((field) => (
          <option key={field} value={field}>
            Sort: {SORT_LABELS[field]}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn-icon"
        aria-label={
          ui.dir === 'asc'
            ? 'Sorted ascending, switch to descending'
            : 'Sorted descending, switch to ascending'
        }
        onClick={() => ui.setSort(ui.sort, ui.dir === 'asc' ? 'desc' : 'asc')}
      >
        <Icon name="down" className={ui.dir === 'asc' ? 'rotate-180' : ''} />
      </button>

      <label className="sr-only" htmlFor="group">
        Group by
      </label>
      <select
        id="group"
        className="field w-auto"
        value={ui.group ?? ''}
        onChange={(event) => ui.setGroup((event.target.value || null) as GroupField | null)}
      >
        <option value="">No grouping</option>
        {GROUP_FIELDS.map((field) => (
          <option key={field} value={field}>
            Group: {GROUP_LABELS[field]}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="btn-icon"
        aria-label={canUndo ? `Undo: ${lastAction ?? ''}` : 'Undo (nothing to undo)'}
        disabled={!canUndo}
        onClick={() => void undo()}
      >
        <Icon name="undo" />
      </button>
      <button
        type="button"
        className="btn-icon"
        aria-label="Redo"
        disabled={!canRedo}
        onClick={() => void redo()}
      >
        <Icon name="redo" />
      </button>
      <button
        type="button"
        className="btn-icon"
        aria-label={`Theme: ${ui.theme}. Switch to ${NEXT_THEME[ui.theme]}`}
        onClick={() => ui.setTheme(NEXT_THEME[ui.theme])}
      >
        <Icon name={ui.theme === 'dark' ? 'moon' : 'sun'} />
      </button>

      <MenuButton
        label="More actions"
        icon="list"
        className="btn-icon"
        items={[
          { label: 'Import…', icon: 'upload', onSelect: () => ui.openDialog('import') },
          {
            label: 'Import custom part file…',
            icon: 'upload',
            onSelect: () => fileInput.current?.click(),
          },
          { label: 'Export CSV', icon: 'download', onSelect: () => window.open('/api/export/csv') },
          {
            label: 'Export JSON',
            icon: 'download',
            onSelect: () => window.open('/api/export/json'),
          },
          {
            label: 'Download SQLite backup',
            icon: 'download',
            onSelect: () => window.open('/api/export/sqlite'),
          },
          { label: 'Find duplicates', icon: 'copy', onSelect: () => ui.openDialog('duplicates') },
          { label: 'Manage colors', icon: 'star', onSelect: () => ui.openDialog('colors') },
          { label: 'Keyboard shortcuts', icon: 'help', onSelect: () => ui.openDialog('shortcuts') },
        ]}
      >
        <span className="sr-only">More actions</span>
      </MenuButton>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        tabIndex={-1}
        aria-label="Custom part file"
        onChange={(event) => {
          void importCustomFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </header>
  );
}
