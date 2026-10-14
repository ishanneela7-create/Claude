import type { PartRecord } from '@shared/types';
import { CARD_SIZE } from '../../lib/density';
import { PartThumb } from '../ui/PartThumb';
import { Swatch } from '../ui/Swatch';
import { useUiStore } from '../../store/uiStore';

export function PartCard({ part }: { part: PartRecord | null }) {
  const density = useUiStore((state) => state.density);
  const selected = useUiStore((state) => (part ? state.selectedIds.has(part.id) : false));
  const active = useUiStore((state) => part !== null && state.activePartId === part.id);
  const toggleSelected = useUiStore((state) => state.toggleSelected);
  const openPart = useUiStore((state) => state.openPart);
  const size = CARD_SIZE[density];

  if (!part) {
    return (
      <div
        className="animate-pulse rounded-lg bg-raised"
        style={{ height: size.height }}
        aria-label="Loading"
      />
    );
  }
  return (
    <div
      className={`relative flex flex-col gap-1 rounded-lg border p-2 text-sm ${active ? 'border-brand ring-2 ring-brand/40' : selected ? 'border-accent' : 'border-line'} bg-surface hover:bg-raised`}
      style={{ height: size.height }}
    >
      <input
        type="checkbox"
        className="absolute left-2 top-2 z-10 h-4 w-4 accent-[rgb(var(--accent))]"
        checked={selected}
        onChange={() => toggleSelected(part.id)}
        aria-label={`Select ${part.name}, ${part.color_name}`}
      />
      <button
        type="button"
        className="flex min-h-0 flex-1 flex-col items-center gap-1 text-center"
        onClick={() => openPart(part.id)}
        aria-label={`Open ${part.name}, ${part.color_name}`}
      >
        <span className="flex flex-1 items-center justify-center">
          <PartThumb
            imagePath={part.image_path}
            rgb={part.color_rgb}
            label={part.name}
            size={size.image}
          />
        </span>
        <span className="line-clamp-2 w-full font-medium leading-tight">{part.name}</span>
        <span className="w-full truncate text-xs text-muted">
          {part.kind === 'custom' ? `Custom v${part.version}` : `#${part.design_id}`}
        </span>
      </button>
      <div className="flex items-center justify-between text-xs">
        <Swatch
          rgb={part.color_rgb}
          name={part.color_name}
          transparent={part.color_is_transparent}
        />
        <span className="truncate px-1 text-muted">{part.color_name}</span>
        <span className="rounded bg-accent/15 px-1.5 py-0.5 font-bold tabular-nums text-accent">
          {part.quantity}
        </span>
      </div>
    </div>
  );
}
