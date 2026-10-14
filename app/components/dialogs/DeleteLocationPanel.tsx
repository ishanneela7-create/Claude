import { useState } from 'react';
import type { LocationNode } from '@shared/types';
import { api } from '../../lib/api';
import { Icon } from '../ui/Icon';

interface DeleteProps {
  selected: LocationNode & { depth: number };
  flat: Array<LocationNode & { depth: number }>;
  run(action: () => Promise<unknown>, success?: string): Promise<void>;
}

export function DeleteLocationPanel({ selected, flat, run }: DeleteProps) {
  const [moveTo, setMoveTo] = useState('');
  const [open, setOpen] = useState(false);
  const blocked = new Set<string>();
  const walk = (node: LocationNode) => {
    blocked.add(node.id);
    node.children.forEach(walk);
  };
  walk(selected);
  const notEmpty = selected.total_part_count > 0 || selected.children.length > 0;

  if (!open) {
    return (
      <button type="button" className="btn btn-danger" onClick={() => setOpen(true)}>
        <Icon name="trash" size={16} /> Delete…
      </button>
    );
  }
  return (
    <div className="w-full space-y-2 rounded-md border border-danger p-3 text-sm">
      {notEmpty ? (
        <>
          <p>
            This location is not empty. Choose where its parts and sub-locations go. Nothing is
            lost.
          </p>
          <label htmlFor="loc-delete-to" className="sr-only">
            Move contents to
          </label>
          <select
            id="loc-delete-to"
            className="field"
            value={moveTo}
            onChange={(event) => setMoveTo(event.target.value)}
          >
            <option value="">Choose…</option>
            {flat
              .filter((node) => !blocked.has(node.id))
              .map((node) => (
                <option key={node.id} value={node.id}>
                  {' '.repeat(node.depth)}
                  {node.name}
                </option>
              ))}
          </select>
        </>
      ) : (
        <p>Delete this empty location? You can undo this.</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-danger"
          disabled={notEmpty && !moveTo}
          onClick={() =>
            void run(
              () => api.delete(`/locations/${selected.id}${moveTo ? `?move_to=${moveTo}` : ''}`),
              'Location deleted',
            )
          }
        >
          Confirm delete
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
