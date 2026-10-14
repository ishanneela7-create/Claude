import { useState } from 'react';
import type { LocationNode } from '@shared/types';
import { CATEGORIES } from '@shared/constants';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { Icon } from '../ui/Icon';

function SectionTitle({ children, action }: { children: string; action?: React.ReactNode }) {
  return (
    <div className="mb-1 mt-4 flex items-center justify-between px-2">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted">{children}</h2>
      {action}
    </div>
  );
}

function itemClass(active: boolean): string {
  return `flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${active ? 'bg-brand/15 font-semibold text-brand' : 'hover:bg-raised'}`;
}

function LocationItem({ node, depth }: { node: LocationNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const filters = useUiStore((state) => state.filters);
  const setFilters = useUiStore((state) => state.setFilters);
  const openDialog = useUiStore((state) => state.openDialog);
  const active = filters.location_id === node.id;
  const hasChildren = node.children.length > 0;

  return (
    <li role="treeitem" aria-expanded={hasChildren ? open : undefined} aria-selected={active}>
      <div className="flex items-center" style={{ paddingLeft: depth * 12 }}>
        {hasChildren ? (
          <button
            type="button"
            className="btn-icon !h-7 !w-7"
            aria-label={`${open ? 'Collapse' : 'Expand'} ${node.name}`}
            onClick={() => setOpen(!open)}
          >
            <Icon name={open ? 'down' : 'right'} size={14} />
          </button>
        ) : (
          <span className="inline-block w-7" />
        )}
        <button
          type="button"
          className={itemClass(active)}
          onClick={() => setFilters(active ? {} : { location_id: node.id })}
          onDoubleClick={() => {
            useUiStore.setState({ focusedLocationId: node.id });
            openDialog('locations');
          }}
        >
          {node.color_code && (
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-sm border border-ink/30"
              style={{ backgroundColor: `#${node.color_code}` }}
              aria-hidden="true"
            />
          )}
          <span className="truncate">{node.label || node.name}</span>
          <span className="ml-auto text-xs text-muted">{node.total_part_count}</span>
        </button>
      </div>
      {hasChildren && open && (
        <ul role="group">
          {node.children.map((child) => (
            <LocationItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function SidebarContent() {
  const locations = useDataStore((state) => state.locations);
  const views = useDataStore((state) => state.views);
  const tags = useDataStore((state) => state.tags);
  const filters = useUiStore((state) => state.filters);
  const setFilters = useUiStore((state) => state.setFilters);
  const openDialog = useUiStore((state) => state.openDialog);
  const hasFilter = Object.keys(filters).length > 0;

  return (
    <nav aria-label="Library navigation" className="flex-1 overflow-auto p-2">
      <button type="button" className={itemClass(!hasFilter)} onClick={() => setFilters({})}>
        <Icon name="box" size={16} /> All parts
      </button>

      <SectionTitle>Smart views</SectionTitle>
      <ul>
        {views.map((view) => (
          <li key={view.id}>
            <button
              type="button"
              className={itemClass(filters.viewId === view.id)}
              onClick={() => setFilters(filters.viewId === view.id ? {} : { viewId: view.id })}
            >
              <Icon name="eye" size={16} /> <span className="truncate">{view.name}</span>
            </button>
          </li>
        ))}
      </ul>

      <SectionTitle
        action={
          <button
            type="button"
            className="text-xs font-semibold text-brand hover:underline"
            onClick={() => openDialog('locations')}
          >
            Manage
          </button>
        }
      >
        Locations
      </SectionTitle>
      {locations.length === 0 ? (
        <p className="px-2 text-sm text-muted">No locations yet.</p>
      ) : (
        <ul role="tree" aria-label="Locations">
          {locations.map((node) => (
            <LocationItem key={node.id} node={node} depth={0} />
          ))}
        </ul>
      )}

      <SectionTitle>Categories</SectionTitle>
      <ul>
        {CATEGORIES.map((category) => (
          <li key={category}>
            <button
              type="button"
              className={itemClass(filters.category === category)}
              onClick={() => setFilters(filters.category === category ? {} : { category })}
            >
              {category}
            </button>
          </li>
        ))}
      </ul>

      <SectionTitle>Tags</SectionTitle>
      {tags.length === 0 ? (
        <p className="px-2 text-sm text-muted">No tags yet.</p>
      ) : (
        <ul>
          {tags.map((tag) => (
            <li key={tag.id}>
              <button
                type="button"
                className={itemClass(filters.tag === tag.name)}
                onClick={() => setFilters(filters.tag === tag.name ? {} : { tag: tag.name })}
              >
                <Icon name="tag" size={14} /> <span className="truncate">{tag.name}</span>
                <span className="ml-auto text-xs text-muted">{tag.part_count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

export function Sidebar() {
  const open = useUiStore((state) => state.sidebarOpen);
  const setOpen = useUiStore((state) => state.setSidebarOpen);
  const stats = useDataStore((state) => state.stats);

  const footer = (
    <p className="border-t border-line px-3 py-2 text-xs text-muted">
      {stats.parts.toLocaleString()} parts · {stats.pieces.toLocaleString()} pieces
    </p>
  );

  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <SidebarContent />
        {footer}
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <aside
            className="absolute inset-y-0 left-0 flex w-[min(86vw,320px)] flex-col bg-surface shadow-xl"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest('button')) setOpen(false);
            }}
          >
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="font-bold text-brand">Brick Library</span>
              <button
                type="button"
                className="btn-icon"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            <SidebarContent />
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}
