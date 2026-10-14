import { useState } from 'react';
import { api, describeError } from '../../lib/api';
import { useDataStore } from '../../store/dataStore';
import { Modal } from '../ui/Modal';
import { Swatch } from '../ui/Swatch';

export function ColorsDialog({ onClose }: { onClose(): void }) {
  const colors = useDataStore((state) => state.colors);
  const bump = useDataStore((state) => state.bump);
  const toast = useDataStore((state) => state.toast);
  const [name, setName] = useState('');
  const [rgb, setRgb] = useState('1256b8');
  const [transparent, setTransparent] = useState(false);
  const [metallic, setMetallic] = useState(false);
  const [filter, setFilter] = useState('');

  const add = async () => {
    try {
      await api.post('/colors', { name, rgb, is_transparent: transparent, is_metallic: metallic });
      setName('');
      await bump();
      toast('success', 'Custom color added');
    } catch (error) {
      toast('error', describeError(error));
    }
  };
  const remove = async (id: number) => {
    try {
      await api.delete(`/colors/${id}`);
      await bump();
    } catch (error) {
      toast('error', describeError(error));
    }
  };
  const shown = colors.filter((color) => color.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Modal title="Colors" onClose={onClose}>
      <form
        className="mb-4 grid grid-cols-2 gap-2 rounded-md border border-line p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <h3 className="col-span-2 font-semibold">Add a custom color</h3>
        <div>
          <label htmlFor="color-name" className="label">
            Name
          </label>
          <input
            id="color-name"
            className="field"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="color-rgb" className="label">
            Color
          </label>
          <input
            id="color-rgb"
            type="color"
            className="h-9 w-full rounded border border-line bg-surface"
            value={`#${rgb}`}
            onChange={(event) => setRgb(event.target.value.slice(1))}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={transparent}
            onChange={(event) => setTransparent(event.target.checked)}
          />{' '}
          Transparent
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={metallic}
            onChange={(event) => setMetallic(event.target.checked)}
          />{' '}
          Metallic
        </label>
        <button type="submit" className="btn btn-accent col-span-2" disabled={!name.trim()}>
          Add color
        </button>
      </form>
      <label htmlFor="color-filter" className="label">
        Find a color
      </label>
      <input
        id="color-filter"
        className="field mb-2"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      <ul className="max-h-64 overflow-auto" aria-label="Colors">
        {shown.map((color) => (
          <li
            key={color.id}
            className="flex items-center justify-between border-b border-line py-1.5 text-sm"
          >
            <Swatch
              rgb={color.rgb}
              name={color.name}
              transparent={color.is_transparent}
              showName
              size={18}
            />
            <span className="flex items-center gap-2 text-xs text-muted">
              #{color.rgb}
              {color.is_metallic && <span className="chip">Metallic</span>}
              {color.is_custom && (
                <button
                  type="button"
                  className="font-semibold text-danger hover:underline"
                  onClick={() => void remove(color.id)}
                >
                  Delete
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
