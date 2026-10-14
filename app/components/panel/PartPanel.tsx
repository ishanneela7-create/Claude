import { useEffect, useState } from 'react';
import type { PartRecord, PhotoRecord } from '@shared/types';
import { api, describeError } from '../../lib/api';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { Icon } from '../ui/Icon';
import { PartDetails } from './PartDetails';
import { PartForm } from './PartForm';

type Detail = PartRecord & { photos: PhotoRecord[] };

function useDetail(id: string | null): { part: Detail | null; error: string | null } {
  const [part, setPart] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const version = useDataStore((state) => state.version);
  useEffect(() => {
    if (!id) {
      setPart(null);
      return;
    }
    let cancelled = false;
    api
      .get<Detail>(`/parts/${id}`)
      .then((result) => {
        if (!cancelled) {
          setPart(result);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setPart(null);
          setError(describeError(caught));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, version]);
  return { part, error };
}

/** The right-hand panel: details, edit form and new-part form. */
export function PartPanel() {
  const mode = useUiStore((state) => state.panelMode);
  const activeId = useUiStore((state) => state.activePartId);
  const newKind = useUiStore((state) => state.newKind);
  const setMode = useUiStore((state) => state.setPanelMode);
  const close = useUiStore((state) => state.closePanel);
  const bump = useDataStore((state) => state.bump);
  const toast = useDataStore((state) => state.toast);
  const { part, error } = useDetail(mode === 'new' ? null : activeId);

  if (mode === 'closed') return null;

  const remove = async () => {
    if (!part || !window.confirm(`Delete "${part.name}"? You can undo this.`)) return;
    try {
      await api.delete(`/parts/${part.id}`);
      close();
      await bump();
      toast('info', 'Deleted. Press Undo to bring it back.');
    } catch (caught) {
      toast('error', describeError(caught));
    }
  };

  const title = mode === 'new' ? `New ${newKind} part` : mode === 'edit' ? 'Edit part' : 'Part details';

  return (
    <aside
      aria-label={title}
      className="fixed inset-0 z-30 flex flex-col bg-surface lg:static lg:inset-auto lg:z-auto lg:w-[420px] lg:shrink-0 lg:border-l lg:border-line"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h2 className="truncate text-base font-semibold">{title}</h2>
        <div className="flex items-center gap-1">
          {mode === 'view' && part?.is_current && (
            <button type="button" className="btn" onClick={() => setMode('edit')}>
              <Icon name="edit" size={16} /> Edit
            </button>
          )}
          {mode === 'view' && part?.kind === 'custom' && (
            <a className="btn" href={`/api/parts/${part.id}/export`} download>
              <Icon name="download" size={16} /> Export
            </a>
          )}
          {mode === 'view' && part && (
            <button type="button" className="btn btn-danger" onClick={() => void remove()} aria-label="Delete part">
              <Icon name="trash" size={16} />
            </button>
          )}
          <button type="button" className="btn-icon" onClick={close} aria-label="Close panel">
            <Icon name="close" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {mode === 'new' && <PartForm key={`new-${newKind}`} part={null} kind={newKind} onDone={close} />}
        {mode === 'edit' && part && (
          <PartForm key={part.id} part={part} kind={part.kind} onDone={() => setMode('view')} />
        )}
        {mode === 'view' && part && <PartDetails part={part} />}
        {mode !== 'new' && !part && !error && <p className="text-sm text-muted">Loading…</p>}
      </div>
    </aside>
  );
}
