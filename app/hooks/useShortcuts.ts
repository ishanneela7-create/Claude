import { useEffect } from 'react';
import { useDataStore } from '../store/dataStore';
import { useUiStore } from '../store/uiStore';

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return (
    element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.tagName === 'SELECT' ||
    element.isContentEditable
  );
}

/** Global keys: / search, n new, e edit, Esc close, ? help, Ctrl+Z / Ctrl+Shift+Z undo / redo. */
export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const ui = useUiStore.getState();
      const data = useDataStore.getState();

      if ((event.ctrlKey || event.metaKey) && !isTyping(event.target)) {
        const key = event.key.toLowerCase();
        if (key === 'z') {
          event.preventDefault();
          void (event.shiftKey ? data.redo() : data.undo());
        } else if (key === 'y') {
          event.preventDefault();
          void data.redo();
        }
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      if (event.key === 'Escape') {
        if (ui.dialog) ui.openDialog(null);
        else if (ui.sidebarOpen) ui.setSidebarOpen(false);
        else if (ui.panelMode !== 'closed') ui.closePanel();
        else if (ui.selectedIds.size > 0) ui.clearSelection();
        return;
      }
      if (isTyping(event.target) || ui.dialog) return;

      if (event.key === '/') {
        event.preventDefault();
        document.getElementById('search')?.focus();
      } else if (event.key === 'n') {
        event.preventDefault();
        ui.startNewPart('official');
      } else if (event.key === 'e' && ui.activePartId) {
        event.preventDefault();
        ui.setPanelMode('edit');
      } else if (event.key === '?') {
        event.preventDefault();
        ui.openDialog('shortcuts');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}
