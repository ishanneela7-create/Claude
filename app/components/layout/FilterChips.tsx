import { useState } from 'react';
import { api, describeError } from '../../lib/api';
import { useLibraryQuery } from '../../hooks/useLibraryQuery';
import { useDataStore, locationPath } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { Icon } from '../ui/Icon';

/** Shows what is filtering the list right now, with a button to clear it. */
export function FilterChips() {
  const filters = useUiStore((state) => state.filters);
  const setFilters = useUiStore((state) => state.setFilters);
  const views = useDataStore((state) => state.views);
  const locations = useDataStore((state) => state.locations);
  const search = useUiStore((state) => state.search);
  const setSearch = useUiStore((state) => state.setSearch);

  const params = useLibraryQuery();
  const bump = useDataStore((state) => state.bump);
  const toast = useDataStore((state) => state.toast);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const saveView = async () => {
    const { sort: _sort, dir: _dir, ...filter } = params;
    void _sort;
    void _dir;
    const clean = Object.fromEntries(Object.entries(filter).filter(([, value]) => value !== undefined));
    try {
      await api.post('/views', { name: name.trim(), filter: clean });
      setNaming(false);
      setName('');
      await bump();
      toast('success', 'Smart view saved');
    } catch (error) {
      toast('error', describeError(error));
    }
  };

  const chips: string[] = [];
  const view = views.find((item) => item.id === filters.viewId);
  if (view) chips.push(`View: ${view.name}`);
  if (filters.category) chips.push(`Category: ${filters.category}`);
  if (filters.tag) chips.push(`Tag: ${filters.tag}`);
  if (filters.location_id) chips.push(`Location: ${locationPath(locations, filters.location_id) || '…'}`);
  if (chips.length === 0 && !search) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-1.5">
      <span className="text-xs font-semibold uppercase text-muted">Filters</span>
      {chips.map((chip) => (
        <span key={chip} className="chip">
          {chip}
        </span>
      ))}
      <button
        type="button"
        className="btn !min-h-[28px] px-2 text-xs"
        onClick={() => {
          setFilters({});
          setSearch('');
        }}
      >
        <Icon name="close" size={14} /> Clear all
      </button>
      {!naming ? (
        <button type="button" className="btn !min-h-[28px] px-2 text-xs" onClick={() => setNaming(true)}>
          Save as smart view
        </button>
      ) : (
        <form
          className="flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            void saveView();
          }}
        >
          <label htmlFor="view-name" className="sr-only">
            Smart view name
          </label>
          <input id="view-name" className="field !w-40 !py-1" value={name} onChange={(event) => setName(event.target.value)} placeholder="View name" />
          <button type="submit" className="btn btn-accent !min-h-[28px] px-2 text-xs" disabled={!name.trim()}>
            Save
          </button>
        </form>
      )}
    </div>
  );
}
