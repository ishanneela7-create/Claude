import { lazy, Suspense, useState } from 'react';
import type { ParsedModel } from '../../lib/modelBounds';
import type { PlateDimensions } from '@shared/units';

const ModelViewer = lazy(() => import('./ModelViewer'));

interface Props {
  /** Called with the measured size so the form can fill in the dimension boxes. */
  onMeasured(dimensions: PlateDimensions): void;
}

export function ModelPicker({ onMeasured }: Props) {
  const [model, setModel] = useState<ParsedModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      /* three.js is only downloaded the first time someone picks a model. */
      const { parseModelFile } = await import('../../lib/modelBounds');
      const parsed = await parseModelFile(file);
      setModel(parsed);
      onMeasured(parsed.dimensions);
    } catch (caught) {
      setModel(null);
      setError(caught instanceof Error ? caught.message : 'Could not read that file');
    } finally {
      setBusy(false);
    }
  };

  return (
    <fieldset className="col-span-2 rounded-md border border-line p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
        3D preview (optional)
      </legend>
      <label htmlFor="model-file" className="label">
        Choose an STL or OBJ file
      </label>
      <input
        id="model-file"
        type="file"
        accept=".stl,.obj"
        className="field"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      {busy && <p className="mt-2 text-sm text-muted">Reading the model…</p>}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {model && (
        <div className="mt-3 space-y-2">
          <Suspense fallback={<p className="text-sm text-muted">Loading 3D viewer…</p>}>
            <ModelViewer object={model.object} />
          </Suspense>
          <p className="text-sm" aria-live="polite">
            Size: {model.size.x.toFixed(1)} x {model.size.y.toFixed(1)} x {model.size.z.toFixed(1)} mm.
            Filled in as {model.dimensions.width} x {model.dimensions.depth} studs, {model.dimensions.height}{' '}
            plates tall (you can still edit the numbers).
          </p>
        </div>
      )}
    </fieldset>
  );
}
