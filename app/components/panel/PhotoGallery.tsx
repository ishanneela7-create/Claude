import { useState } from 'react';
import type { PhotoRecord } from '@shared/types';
import { api, describeError } from '../../lib/api';
import { useDataStore } from '../../store/dataStore';
import { Icon } from '../ui/Icon';
import { PhotoPicker } from './PhotoPicker';

interface Props {
  partId: string;
  photos: PhotoRecord[];
  editable: boolean;
}

export async function uploadPhotos(partId: string, files: File[]): Promise<void> {
  for (const file of files) {
    const form = new FormData();
    form.append('photo', file);
    await api.upload(`/parts/${partId}/photos`, form);
  }
}

export function PhotoGallery({ partId, photos, editable }: Props) {
  const [selected, setSelected] = useState(0);
  const bump = useDataStore((state) => state.bump);
  const toast = useDataStore((state) => state.toast);
  const current = photos[Math.min(selected, photos.length - 1)];

  const addNow = async (files: File[]) => {
    try {
      await uploadPhotos(partId, files);
      await bump();
    } catch (error) {
      toast('error', describeError(error));
    }
  };
  const remove = async (photoId: string) => {
    try {
      await api.delete(`/parts/${partId}/photos/${photoId}`);
      setSelected(0);
      await bump();
    } catch (error) {
      toast('error', describeError(error));
    }
  };

  return (
    <section aria-label="Photos" className="space-y-2">
      {current ? (
        <a
          href={current.url}
          target="_blank"
          rel="noreferrer"
          aria-label="Open the full size photo"
        >
          <img
            src={current.url}
            alt={`Photo ${photos.indexOf(current) + 1} of ${photos.length}`}
            loading="lazy"
            className="max-h-64 w-full rounded-md border border-line object-contain"
          />
        </a>
      ) : (
        <p className="text-sm text-muted">No photos yet.</p>
      )}
      {photos.length > 1 && (
        <ul className="flex flex-wrap gap-2">
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <button
                type="button"
                className={`rounded border-2 ${index === selected ? 'border-brand' : 'border-transparent'}`}
                aria-label={`Show photo ${index + 1}`}
                aria-pressed={index === selected}
                onClick={() => setSelected(index)}
              >
                <img
                  src={photo.thumb_url}
                  alt=""
                  loading="lazy"
                  className="h-12 w-12 rounded object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <>
          {current && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => void remove(current.id)}
            >
              <Icon name="trash" size={16} /> Remove this photo
            </button>
          )}
          <PhotoPicker
            files={[]}
            onChange={() => undefined}
            existing={photos.length}
            label="Add photos"
            onAddNow={(files) => void addNow(files)}
          />
        </>
      )}
    </section>
  );
}
