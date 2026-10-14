import { useDataStore } from '../../store/dataStore';

const STYLE = {
  info: 'border-brand',
  success: 'border-accent',
  error: 'border-danger',
} as const;

export function Toasts() {
  const toasts = useDataStore((state) => state.toasts);
  const dismiss = useDataStore((state) => state.dismissToast);
  return (
    <div
      className="pointer-events-none fixed bottom-3 left-1/2 z-[60] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start justify-between gap-3 rounded-md border-l-4 bg-surface px-3 py-2 text-sm shadow-lg ring-1 ring-line ${STYLE[toast.kind]}`}
        >
          <span>{toast.text}</span>
          <button
            type="button"
            className="font-semibold text-muted hover:text-ink"
            onClick={() => dismiss(toast.id)}
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
