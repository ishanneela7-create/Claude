import { create } from 'zustand';
import type {
  ColorRecord,
  HistoryEntry,
  LocationNode,
  SmartViewRecord,
  TagRecord,
} from '@shared/types';
import { api, describeError } from '../lib/api';

export interface Toast {
  id: number;
  kind: 'info' | 'error' | 'success';
  text: string;
}

interface DataState {
  colors: ColorRecord[];
  locations: LocationNode[];
  tags: TagRecord[];
  views: SmartViewRecord[];
  history: HistoryEntry[];
  stats: { parts: number; pieces: number };
  loaded: boolean;
  /** Goes up after every change so lists reload. */
  version: number;
  toasts: Toast[];

  refresh(): Promise<void>;
  bump(): Promise<void>;
  toast(kind: Toast['kind'], text: string): void;
  dismissToast(id: number): void;
  undo(): Promise<void>;
  redo(): Promise<void>;
}

let toastCounter = 0;

export const useDataStore = create<DataState>((set, get) => ({
  colors: [],
  locations: [],
  tags: [],
  views: [],
  history: [],
  stats: { parts: 0, pieces: 0 },
  loaded: false,
  version: 0,
  toasts: [],

  refresh: async () => {
    try {
      const [colors, locations, tags, views, history, stats] = await Promise.all([
        api.get<ColorRecord[]>('/colors'),
        api.get<LocationNode[]>('/locations'),
        api.get<TagRecord[]>('/tags'),
        api.get<SmartViewRecord[]>('/views'),
        api.get<HistoryEntry[]>('/history'),
        api.get<{ parts: number; pieces: number }>('/parts/stats'),
      ]);
      set({ colors, locations, tags, views, history, stats, loaded: true });
    } catch (error) {
      get().toast('error', describeError(error));
    }
  },

  bump: async () => {
    await get().refresh();
    set((state) => ({ version: state.version + 1 }));
  },

  toast: (kind, text) => {
    const id = ++toastCounter;
    set((state) => ({ toasts: [...state.toasts, { id, kind, text }] }));
    setTimeout(() => get().dismissToast(id), kind === 'error' ? 8000 : 4000);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),

  undo: async () => {
    try {
      const done = await api.post<HistoryEntry[]>('/history/undo');
      if (done[0]) get().toast('info', `Undid: ${done[0].label}`);
      await get().bump();
    } catch (error) {
      get().toast('error', describeError(error));
    }
  },
  redo: async () => {
    try {
      const done = await api.post<HistoryEntry[]>('/history/redo');
      if (done[0]) get().toast('info', `Redid: ${done[0].label}`);
      await get().bump();
    } catch (error) {
      get().toast('error', describeError(error));
    }
  },
}));

export function flattenLocations(nodes: LocationNode[], depth = 0): Array<LocationNode & { depth: number }> {
  return nodes.flatMap((node) => [{ ...node, depth }, ...flattenLocations(node.children, depth + 1)]);
}

export function locationPath(nodes: LocationNode[], id: string | null): string {
  if (!id) return '';
  const found = flattenLocations(nodes).find((node) => node.id === id);
  return found ? pathOf(nodes, found.id) : '';
}

function pathOf(nodes: LocationNode[], id: string): string {
  const walk = (list: LocationNode[], trail: string[]): string | null => {
    for (const node of list) {
      const next = [...trail, node.name];
      if (node.id === id) return next.join(' > ');
      const found = walk(node.children, next);
      if (found) return found;
    }
    return null;
  };
  return walk(nodes, []) ?? '';
}
