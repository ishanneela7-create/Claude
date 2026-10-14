import { useEffect, useState } from 'react';
import type { LocationNode } from '@shared/types';
import { api, describeError } from '../../lib/api';
import { flattenLocations, useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { Icon } from '../ui/Icon';
import { Modal } from '../ui/Modal';

const LEVEL_NAMES = ['Room', 'Cabinet', 'Drawer', 'Bin'];

function levelFor(depth: number): string {
  return LEVEL_NAMES[Math.min(depth, LEVEL_NAMES.length - 1)] ?? 'Bin';
}

/** Add, rename, move, delete locations and print a bin's QR code. */
export function LocationsDialog({ onClose }: { onClose(): void }) {
  const locations = useDataStore((state) => state.locations);
  const bump = useDataStore((state) => state.bump);
  const toast = useDataStore((state) => state.toast);
  const focused = useUiStore((state) => state.focusedLocationId);
  const flat = flattenLocations(locations);
  const [selectedId, setSelectedId] = useState<string | null>(focused ?? flat[0]?.id ?? null);
  const selected = flat.find((node) => node.id === selectedId) ?? null;

  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('');
  const [newName, setNewName] = useState('');

  useEffect(() => {
    setName(selected?.name ?? '');
    setLabel(selected?.label ?? '');
    setColor(selected?.color_code ?? '');
  }, [selected?.id, selected?.name, selected?.label, selected?.color_code]);

  const run = async (action: () => Promise<unknown>, success?: string) => {
    try {
      await action();
      await bump();
      if (success) toast('success', success);
    } catch (error) {
      toast('error', describeError(error));
    }
  };

  const descendants = (node: LocationNode | null): Set<string> => {
    const ids = new Set<string>();
    const walk = (item: LocationNode) => {
      ids.add(item.id);
      item.children.forEach(walk);
    };
    if (node) walk(node);
    return ids;
  };
  const selectedNode = selected ? flat.find((node) => node.id === selected.id) ?? null : null;
  const blocked = descendants(selectedNode);

  const addLocation = (parentId: string | null) =>
    run(async () => {
      const depth = parentId ? (flat.find((node) => node.id === parentId)?.depth ?? 0) + 1 : 0;
      const created = await api.post<LocationNode>('/locations', {
        name: newName.trim(),
        parent_id: parentId,
        level_label: levelFor(depth),
      });
      setNewName('');
      setSelectedId(created.id);
    }, 'Location added');

  const printQr = () => {
    if (!selected) return;
    const url = `/api/locations/${selected.id}/qr?base=${encodeURIComponent(window.location.origin)}`;
    const win = window.open('', '_blank', 'width=420,height=520');
    if (!win) return;
    win.document.write(
      `<title>${selected.name}</title><body style="font-family:sans-serif;text-align:center"><h2>${selected.label || selected.name}</h2><img src="${url}" width="320" height="320" alt="QR code for ${selected.name}"><p>${selected.name}</p><script>window.onload=()=>window.print()</script></body>`,
    );
    win.document.close();
  };

  return (
    <Modal title="Locations and bins" onClose={onClose} wide>
      <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <div>
          <ul role="tree" aria-label="All locations" className="max-h-72 overflow-auto rounded-md border border-line p-1">
            {flat.length === 0 && <li className="p-2 text-sm text-muted">No locations yet. Add a room first.</li>}
            {flat.map((node) => (
              <li key={node.id} role="treeitem" aria-selected={node.id === selectedId}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${node.id === selectedId ? 'bg-brand/15 font-semibold text-brand' : 'hover:bg-raised'}`}
                  style={{ paddingLeft: 8 + node.depth * 16 }}
                  onClick={() => setSelectedId(node.id)}
                >
                  <Icon name={node.children.length ? 'folder' : 'box'} size={14} />
                  <span className="truncate">{node.name}</span>
                  <span className="ml-auto text-xs text-muted">{node.part_count}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <label htmlFor="new-location" className="sr-only">
              New location name
            </label>
            <input id="new-location" className="field" placeholder="New location name" value={newName} onChange={(event) => setNewName(event.target.value)} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn btn-accent" disabled={!newName.trim()} onClick={() => void addLocation(null)}>
              Add top level
            </button>
            <button type="button" className="btn" disabled={!newName.trim() || !selected} onClick={() => void addLocation(selected?.id ?? null)}>
              Add inside selected
            </button>
          </div>
        </div>

        {selected ? (
          <div className="space-y-3" aria-label={`Edit ${selected.name}`}>
            <p className="text-sm text-muted">
              {selected.level_label ?? 'Location'} · {selected.total_part_count} parts inside (including sub-locations)
            </p>
            <div>
              <label htmlFor="loc-name" className="label">
                Name
              </label>
              <input id="loc-name" className="field" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="loc-label" className="label">
                  Printed label
                </label>
                <input id="loc-label" className="field" value={label} onChange={(event) => setLabel(event.target.value)} />
              </div>
              <div>
                <label htmlFor="loc-color" className="label">
                  Color code
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="loc-color"
                    type="color"
                    className="h-9 w-12 rounded border border-line bg-surface"
                    value={`#${color || '1256b8'}`}
                    onChange={(event) => setColor(event.target.value.slice(1))}
                  />
                  <button type="button" className="text-xs font-semibold text-brand hover:underline" onClick={() => setColor('')}>
                    None
                  </button>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                void run(
                  () =>
                    api.patch(`/locations/${selected.id}`, {
                      name: name.trim(),
                      label: label.trim() || null,
                      color_code: color || null,
                    }),
                  'Saved',
                )
              }
            >
              Save changes
            </button>

            <div>
              <label htmlFor="loc-move" className="label">
                Move to (all parts inside move with it)
              </label>
              <select
                id="loc-move"
                className="field"
                value=""
                onChange={(event) => {
                  const value = event.target.value;
                  if (value) void run(() => api.post(`/locations/${selected.id}/move`, { parent_id: value === '__top' ? null : value }), 'Moved');
                }}
              >
                <option value="">Choose a new place…</option>
                <option value="__top">Top level</option>
                {flat
                  .filter((node) => !blocked.has(node.id) && node.id !== selected.parent_id)
                  .map((node) => (
                    <option key={node.id} value={node.id}>
                      {' '.repeat(node.depth)}
                      {node.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              <button type="button" className="btn" onClick={printQr}>
                <Icon name="qr" size={16} /> Print QR code
              </button>
              <DeleteLocation selected={selected} flat={flat} run={run} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Choose a location on the left.</p>
        )}
      </div>
    </Modal>
  );
}

interface DeleteProps {
  selected: LocationNode & { depth: number };
  flat: Array<LocationNode & { depth: number }>;
  run(action: () => Promise<unknown>, success?: string): Promise<void>;
}

function DeleteLocation({ selected, flat, run }: DeleteProps) {
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
          <p>This location is not empty. Choose where its parts and sub-locations go. Nothing is lost.</p>
          <label htmlFor="loc-delete-to" className="sr-only">
            Move contents to
          </label>
          <select id="loc-delete-to" className="field" value={moveTo} onChange={(event) => setMoveTo(event.target.value)}>
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
          onClick={() => void run(() => api.delete(`/locations/${selected.id}${moveTo ? `?move_to=${moveTo}` : ''}`), 'Location deleted')}
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
