import { useEffect, useState } from 'react';
import type { ImportRecord } from '@shared/types';
import { api, describeError } from '../../lib/api';
import { useDataStore } from '../../store/dataStore';

/** Every import is listed here, and each one can be rolled back. */
export function ImportLog() {
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const bump = useDataStore((state) => state.bump);
  const toast = useDataStore((state) => state.toast);
  const version = useDataStore((state) => state.version);

  useEffect(() => {
    api.get<ImportRecord[]>('/imports').then(setImports).catch(() => setImports([]));
  }, [version]);

  const rollback = async (item: ImportRecord) => {
    if (!window.confirm(`Roll back "${item.source_name}"? Parts it created are hidden and quantities it added are taken back.`)) return;
    try {
      await api.post(`/imports/${item.id}/rollback`);
      await bump();
      toast('success', 'Import rolled back');
    } catch (error) {
      toast('error', describeError(error));
    }
  };

  if (imports.length === 0) return <p className="text-sm text-muted">No imports yet.</p>;
  return (
    <ul aria-label="Import log" className="divide-y divide-line rounded-md border border-line">
      {imports.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-2 text-sm">
          <span>
            <span className="font-semibold">{item.source_name}</span>
            <span className="block text-xs text-muted">
              {item.created_at.slice(0, 16).replace('T', ' ')} · {item.created_count} added, {item.updated_count} updated ·{' '}
              {item.status === 'rolled_back' ? 'rolled back' : item.format}
            </span>
          </span>
          <button type="button" className="btn" disabled={item.status === 'rolled_back'} onClick={() => void rollback(item)}>
            Roll back
          </button>
        </li>
      ))}
    </ul>
  );
}
