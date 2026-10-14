import { useEffect } from 'react';
import { BulkDialog } from './components/dialogs/BulkDialog';
import { ColorsDialog } from './components/dialogs/ColorsDialog';
import { DuplicatesDialog } from './components/dialogs/DuplicatesDialog';
import { ImportDialog } from './components/dialogs/ImportDialog';
import { LocationsDialog } from './components/dialogs/LocationsDialog';
import { ShortcutSheet } from './components/dialogs/ShortcutSheet';
import { BulkBar } from './components/layout/BulkBar';
import { FilterChips } from './components/layout/FilterChips';
import { Sidebar } from './components/layout/Sidebar';
import { Toolbar } from './components/layout/Toolbar';
import { LibraryView } from './components/library/LibraryView';
import { PartPanel } from './components/panel/PartPanel';
import { Toasts } from './components/ui/Toasts';
import { useShortcuts } from './hooks/useShortcuts';
import { useDataStore } from './store/dataStore';
import { useUiStore } from './store/uiStore';

function Dialogs() {
  const dialog = useUiStore((state) => state.dialog);
  const openDialog = useUiStore((state) => state.openDialog);
  const close = () => openDialog(null);
  switch (dialog) {
    case 'import':
      return <ImportDialog onClose={close} />;
    case 'shortcuts':
      return <ShortcutSheet onClose={close} />;
    case 'duplicates':
      return <DuplicatesDialog onClose={close} />;
    case 'locations':
      return <LocationsDialog onClose={close} />;
    case 'colors':
      return <ColorsDialog onClose={close} />;
    case 'bulk':
      return <BulkDialog onClose={close} />;
    default:
      return null;
  }
}

export default function App() {
  const refresh = useDataStore((state) => state.refresh);
  useShortcuts();

  useEffect(() => {
    void refresh();
    /* A bin's QR code opens the app with ?location=<id>, which filters to that bin. */
    const location = new URLSearchParams(window.location.search).get('location');
    if (location) useUiStore.getState().setFilters({ location_id: location });
  }, [refresh]);

  return (
    <div className="flex h-full flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[70] focus:rounded focus:bg-brand focus:px-3 focus:py-2 focus:text-brand-ink"
      >
        Skip to the parts list
      </a>
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main id="main" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
          <FilterChips />
          <BulkBar />
          <LibraryView />
        </main>
        <PartPanel />
      </div>
      <Dialogs />
      <Toasts />
    </div>
  );
}
