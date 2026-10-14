interface PartThumbProps {
  imagePath: string | null;
  rgb: string;
  label: string;
  size: number;
}

/** The part photo, or a simple drawn brick in the part color (our own artwork). */
export function PartThumb({ imagePath, rgb, label, size }: PartThumbProps) {
  if (imagePath) {
    return (
      <img
        src={imagePath}
        alt=""
        loading="lazy"
        decoding="async"
        width={size}
        height={size}
        className="shrink-0 rounded object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label={`Placeholder picture for ${label}`}
      className="shrink-0"
    >
      <rect x="4" y="16" width="32" height="20" rx="3" fill={`#${rgb}`} stroke="currentColor" strokeOpacity="0.5" />
      <rect x="9" y="9" width="8" height="8" rx="2" fill={`#${rgb}`} stroke="currentColor" strokeOpacity="0.5" />
      <rect x="23" y="9" width="8" height="8" rx="2" fill={`#${rgb}`} stroke="currentColor" strokeOpacity="0.5" />
    </svg>
  );
}
