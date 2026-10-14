import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { FormValues } from '../../lib/partForm';
import { describedBy, Field } from './Field';

interface Props {
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
}

export function OfficialFields({ register, errors }: Props) {
  const message = (name: keyof FormValues) => errors[name]?.message as string | undefined;
  return (
    <>
      <Field id="design_id" label="Design id" error={message('design_id')} hint="The number printed on the part, e.g. 3001">
        <input id="design_id" className="field" aria-invalid={!!errors.design_id} aria-describedby={describedBy('design_id', message('design_id'), 'x')} {...register('design_id')} />
      </Field>
      <Field id="year_introduced" label="Year introduced" error={message('year_introduced')}>
        <input id="year_introduced" type="number" className="field" {...register('year_introduced')} />
      </Field>
      <Field id="rebrickable_part_num" label="Rebrickable part number" error={message('rebrickable_part_num')}>
        <input id="rebrickable_part_num" className="field" {...register('rebrickable_part_num')} />
      </Field>
      <Field id="ldraw_id" label="LDraw id" error={message('ldraw_id')}>
        <input id="ldraw_id" className="field" {...register('ldraw_id')} />
      </Field>
    </>
  );
}
