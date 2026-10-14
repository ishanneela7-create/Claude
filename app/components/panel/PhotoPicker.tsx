import { useEffect, useMemo } from 'react';
import { MAX_PHOTOS_PER_PART } from '@shared/constants';
import { Icon } from '../ui/Icon';

interface Props {
  files: File[];
  onChange(files: File[]): void;
  /** How many photos the part already has. */
  existing?: number;
  /** Called right away with the new files instead of keeping a waiting list. */
  onAddNow?(files: File[]): void;
  label?: string;
}

/** Choose photos (max 10 per part). They are resized to 1024px wide when saved. */
export function PhotoPicker({ files, onChange, existing = 0, onAddNow, label = 'Photos' }: Props) {
  const room = MAX_PHOTOS_PER_PART - existing - files.length;
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const accept = (list: FileList | null) => {
    const chosen = [...(list ?? [])].filter((file) => file.type.startsWith('image/')).slice(0, Math.max(0, room));
    if (chosen.length === 0) return;
    if (onAddNow) onAddNow(chosen);
    else onChange([...files, ...chosen]);
  };

  return (
    <div>
      <label htmlFor="photo-files" className="label">
        {label} ({existing + files.length} of {MAX_PHOTOS_PER_PART})
      </label>
      <input
        id="photo-files"
        type="file"
        accept="image/*"
        multiple
        className="field"
        disabled={room <= 0}
        onChange={(event) => {
          accept(event.target.files);
          event.target.value = '';
        }}
      />
      {room <= 0 && <p className="mt-1 text-xs text-muted">This part has the maximum of {MAX_PHOTOS_PER_PART} photos.</p>}
      {files.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Photos waiting to be saved">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="relative">
              <img src={previews[index]} alt={`Waiting to upload: ${file.name}`} className="h-16 w-16 rounded object-cover" />
              <button
                type="button"
                className="absolute -right-1 -top-1 rounded-full bg-danger p-0.5 text-white"
                aria-label={`Remove ${file.name}`}
                onClick={() => onChange(files.filter((_, position) => position !== index))}
              >
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
