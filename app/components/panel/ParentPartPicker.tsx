import { useEffect, useState } from 'react';
import type { PartListResult, PartRecord } from '@shared/types';
import { api } from '../../lib/api';
import { useDebounced } from '../../hooks/useDebounced';

interface Props {
  id: string;
  value: string;
  onChange(partId: string): void;
}

/** Pick the official part this custom part is a variant of. */
export function ParentPartPicker({ id, value, onChange }: Props) {
  const [text, setText] = useState('');
  const [results, setResults] = useState<PartRecord[]>([]);
  const [current, setCurrent] = useState<PartRecord | null>(null);
  const query = useDebounced(text, 200);

  useEffect(() => {
    if (!value) {
      setCurrent(null);
      return;
    }
    api.get<PartRecord>(`/parts/${value}`).then(setCurrent).catch(() => setCurrent(null));
  }, [value]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    api
      .get<PartListResult>('/parts', { q: query, kind: 'official', limit: 8 })
      .then((result) => {
        if (!cancelled) setResults(result.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div>
      {current && (
        <p className="mb-2 flex items-center gap-2 text-sm">
          <span className="chip">
            {current.name} #{current.design_id} ({current.color_name})
          </span>
          <button type="button" className="text-xs font-semibold text-danger hover:underline" onClick={() => onChange('')}>
            Remove
          </button>
        </p>
      )}
      <input
        id={id}
        className="field"
        value={text}
        placeholder="Search official parts to link…"
        onChange={(event) => setText(event.target.value)}
        autoComplete="off"
      />
      {results.length > 0 && (
        <ul className="mt-1 max-h-40 overflow-auto rounded-md border border-line" aria-label="Matching official parts">
          {results.map((part) => (
            <li key={part.id}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-raised"
                onClick={() => {
                  onChange(part.id);
                  setText('');
                  setResults([]);
                }}
              >
                {part.name} #{part.design_id} · {part.color_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
