import { useEffect, useState } from 'react';
import type { DuplicateGroup } from '@shared/types';
import { api, describeError } from '../../lib/api';
import { useDataStore } from '../../store/dataStore';
import { Modal } from '../ui/Modal';
import { Swatch } from '../ui/Swatch';

/** Same design id + same color twice? Merge them into one. */
export function DuplicatesDialog({ onClose }: { onClose(): void }) {
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null);
  const bump = useDataStore((state) => state.bump);
  const toast = useDataStore((state) => state.toast);
  const version = useDataStore((state) => state.version);

  useEffect(() => {
    api
      .get<DuplicateGroup[]>('/parts/duplicates')
      .then(setGroups)
      .catch((error: unknown) => toast('error', describeError(error)));
  }, [version, toast]);

  const merge = async (group: DuplicateGroup) => {
    const [keep, ...others] = group.parts;
    if (!keep) return;
    const total = group.parts.reduce((sum, part) => sum + part.quantity, 0);
    if (
      !window.confirm(
        `Merge ${group.parts.length} entries of #${group.design_id} (${group.color_name}) into one with ${total} pieces?`,
      )
    )
      return;
    try {
      await api.post('/parts/merge', {
        keep_id: keep.id,
        merge_ids: others.map((part) => part.id),
      });
      await bump();
      toast('success', 'Merged. Undo is available.');
    } catch (error) {
      toast('error', describeError(error));
    }
  };

  return (
    <Modal title="Duplicate parts" onClose={onClose} wide>
      {groups === null && <p>Looking…</p>}
      {groups?.length === 0 && (
        <p className="text-sm">No duplicates. Every design id and color appears once.</p>
      )}
      <ul className="space-y-3">
        {groups?.map((group) => (
          <li
            key={`${group.design_id}-${group.color_id}`}
            className="rounded-md border border-line p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                #{group.design_id} ·{' '}
                <Swatch
                  rgb={group.parts[0]?.color_rgb ?? '000000'}
                  name={group.color_name}
                  showName
                />
              </p>
              <button type="button" className="btn btn-accent" onClick={() => void merge(group)}>
                Merge into one
              </button>
            </div>
            <ul className="mt-2 text-sm text-muted">
              {group.parts.map((part) => (
                <li key={part.id}>
                  {part.name}: {part.quantity} pcs · {part.location_path || 'No location'}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
