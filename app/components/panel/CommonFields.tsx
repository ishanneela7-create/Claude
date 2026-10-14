import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { CATEGORIES } from '@shared/constants';
import { flattenLocations, useDataStore } from '../../store/dataStore';
import type { FormValues } from '../../lib/partForm';
import { Swatch } from '../ui/Swatch';
import { describedBy, Field } from './Field';
import { TagInput } from './TagInput';

interface Props {
  register: UseFormRegister<FormValues>;
  control: Control<FormValues, unknown, unknown>;
  errors: FieldErrors<FormValues>;
  colorId: string;
}

/** Fields that both official and custom parts have. */
export function CommonFields({ register, control, errors, colorId }: Props) {
  const colors = useDataStore((state) => state.colors);
  const locations = useDataStore((state) => state.locations);
  const picked = colors.find((color) => String(color.id) === colorId);
  const message = (name: keyof FormValues) => errors[name]?.message as string | undefined;

  return (
    <>
      <Field id="name" label="Name" error={message('name')} className="col-span-2">
        <input id="name" className="field" aria-invalid={!!errors.name} aria-describedby={describedBy('name', message('name'))} {...register('name')} />
      </Field>

      <Field id="category" label="Category" error={message('category')}>
        <select id="category" className="field" {...register('category')}>
          {CATEGORIES.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </Field>
      <Field id="subcategory" label="Subcategory (optional)" error={message('subcategory')}>
        <input id="subcategory" className="field" {...register('subcategory')} />
      </Field>

      <Field id="color_id" label="Color" error={message('color_id')} className="col-span-2">
        <div className="flex items-center gap-2">
          {picked && <Swatch rgb={picked.rgb} name={picked.name} transparent={picked.is_transparent} size={24} />}
          <select id="color_id" className="field" aria-invalid={!!errors.color_id} aria-describedby={describedBy('color_id', message('color_id'))} {...register('color_id')}>
            <option value="">Choose a color…</option>
            {colors.map((color) => (
              <option key={color.id} value={color.id}>
                {color.name}
                {color.is_custom ? ' (custom)' : ''}
              </option>
            ))}
          </select>
        </div>
      </Field>

      <Field id="quantity" label="Quantity" error={message('quantity')}>
        <input id="quantity" type="number" min={0} step={1} inputMode="numeric" className="field" aria-invalid={!!errors.quantity} {...register('quantity')} />
      </Field>
      <Field id="location_id" label="Location" error={message('location_id')}>
        <select id="location_id" className="field" {...register('location_id')}>
          <option value="">No location</option>
          {flattenLocations(locations).map((node) => (
            <option key={node.id} value={node.id}>
              {' '.repeat(node.depth)}
              {node.name}
            </option>
          ))}
        </select>
      </Field>

      <Field id="tags" label="Tags" className="col-span-2">
        <Controller control={control} name="tags" render={({ field }) => <TagInput id="tags" value={field.value} onChange={field.onChange} />} />
      </Field>
      <Field id="notes" label="Notes (markdown)" error={message('notes')} className="col-span-2">
        <textarea id="notes" rows={4} className="field" {...register('notes')} />
      </Field>
    </>
  );
}
