interface SwatchProps {
  rgb: string;
  name: string;
  transparent?: boolean;
  size?: number;
  /** Show the color name next to the swatch. */
  showName?: boolean;
}

/** A color chip. Screen readers hear the color name. */
export function Swatch({
  rgb,
  name,
  transparent = false,
  size = 16,
  showName = false,
}: SwatchProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-block shrink-0 rounded border border-ink/30 ${transparent ? 'checker' : ''}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <span
          className="block h-full w-full rounded-[3px]"
          style={{ backgroundColor: `#${rgb}`, opacity: transparent ? 0.6 : 1 }}
        />
      </span>
      {showName ? <span>{name}</span> : <span className="sr-only">Color: {name}</span>}
    </span>
  );
}
