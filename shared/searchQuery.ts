export type QuantityOperator = '>' | '<' | '>=' | '<=' | '=';

export interface ParsedSearch {
  /** Plain words typed without an operator. */
  terms: string[];
  color?: string;
  category?: string;
  location?: string;
  tag?: string;
  quantity?: { operator: QuantityOperator; value: number };
  custom?: boolean;
}

/** Splits text into words, keeping "quoted phrases" and key:"quoted value" together. */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const pattern = /([^\s"]+:"[^"]*"|"[^"]*"|\S+)/g;
  for (const match of text.matchAll(pattern)) {
    tokens.push(match[0]);
  }
  return tokens;
}

function stripQuotes(value: string): string {
  return value.replace(/^"(.*)"$/, '$1');
}

export function parseQuantity(value: string): ParsedSearch['quantity'] {
  const match = /^(>=|<=|>|<|=)?(\d+)$/.exec(value);
  if (!match) return undefined;
  return { operator: (match[1] as QuantityOperator | undefined) ?? '=', value: Number(match[2]) };
}

export function parseSearch(text: string): ParsedSearch {
  const result: ParsedSearch = { terms: [] };
  for (const token of tokenize(text.trim())) {
    const separator = token.indexOf(':');
    const key = separator > 0 ? token.slice(0, separator).toLowerCase() : '';
    const value = separator > 0 ? stripQuotes(token.slice(separator + 1)) : '';

    if (key === 'color' && value) result.color = value;
    else if ((key === 'cat' || key === 'category') && value) result.category = value;
    else if ((key === 'loc' || key === 'location') && value) result.location = value;
    else if (key === 'tag' && value) result.tag = value;
    else if ((key === 'qty' || key === 'quantity') && parseQuantity(value)) {
      result.quantity = parseQuantity(value);
    } else if (key === 'custom' && /^(true|false)$/i.test(value)) {
      result.custom = value.toLowerCase() === 'true';
    } else {
      result.terms.push(stripQuotes(token));
    }
  }
  return result;
}

export function hasAnyFilter(parsed: ParsedSearch): boolean {
  return (
    parsed.terms.length > 0 ||
    parsed.color !== undefined ||
    parsed.category !== undefined ||
    parsed.location !== undefined ||
    parsed.tag !== undefined ||
    parsed.quantity !== undefined ||
    parsed.custom !== undefined
  );
}
