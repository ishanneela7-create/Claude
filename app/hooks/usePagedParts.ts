import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_PAGE_SIZE } from '@shared/constants';
import type { PartListResult, PartRecord } from '@shared/types';
import { api, describeError } from '../lib/api';
import type { GroupCount } from '../lib/lines';
import { useDataStore } from '../store/dataStore';
import type { QueryParams } from './useLibraryQuery';

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

export interface PagedParts {
  total: number;
  groups: GroupCount[] | null;
  loading: boolean;
  error: string | null;
  getRow(index: number): PartRecord | null;
  ensureRow(index: number): void;
}

/**
 * Loads parts a page at a time as the list scrolls, so 50,000 parts never load at once.
 * Any change to the query or a data change (edit, undo...) starts again from page 0.
 */
export function usePagedParts(params: QueryParams, group: string | null): PagedParts {
  const version = useDataStore((state) => state.version);
  const key = JSON.stringify([params, group, version]);
  const pages = useRef(new Map<number, PartRecord[]>());
  const requested = useRef(new Set<number>());
  const generation = useRef(0);
  const latest = useRef({ params, group });
  latest.current = { params, group };

  const [, setTick] = useState(0);
  const [total, setTotal] = useState(0);
  const [groups, setGroups] = useState<GroupCount[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (page: number, current: number) => {
    const { params: query, group: groupField } = latest.current;
    try {
      const result = await api.get<PartListResult>('/parts', {
        ...query,
        group: groupField ?? undefined,
        offset: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      if (current !== generation.current) return;
      pages.current.set(page, result.items);
      setTotal(result.total);
      setError(null);
      setTick((value) => value + 1);
    } catch (caught) {
      if (current === generation.current) setError(describeError(caught));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    generation.current += 1;
    const current = generation.current;
    pages.current = new Map();
    requested.current = new Set([0]);
    setLoading(true);
    void loadPage(0, current);
    if (group) {
      api
        .get<GroupCount[]>('/parts/groups', { ...latest.current.params, group })
        .then((result) => {
          if (current === generation.current) setGroups(result);
        })
        .catch((caught: unknown) => setError(describeError(caught)));
    } else {
      setGroups(null);
    }
    // `key` already contains params, group and version.
  }, [key, loadPage]);

  const getRow = useCallback((index: number) => {
    const page = pages.current.get(Math.floor(index / PAGE_SIZE));
    return page?.[index % PAGE_SIZE] ?? null;
  }, []);

  const ensureRow = useCallback(
    (index: number) => {
      const page = Math.floor(index / PAGE_SIZE);
      if (requested.current.has(page)) return;
      requested.current.add(page);
      void loadPage(page, generation.current);
    },
    [loadPage],
  );

  return { total, groups, loading, error, getRow, ensureRow };
}
