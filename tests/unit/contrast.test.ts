import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type Triplet = [number, number, number];

function readTokens(block: string): Record<string, Triplet> {
  const tokens: Record<string, Triplet> = {};
  for (const match of block.matchAll(/--([a-z-]+):\s*(\d+) (\d+) (\d+);/g)) {
    tokens[match[1] as string] = [Number(match[2]), Number(match[3]), Number(match[4])];
  }
  return tokens;
}

function luminance([red, green, blue]: Triplet): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

export function contrast(a: Triplet, b: Triplet): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

const css = fs.readFileSync(path.resolve(import.meta.dirname, '../../app/index.css'), 'utf8');
const lightBlock = /:root \{([^}]*)\}/.exec(css)?.[1] ?? '';
const darkBlock = /:root\[data-theme='dark'\] \{([^}]*)\}/.exec(css)?.[1] ?? '';
const systemDarkBlock = /:root:not\(\[data-theme='light'\]\) \{([^}]*)\}/.exec(css)?.[1] ?? '';

/** WCAG 2.1 AA: normal text needs 4.5:1. These are the pairs the app really uses. */
const PAIRS: Array<[string, string]> = [
  ['ink', 'page'],
  ['ink', 'surface'],
  ['ink', 'raised'],
  ['muted', 'page'],
  ['muted', 'surface'],
  ['muted', 'raised'],
  ['brand', 'surface'],
  ['brand', 'page'],
  ['brand-ink', 'brand'],
  ['accent', 'surface'],
  ['accent-ink', 'accent'],
  ['danger', 'surface'],
  ['danger', 'page'],
];

describe.each([
  ['light', lightBlock],
  ['dark', darkBlock],
  ['dark (system)', systemDarkBlock],
])('color contrast (%s theme)', (_name, block) => {
  const tokens = readTokens(block);
  it('defines every color', () => {
    expect(Object.keys(tokens).length).toBeGreaterThanOrEqual(11);
  });
  it.each(PAIRS)('%s on %s is at least 4.5:1', (foreground, background) => {
    const fg = tokens[foreground];
    const bg = tokens[background];
    expect(fg && bg).toBeTruthy();
    expect(contrast(fg as Triplet, bg as Triplet)).toBeGreaterThanOrEqual(4.5);
  });
  it('focus ring (brand) is at least 3:1 against the page', () => {
    expect(contrast(tokens.brand as Triplet, tokens.page as Triplet)).toBeGreaterThanOrEqual(3);
  });
});
