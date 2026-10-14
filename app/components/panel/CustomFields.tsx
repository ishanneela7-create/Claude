import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import { CUSTOM_SOURCE_LABELS, CUSTOM_SOURCES, MATERIALS } from '@shared/constants';
import type { FormValues } from '../../lib/partForm';
import { Field } from './Field';
import { ModelPicker } from './ModelPicker';
import { ParentPartPicker } from './ParentPartPicker';

interface Props {
  register: UseFormRegister<FormValues>;
  control: Control<FormValues, unknown, unknown>;
  setValue: UseFormSetValue<FormValues>;
  errors: FieldErrors<FormValues>;
}

/** The custom part builder fields. */
export function CustomFields({ register, control, setValue, errors }: Props) {
  const message = (name: keyof FormValues) => errors[name]?.message as string | undefined;
  return (
    <>
      <Field id="source" label="Source" error={message('source')}>
        <select id="source" className="field" {...register('source')}>
          {CUSTOM_SOURCES.map((source) => (
            <option key={source} value={source}>
              {CUSTOM_SOURCE_LABELS[source]}
            </option>
          ))}
        </select>
      </Field>
      <Field id="creator" label="Creator (optional)" error={message('creator')}>
        <input id="creator" className="field" {...register('creator')} />
      </Field>

      <fieldset className="col-span-2">
        <legend className="label">Size (studs wide, studs deep, plates tall)</legend>
        <div className="grid grid-cols-3 gap-2">
          {(['width_plates', 'depth_plates', 'height_plates'] as const).map((name, index) => (
            <div key={name}>
              <label htmlFor={name} className="sr-only">
                {['Width in studs', 'Depth in studs', 'Height in plates'][index]}
              </label>
              <input
                id={name}
                type="number"
                min={0}
                step="any"
                className="field"
                placeholder={['Width', 'Depth', 'Height'][index]}
                aria-invalid={!!errors[name]}
                {...register(name)}
              />
              {errors[name] && (
                <p role="alert" className="error-text">
                  {errors[name]?.message}
                </p>
              )}
            </div>
          ))}
        </div>
      </fieldset>

      <Field
        id="stud_pattern"
        label="Stud pattern"
        error={message('stud_pattern')}
        className="col-span-2"
        hint='Describe where the studs go, e.g. "2 x 4 full grid" or "ring of 8"'
      >
        <input id="stud_pattern" className="field" {...register('stud_pattern')} />
      </Field>

      <Field id="material" label="Material" error={message('material')}>
        <select id="material" className="field" {...register('material')}>
          <option value="">Not set</option>
          {MATERIALS.map((material) => (
            <option key={material}>{material}</option>
          ))}
        </select>
      </Field>
      <Field id="parent_part_id" label="Variant of (optional)" error={message('parent_part_id')}>
        <Controller
          control={control}
          name="parent_part_id"
          render={({ field }) => (
            <ParentPartPicker id="parent_part_id" value={field.value} onChange={field.onChange} />
          )}
        />
      </Field>

      <Field
        id="print_profile_notes"
        label="Print profile notes"
        error={message('print_profile_notes')}
        className="col-span-2"
      >
        <textarea
          id="print_profile_notes"
          rows={3}
          className="field"
          placeholder="Layer height, infill, supports, temperature…"
          {...register('print_profile_notes')}
        />
      </Field>

      <ModelPicker
        onMeasured={(size) => {
          const options = { shouldDirty: true, shouldValidate: true };
          setValue('width_plates', String(size.width), options);
          setValue('depth_plates', String(size.depth), options);
          setValue('height_plates', String(size.height), options);
        }}
      />
    </>
  );
}
