import { useMemo } from 'react';
import { useDataStore } from '../store/dataStore';
import { useUiStore } from '../store/uiStore';
import { useDebounced } from './useDebounced';
import { SEARCH_DEBOUNCE_MS } from '@shared/constants';

export type QueryParams = Record<string, string | number | boolean | undefined>;

/** Combines the search box, sidebar choices and the active smart view into one API query. */
export function useLibraryQuery(): QueryParams {
  const search = useUiStore((state) => state.search);
  const filters = useUiStore((state) => state.filters);
  const sort = useUiStore((state) => state.sort);
  const dir = useUiStore((state) => state.dir);
  const views = useDataStore((state) => state.views);
  const debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);

  return useMemo(() => {
    const view = views.find((item) => item.id === filters.viewId);
    const viewFilter = (view?.filter ?? {}) as QueryParams;
    const text = [viewFilter.q, debouncedSearch].filter(Boolean).join(' ').trim();
    return {
      ...viewFilter,
      q: text || undefined,
      category: filters.category ?? (viewFilter.category as string | undefined),
      color_id: filters.color_id,
      location_id: filters.location_id,
      tag: filters.tag,
      sort,
      dir,
    };
  }, [debouncedSearch, filters, sort, dir, views]);
}
