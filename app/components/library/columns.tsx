import type { ColumnDef } from '@tanstack/react-table';
import type { SortField } from '../../store/uiStore';
import type { PartRecord } from '@shared/types';
import { formatDimensions } from '@shared/units';
import { Swatch } from '../ui/Swatch';
import { PartThumb } from '../ui/PartThumb';
import type { Density } from '../../store/uiStore';
import { THUMB_SIZE } from '../../lib/density';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    width: string;
    sortField?: SortField;
    /** Hidden when the list is narrower than this many pixels. */
    minListWidth: number;
    align?: 'right';
  }
}

export function makeColumns(density: Density): ColumnDef<PartRecord>[] {
  return [
    {
      id: 'name',
      header: 'Name',
      meta: { width: 'minmax(160px, 2.4fr)', sortField: 'name', minListWidth: 0 },
      cell: ({ row }) => {
        const part = row.original;
        return (
          <span className="flex min-w-0 items-center gap-2">
            <PartThumb
              imagePath={part.image_path}
              rgb={part.color_rgb}
              label={part.name}
              size={THUMB_SIZE[density]}
            />
            <span className="min-w-0">
              <span className="block truncate font-medium">{part.name}</span>
              <span className="block truncate text-xs text-muted">
                {part.kind === 'custom' ? (
                  <>
                    <span className="font-semibold text-accent">Custom</span> v{part.version}
                    {formatDimensions(part.width_plates, part.depth_plates, part.height_plates) &&
                      ` · ${formatDimensions(part.width_plates, part.depth_plates, part.height_plates)}`}
                  </>
                ) : (
                  `#${part.design_id}`
                )}
              </span>
            </span>
          </span>
        );
      },
    },
    {
      id: 'color',
      header: 'Color',
      meta: { width: 'minmax(110px, 1.2fr)', sortField: 'color', minListWidth: 520 },
      cell: ({ row }) => (
        <Swatch
          rgb={row.original.color_rgb}
          name={row.original.color_name}
          transparent={row.original.color_is_transparent}
          showName
        />
      ),
    },
    {
      id: 'category',
      header: 'Category',
      meta: { width: 'minmax(90px, 1fr)', sortField: 'category', minListWidth: 760 },
      cell: ({ row }) => row.original.category,
    },
    {
      id: 'quantity',
      header: 'Qty',
      meta: { width: '64px', sortField: 'quantity', minListWidth: 0, align: 'right' },
      cell: ({ row }) => (
        <span className="font-semibold tabular-nums">{row.original.quantity}</span>
      ),
    },
    {
      id: 'location',
      header: 'Location',
      meta: { width: 'minmax(130px, 1.6fr)', sortField: 'location', minListWidth: 900 },
      cell: ({ row }) =>
        row.original.location_path || <span className="text-muted">No location</span>,
    },
    {
      id: 'created',
      header: 'Added',
      meta: { width: '96px', sortField: 'created_at', minListWidth: 1080 },
      cell: ({ row }) => row.original.created_at.slice(0, 10),
    },
  ];
}
