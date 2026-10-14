import { flexRender, getCoreRowModel, useReactTable, type SortingState } from '@tanstack/react-table';
import { useMemo } from 'react';
import type { PartRecord } from '@shared/types';
import { Icon } from '../ui/Icon';
import { useUiStore } from '../../store/uiStore';
import { makeColumns } from './columns';

function templateFor(columns: ReturnType<typeof makeColumns>): string {
  return ['36px', ...columns.map((column) => column.meta?.width ?? '1fr')].join(' ');
}

export function useTableColumns(listWidth: number) {
  const density = useUiStore((state) => state.density);
  return useMemo(
    () => makeColumns(density).filter((column) => (column.meta?.minListWidth ?? 0) <= listWidth),
    [density, listWidth],
  );
}

/** Sort header built with TanStack Table (sorting itself is done by the server). */
export function TableHeader({ listWidth }: { listWidth: number }) {
  const sort = useUiStore((state) => state.sort);
  const dir = useUiStore((state) => state.dir);
  const setSort = useUiStore((state) => state.setSort);
  const columns = useTableColumns(listWidth);
  const sorting: SortingState = [];
  const active = columns.find((column) => column.meta?.sortField === sort);
  if (active?.id) sorting.push({ id: active.id, desc: dir === 'desc' });

  const table = useReactTable({
    data: [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    state: { sorting },
  });

  return (
    <div
      role="row"
      className="grid items-center gap-2 border-b border-line bg-raised px-2 text-xs font-semibold uppercase tracking-wide text-muted"
      style={{ gridTemplateColumns: templateFor(columns), height: 38 }}
    >
      <span role="columnheader">
        <span className="sr-only">Select</span>
      </span>
      {table.getFlatHeaders().map((header) => {
        const field = header.column.columnDef.meta?.sortField;
        const direction = header.column.getIsSorted();
        return (
          <span
            key={header.id}
            role="columnheader"
            aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
            className={header.column.columnDef.meta?.align === 'right' ? 'text-right' : ''}
          >
            {field ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 uppercase hover:text-ink"
                onClick={() => setSort(field)}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
                {direction && <Icon name="down" size={12} className={direction === 'asc' ? 'rotate-180' : ''} />}
              </button>
            ) : (
              flexRender(header.column.columnDef.header, header.getContext())
            )}
          </span>
        );
      })}
    </div>
  );
}

interface RowProps {
  part: PartRecord | null;
  listWidth: number;
  rowIndex: number;
  height: number;
}

export function PartRow({ part, listWidth, rowIndex, height }: RowProps) {
  const columns = useTableColumns(listWidth);
  const selected = useUiStore((state) => (part ? state.selectedIds.has(part.id) : false));
  const active = useUiStore((state) => part !== null && state.activePartId === part.id);
  const toggleSelected = useUiStore((state) => state.toggleSelected);
  const openPart = useUiStore((state) => state.openPart);
  const data = useMemo(() => (part ? [part] : []), [part]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });
  const row = table.getRowModel().rows[0];

  return (
    <div
      role="row"
      aria-rowindex={rowIndex + 2}
      aria-selected={selected}
      className={`grid items-center gap-2 border-b border-line px-2 text-sm ${active ? 'bg-brand/15' : selected ? 'bg-accent/10' : 'hover:bg-raised'}`}
      style={{ gridTemplateColumns: templateFor(columns), height }}
    >
      {part && row ? (
        <>
          <span role="gridcell" className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[rgb(var(--accent))]"
              checked={selected}
              onChange={() => toggleSelected(part.id)}
              aria-label={`Select ${part.name}, ${part.color_name}`}
            />
          </span>
          {row.getVisibleCells().map((cell, index) => (
            <span
              key={cell.id}
              role="gridcell"
              className={`min-w-0 truncate ${cell.column.columnDef.meta?.align === 'right' ? 'text-right' : ''}`}
            >
              {index === 0 ? (
                <button
                  type="button"
                  className="block w-full min-w-0 text-left"
                  onClick={() => openPart(part.id)}
                  aria-label={`Open ${part.name}, ${part.color_name}`}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </button>
              ) : (
                flexRender(cell.column.columnDef.cell, cell.getContext())
              )}
            </span>
          ))}
        </>
      ) : (
        <span role="gridcell" className="col-span-full h-3 animate-pulse rounded bg-raised" aria-label="Loading" />
      )}
    </div>
  );
}
