import { IMPORT_TARGET_FIELDS, type ImportMapping } from '@shared/importSchemas';

export interface PreviewData {
  headers: string[];
  mapping: ImportMapping;
  total_rows: number;
  valid_rows: number;
  sample: Array<{ cells: string[]; error: string | null; result: string | null }>;
  errors: Array<{ row: number; message: string }>;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  design_id: 'Design id',
  category: 'Category',
  subcategory: 'Subcategory',
  color: 'Color (name or id)',
  quantity: 'Quantity',
  location: 'Location (Room > Cabinet > Bin)',
  notes: 'Notes',
  tags: 'Tags (separate with ;)',
  kind: 'Kind (official / custom)',
  rebrickable_part_num: 'Rebrickable part number',
  ldraw_id: 'LDraw id',
  year_introduced: 'Year introduced',
  source: 'Custom: source',
  creator: 'Custom: creator',
  material: 'Custom: material',
  width_plates: 'Custom: width',
  depth_plates: 'Custom: depth',
  height_plates: 'Custom: height',
  stud_pattern: 'Custom: stud pattern',
};

interface Props {
  preview: PreviewData;
  mapping: ImportMapping;
  onMappingChange(mapping: ImportMapping): void;
}

/** Pick what each CSV column means, and see the first 20 rows before importing. */
export function ImportMapper({ preview, mapping, onMappingChange }: Props) {
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 font-semibold">1. Match your columns</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {preview.headers.map((header, index) => (
            <div key={`${header}-${index}`}>
              <label htmlFor={`map-${index}`} className="label">
                Column “{header}”
              </label>
              <select
                id={`map-${index}`}
                className="field"
                value={mapping[header] ?? ''}
                onChange={(event) =>
                  onMappingChange({ ...mapping, [header]: event.target.value as ImportMapping[string] })
                }
              >
                <option value="">Skip this column</option>
                {IMPORT_TARGET_FIELDS.map((field) => (
                  <option key={field} value={field}>
                    {FIELD_LABELS[field] ?? field}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </fieldset>

      <section aria-label="Preview">
        <h3 className="mb-1 font-semibold">2. Check the first {preview.sample.length} rows</h3>
        <p className="mb-2 text-sm" aria-live="polite">
          {preview.valid_rows.toLocaleString()} of {preview.total_rows.toLocaleString()} rows are ready to import.
          {preview.total_rows - preview.valid_rows > 0 &&
            ` ${(preview.total_rows - preview.valid_rows).toLocaleString()} rows have problems and will be skipped.`}
        </p>
        <div className="max-h-64 overflow-auto rounded-md border border-line">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-raised">
              <tr>
                <th scope="col" className="p-2">
                  Result
                </th>
                {preview.headers.map((header, index) => (
                  <th key={`${header}-${index}`} scope="col" className="p-2">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.sample.map((row, index) => (
                <tr key={index} className={row.error ? 'bg-danger/10' : ''}>
                  <td className="p-2 font-semibold">{row.error ? <span className="text-danger">{row.error}</span> : <span className="text-accent">{row.result}</span>}</td>
                  {preview.headers.map((header, column) => (
                    <td key={`${header}-${column}`} className="p-2">
                      {row.cells[column]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
