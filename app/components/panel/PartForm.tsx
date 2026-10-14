import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { PartInput } from '@shared/partSchemas';
import type { PartRecord } from '@shared/types';
import { api, describeError } from '../../lib/api';
import { emptyValues, partFormSchema, valuesFromPart, type FormValues } from '../../lib/partForm';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { CommonFields } from './CommonFields';
import { CustomFields } from './CustomFields';
import { OfficialFields } from './OfficialFields';
import { PhotoPicker } from './PhotoPicker';
import { uploadPhotos } from './PhotoGallery';

interface Props {
  /** The part being edited, or null to make a new one. */
  part: PartRecord | null;
  kind: 'official' | 'custom';
  onDone(): void;
}

export function PartForm({ part, kind, onDone }: Props) {
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const bump = useDataStore((state) => state.bump);
  const toast = useDataStore((state) => state.toast);
  const openPart = useUiStore((state) => state.openPart);
  const partKind = part?.kind ?? kind;

  const { register, control, handleSubmit, setValue, watch, formState } = useForm<
    FormValues,
    unknown,
    PartInput
  >({
    resolver: zodResolver(partFormSchema),
    defaultValues: part ? valuesFromPart(part) : emptyValues(kind),
  });
  const { errors } = formState;

  const save = handleSubmit(async (input) => {
    setSaving(true);
    try {
      let saved: PartRecord;
      if (part) {
        const { kind: _kind, ...changes } = input;
        void _kind;
        saved = await api.patch<PartRecord>(`/parts/${part.id}`, changes);
      } else {
        saved = await api.post<PartRecord>('/parts', input);
      }
      if (pendingPhotos.length > 0) await uploadPhotos(saved.id, pendingPhotos);
      await bump();
      openPart(saved.id);
      if (part && saved.id !== part.id) toast('success', `Saved as version ${saved.version}`);
      else toast('success', 'Saved');
      if (saved.kind === 'official') {
        const groups = await api.get<Array<{ parts: Array<{ id: string }> }>>('/parts/duplicates');
        if (groups.some((group) => group.parts.some((item) => item.id === saved.id))) {
          toast(
            'info',
            'Another part has the same design id and color. Use "Find duplicates" in the menu to merge.',
          );
        }
      }
    } catch (error) {
      toast('error', describeError(error));
    } finally {
      setSaving(false);
    }
  });

  return (
    <form
      onSubmit={(event) => void save(event)}
      noValidate
      className="space-y-4"
      aria-label={part ? 'Edit part' : 'New part'}
    >
      {part?.kind === 'custom' && (
        <p className="rounded-md bg-accent/10 p-2 text-sm">
          Changing the design (name, size, studs, material…) saves a new version. Old versions stay
          viewable.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <CommonFields
          register={register}
          control={control}
          errors={errors}
          colorId={watch('color_id')}
        />
        {partKind === 'official' ? (
          <OfficialFields register={register} errors={errors} />
        ) : (
          <CustomFields register={register} control={control} setValue={setValue} errors={errors} />
        )}
      </div>
      {!part && <PhotoPicker files={pendingPhotos} onChange={setPendingPhotos} />}
      <div className="sticky bottom-0 flex gap-2 border-t border-line bg-surface py-3">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : part ? 'Save changes' : 'Create part'}
        </button>
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
