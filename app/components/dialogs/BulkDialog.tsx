import { useState } from 'react';
import { api, describeError } from '../../lib/api';
import { flattenLocations, useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { Modal } from '../ui/Modal';

const splitTags = (text: string): string[] =>
  text
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

/** Change location, quantity or tags for every selected part at once. One undo step. */
export function BulkDialog({ onClose }: { onClose(): void }) {
  const selected = useUiStore((state) => state.selectedIds);
  const clear = useUiStore((state) => state.clearSelection);
  const locations = useDataStore((state) => state.locations);
  const bump = useDataStore((state) => state.bump);
  const toast = useDataStore((state) => state.toast);

  const [location, setLocation] = useState('__keep');
  const [quantityMode, setQuantityMode] = useState<'keep' | 'set' | 'add'>('keep');
  const [quantity, setQuantity] = useState('0');
  const [addTags, setAddTags] = useState('');
  const [removeTags, setRemoveTags] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    const changes: Record<string, unknown> = {};
    if (location !== '__keep') changes.location_id = location === '__none' ? null : location;
    if (quantityMode === 'set') changes.quantity = Number(quantity);
    if (quantityMode === 'add') changes.quantity_delta = Number(quantity);
    if (splitTags(addTags).length) changes.add_tags = splitTags(addTags);
    if (splitTags(removeTags).length) changes.remove_tags = splitTags(removeTags);
    if (Object.keys(changes).length === 0) {
      toast('info', 'Pick at least one change.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/parts/bulk', { ids: [...selected], changes });
      await bump();
      toast('success', `Updated ${selected.size} parts. Undo is available.`);
      clear();
      onClose();
    } catch (error) {
      toast('error', describeError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Edit ${selected.size.toLocaleString()} selected parts`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void apply();
        }}
      >
        <div>
          <label htmlFor="bulk-location" className="label">
            Location
          </label>
          <select id="bulk-location" className="field" value={location} onChange={(event) => setLocation(event.target.value)}>
            <option value="__keep">Do not change</option>
            <option value="__none">Remove location</option>
            {flattenLocations(locations).map((node) => (
              <option key={node.id} value={node.id}>
                {' '.repeat(node.depth)}
                {node.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="bulk-qty-mode" className="label">
              Quantity
            </label>
            <select id="bulk-qty-mode" className="field" value={quantityMode} onChange={(event) => setQuantityMode(event.target.value as typeof quantityMode)}>
              <option value="keep">Do not change</option>
              <option value="set">Set to…</option>
              <option value="add">Add (use a minus to subtract)</option>
            </select>
          </div>
          <div>
            <label htmlFor="bulk-qty" className="label">
              Amount
            </label>
            <input id="bulk-qty" type="number" className="field" disabled={quantityMode === 'keep'} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="bulk-add-tags" className="label">
            Add tags (comma separated)
          </label>
          <input id="bulk-add-tags" className="field" value={addTags} onChange={(event) => setAddTags(event.target.value)} />
        </div>
        <div>
          <label htmlFor="bulk-remove-tags" className="label">
            Remove tags (comma separated)
          </label>
          <input id="bulk-remove-tags" className="field" value={removeTags} onChange={(event) => setRemoveTags(event.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Apply to {selected.size.toLocaleString()} parts
        </button>
      </form>
    </Modal>
  );
}
