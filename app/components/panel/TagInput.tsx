import { useState, type KeyboardEvent } from 'react';
import { useDataStore } from '../../store/dataStore';
import { Icon } from '../ui/Icon';

interface TagInputProps {
  id: string;
  value: string[];
  onChange(tags: string[]): void;
}

/** Type a tag and press Enter or comma. Existing tags are suggested. */
export function TagInput({ id, value, onChange }: TagInputProps) {
  const [draft, setDraft] = useState('');
  const known = useDataStore((state) => state.tags);

  const add = (raw: string) => {
    const name = raw.trim();
    if (name && !value.some((tag) => tag.toLowerCase() === name.toLowerCase())) onChange([...value, name]);
    setDraft('');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(draft);
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1" aria-live="polite">
        {value.map((tag) => (
          <span key={tag} className="chip">
            {tag}
            <button
              type="button"
              className="rounded-full hover:text-danger"
              aria-label={`Remove tag ${tag}`}
              onClick={() => onChange(value.filter((item) => item !== tag))}
            >
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}
      </div>
      <input
        id={id}
        className="field"
        list={`${id}-suggestions`}
        value={draft}
        placeholder="Add a tag, press Enter"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(draft)}
      />
      <datalist id={`${id}-suggestions`}>
        {known.map((tag) => (
          <option key={tag.id} value={tag.name} />
        ))}
      </datalist>
    </div>
  );
}
