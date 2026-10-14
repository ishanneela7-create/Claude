import { CUSTOM_SOURCE_LABELS } from '@shared/constants';
import type { PartRecord, PhotoRecord } from '@shared/types';
import { formatDimensions } from '@shared/units';
import { renderMarkdown } from '../../lib/markdown';
import { PartThumb } from '../ui/PartThumb';
import { Swatch } from '../ui/Swatch';
import { PhotoGallery } from './PhotoGallery';
import { VersionHistory } from './VersionHistory';

type Detail = PartRecord & { photos: PhotoRecord[] };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 border-b border-line py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function PartDetails({ part }: { part: Detail }) {
  const size = formatDimensions(part.width_plates, part.depth_plates, part.height_plates);
  const editable = part.is_current;
  return (
    <div className="space-y-5">
      {!part.is_current && (
        <p role="note" className="rounded-md border border-line bg-raised p-2 text-sm">
          This is an old version (read only). Open the current version to edit.
        </p>
      )}
      <div className="flex items-center gap-3">
        <PartThumb imagePath={part.image_path} rgb={part.color_rgb} label={part.name} size={72} />
        <div className="min-w-0">
          <p className="text-xl font-bold leading-tight">{part.name}</p>
          <p className="flex items-center gap-2 text-sm text-muted">
            <Swatch
              rgb={part.color_rgb}
              name={part.color_name}
              transparent={part.color_is_transparent}
              size={14}
              showName
            />
          </p>
        </div>
      </div>

      <dl>
        <Row label="Quantity">
          <span className="text-lg font-bold text-accent">{part.quantity}</span>
        </Row>
        <Row label="Kind">
          {part.kind === 'custom' ? `Custom (version ${part.version})` : 'Official'}
        </Row>
        <Row label="Category">
          {part.category}
          {part.subcategory ? ` › ${part.subcategory}` : ''}
        </Row>
        <Row label="Location">{part.location_path || 'No location'}</Row>
        {part.kind === 'official' ? (
          <>
            <Row label="Design id">{part.design_id}</Row>
            {part.rebrickable_part_num && (
              <Row label="Rebrickable">{part.rebrickable_part_num}</Row>
            )}
            {part.ldraw_id && <Row label="LDraw id">{part.ldraw_id}</Row>}
            {part.year_introduced && <Row label="Year">{part.year_introduced}</Row>}
          </>
        ) : (
          <>
            <Row label="Source">
              {CUSTOM_SOURCE_LABELS[part.source as keyof typeof CUSTOM_SOURCE_LABELS] ??
                part.source}
            </Row>
            {part.creator && <Row label="Creator">{part.creator}</Row>}
            {size && <Row label="Size">{size} (studs x studs x plates)</Row>}
            {part.stud_pattern && <Row label="Stud pattern">{part.stud_pattern}</Row>}
            {part.material && <Row label="Material">{part.material}</Row>}
            {part.print_profile_notes && <Row label="Print notes">{part.print_profile_notes}</Row>}
          </>
        )}
        <Row label="Tags">
          {part.tags.length === 0
            ? '—'
            : part.tags.map((tag) => (
                <span key={tag} className="chip mr-1">
                  {tag}
                </span>
              ))}
        </Row>
        <Row label="Added">{part.created_at.slice(0, 10)}</Row>
      </dl>

      {part.notes && (
        <section aria-label="Notes">
          <h3 className="label">Notes</h3>
          <div
            className="space-y-1 text-sm [&_a]:text-brand [&_a]:underline [&_code]:rounded [&_code]:bg-raised [&_code]:px-1 [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(part.notes) }}
          />
        </section>
      )}

      <section aria-label="Photos section">
        <h3 className="label">Photos</h3>
        <PhotoGallery partId={part.id} photos={part.photos} editable={editable} />
      </section>

      {part.kind === 'custom' && (
        <section aria-label="Version history section">
          <h3 className="label">Version history</h3>
          <VersionHistory part={part} />
        </section>
      )}
    </div>
  );
}
