import { useEffect, useState } from 'react';
import type { PartRecord } from '@shared/types';
import { formatDimensions } from '@shared/units';
import { api } from '../../lib/api';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';

export function VersionHistory({ part }: { part: PartRecord }) {
  const [versions, setVersions] = useState<PartRecord[]>([]);
  const version = useDataStore((state) => state.version);
  const openPart = useUiStore((state) => state.openPart);

  useEffect(() => {
    api.get<PartRecord[]>(`/parts/${part.id}/versions`).then(setVersions).catch(() => setVersions([]));
  }, [part.id, version]);

  if (versions.length < 2) {
    return <p className="text-sm text-muted">This is version 1. Editing the design will save a new version.</p>;
  }
  return (
    <ol className="space-y-2" aria-label="Version history">
      {versions.map((item) => {
        const size = formatDimensions(item.width_plates, item.depth_plates, item.height_plates);
        return (
          <li key={item.id} className={`rounded-md border p-2 text-sm ${item.id === part.id ? 'border-brand bg-brand/10' : 'border-line'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">
                Version {item.version} {item.is_current && <span className="chip ml-1">Current</span>}
              </span>
              {item.id !== part.id && (
                <button type="button" className="text-xs font-semibold text-brand hover:underline" onClick={() => openPart(item.id)}>
                  View
                </button>
              )}
            </div>
            <p className="text-xs text-muted">
              {item.updated_at.slice(0, 16).replace('T', ' ')} · {item.name}
              {size && ` · ${size}`}
              {item.material && ` · ${item.material}`}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
