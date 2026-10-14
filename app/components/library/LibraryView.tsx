import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef } from 'react';
import { useElementWidth } from '../../hooks/useElementSize';
import { useLibraryQuery } from '../../hooks/useLibraryQuery';
import { usePagedParts } from '../../hooks/usePagedParts';
import { CARD_SIZE, GRID_GAP, ROW_HEIGHT } from '../../lib/density';
import { buildLines } from '../../lib/lines';
import { useUiStore } from '../../store/uiStore';
import { Icon } from '../ui/Icon';
import { PartCard } from './PartCard';
import { PartRow, TableHeader } from './PartsTable';

const GROUP_HEADER_HEIGHT = 38;

/** The main list. Only the lines on screen are drawn, and pages load as you scroll. */
export function LibraryView() {
  const params = useLibraryQuery();
  const viewMode = useUiStore((state) => state.viewMode);
  const density = useUiStore((state) => state.density);
  const group = useUiStore((state) => state.group);
  const collapsed = useUiStore((state) => state.collapsedGroups);
  const toggleGroup = useUiStore((state) => state.toggleGroup);

  const scrollRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(scrollRef);
  const paged = usePagedParts(params, group);

  const card = CARD_SIZE[density];
  const columns = viewMode === 'grid' ? Math.max(1, Math.floor((width + GRID_GAP) / (card.width + GRID_GAP))) : 1;
  const rowHeight = viewMode === 'grid' ? card.height + GRID_GAP : ROW_HEIGHT[density];

  const groupsReady = group === null || paged.groups !== null;
  const lines = useMemo(
    () =>
      groupsReady
        ? buildLines({ total: paged.total, groups: paged.groups, collapsed, columns })
        : [],
    [groupsReady, paged.total, paged.groups, collapsed, columns],
  );

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (lines[index]?.kind === 'header' ? GROUP_HEADER_HEIGHT : rowHeight),
    overscan: 8,
  });
  const items = virtualizer.getVirtualItems();

  useEffect(() => {
    virtualizer.measure();
  }, [rowHeight, lines, virtualizer]);

  const { ensureRow } = paged;
  useEffect(() => {
    for (const item of items) {
      const line = lines[item.index];
      if (line?.kind === 'cells') {
        ensureRow(line.start);
        ensureRow(line.start + line.length - 1);
      }
    }
  }, [items, lines, ensureRow]);

  const isEmpty = !paged.loading && paged.total === 0 && !paged.error;

  return (
    <section aria-label="Parts" className="flex min-h-0 flex-1 flex-col">
      {viewMode === 'table' && width > 0 && <TableHeader listWidth={width} />}
      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-auto"
        role={viewMode === 'table' ? 'grid' : 'list'}
        aria-label={viewMode === 'table' ? 'Parts table' : 'Parts grid'}
        aria-rowcount={paged.total + 1}
        aria-busy={paged.loading}
      >
        {paged.corrections && (
          <p role="status" className="border-b border-line bg-brand/10 px-3 py-2 text-sm">
            Nothing matched what you typed, so these are results for{' '}
            {paged.corrections.map((item) => `“${item.to}” (instead of “${item.from}”)`).join(', ')}.
          </p>
        )}
        {paged.error && (
          <p role="alert" className="m-4 rounded-md border border-danger p-3 text-sm text-danger">
            {paged.error}
          </p>
        )}
        {isEmpty && (
          <div className="m-8 text-center text-muted">
            <p className="text-lg font-semibold text-ink">No parts found</p>
            <p>Try a different search, or press N to add a part.</p>
          </div>
        )}
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
          {items.map((item) => {
            const line = lines[item.index];
            if (!line) return null;
            const style = {
              position: 'absolute' as const,
              top: 0,
              left: 0,
              width: '100%',
              height: item.size,
              transform: `translateY(${item.start}px)`,
            };
            if (line.kind === 'header') {
              return (
                <div key={`h-${line.key}`} style={style} role="row">
                  <button
                    type="button"
                    className="flex h-full w-full items-center gap-2 border-b border-line bg-raised px-3 text-left text-sm font-semibold"
                    aria-expanded={!line.collapsed}
                    onClick={() => toggleGroup(line.key)}
                  >
                    <Icon name={line.collapsed ? 'right' : 'down'} size={16} />
                    <span className="truncate">{line.key}</span>
                    <span className="chip">{line.count}</span>
                  </button>
                </div>
              );
            }
            if (viewMode === 'table') {
              return (
                <div key={`r-${line.start}`} style={style}>
                  <PartRow
                    part={paged.getRow(line.start)}
                    listWidth={width}
                    rowIndex={line.start}
                    height={item.size}
                  />
                </div>
              );
            }
            return (
              <div
                key={`c-${line.start}`}
                style={{ ...style, display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: GRID_GAP, padding: `0 ${GRID_GAP}px` }}
                role="listitem"
              >
                {Array.from({ length: line.length }, (_, offset) => (
                  <PartCard key={line.start + offset} part={paged.getRow(line.start + offset)} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <p className="border-t border-line px-3 py-1 text-xs text-muted" aria-live="polite">
        {paged.total.toLocaleString()} {paged.total === 1 ? 'part' : 'parts'}
      </p>
    </section>
  );
}
