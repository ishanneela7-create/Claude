import { useState } from 'react';
import type { ImportMapping } from '@shared/importSchemas';
import { api, describeError } from '../../lib/api';
import { useDataStore } from '../../store/dataStore';
import { Modal } from '../ui/Modal';
import { ImportLog } from './ImportLog';
import { ImportMapper, type PreviewData } from './ImportMapper';

type Format = 'csv' | 'rebrickable';

export function ImportDialog({ onClose }: { onClose(): void }) {
  const [format, setFormat] = useState<Format>('csv');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('import.csv');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const bump = useDataStore((state) => state.bump);
  const toast = useDataStore((state) => state.toast);

  const loadPreview = async (nextText: string, nextFormat: Format, nextMapping?: ImportMapping) => {
    setBusy(true);
    setProblem(null);
    try {
      const result = await api.post<PreviewData>('/imports/preview', {
        format: nextFormat,
        text: nextText,
        mapping: nextMapping,
      });
      setPreview(result);
      if (!nextMapping) setMapping(result.mapping);
    } catch (error) {
      setPreview(null);
      setProblem(describeError(error));
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const content = await file.text();
    setText(content);
    setFileName(file.name);
    await loadPreview(content, format);
  };

  const commit = async () => {
    setBusy(true);
    try {
      const result = await api.post<{ import: { created_count: number; updated_count: number }; errors: unknown[] }>(
        '/imports',
        { format, text, source_name: fileName, mapping },
      );
      await bump();
      toast(
        'success',
        `Imported: ${result.import.created_count} added, ${result.import.updated_count} updated, ${result.errors.length} skipped. You can roll this back below.`,
      );
      setPreview(null);
      setText('');
    } catch (error) {
      setProblem(describeError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Import parts" onClose={onClose} wide>
      <div className="space-y-5">
        <fieldset>
          <legend className="mb-1 font-semibold">File type</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="format"
                checked={format === 'csv'}
                onChange={() => {
                  setFormat('csv');
                  if (text) void loadPreview(text, 'csv');
                }}
              />
              Any CSV (I will match the columns)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="format"
                checked={format === 'rebrickable'}
                onChange={() => {
                  setFormat('rebrickable');
                  if (text) void loadPreview(text, 'rebrickable');
                }}
              />
              Rebrickable parts export
            </label>
          </div>
        </fieldset>

        <div>
          <label htmlFor="import-file" className="label">
            Choose a .csv file
          </label>
          <input id="import-file" type="file" accept=".csv,text/csv" className="field" onChange={(event) => void onFile(event.target.files?.[0])} />
        </div>

        {busy && <p className="text-sm text-muted">Working…</p>}
        {problem && (
          <p role="alert" className="rounded-md border border-danger p-2 text-sm text-danger">
            {problem}
          </p>
        )}

        {preview && (
          <>
            <ImportMapper
              preview={preview}
              mapping={mapping}
              onMappingChange={(next) => {
                setMapping(next);
                void loadPreview(text, format, next);
              }}
            />
            <div className="flex gap-2">
              <button type="button" className="btn btn-accent" disabled={busy || preview.valid_rows === 0} onClick={() => void commit()}>
                Import {preview.valid_rows.toLocaleString()} rows
              </button>
              <button type="button" className="btn" onClick={() => setPreview(null)}>
                Cancel
              </button>
            </div>
          </>
        )}

        <section aria-label="Past imports">
          <h3 className="mb-2 font-semibold">Past imports</h3>
          <ImportLog />
        </section>
      </div>
    </Modal>
  );
}
