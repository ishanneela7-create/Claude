import { api, describeError } from '../../lib/api';
import { useLibraryQuery } from '../../hooks/useLibraryQuery';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';

/** Shows when parts are ticked: edit them together, or select everything that matches. */
export function BulkBar() {
  const selected = useUiStore((state) => state.selectedIds);
  const setSelected = useUiStore((state) => state.setSelected);
  const clear = useUiStore((state) => state.clearSelection);
  const openDialog = useUiStore((state) => state.openDialog);
  const toast = useDataStore((state) => state.toast);
  const params = useLibraryQuery();
  if (selected.size === 0) return null;

  const selectAll = async () => {
    try {
      const { sort: _sort, dir: _dir, ...filter } = params;
      void _sort;
      void _dir;
      const ids = await api.get<string[]>('/parts/ids', filter);
      setSelected(ids);
    } catch (error) {
      toast('error', describeError(error));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-accent/10 px-3 py-2 text-sm" role="region" aria-label="Selected parts">
      <strong>{selected.size.toLocaleString()} selected</strong>
      <button type="button" className="btn btn-accent" onClick={() => openDialog('bulk')}>
        Edit selected…
      </button>
      <button type="button" className="btn" onClick={() => void selectAll()}>
        Select everything that matches
      </button>
      <button type="button" className="btn" onClick={clear}>
        Clear selection
      </button>
    </div>
  );
}
