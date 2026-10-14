import type { Database } from 'better-sqlite3';
import Fuse from 'fuse.js';
import { currentDataVersion } from './dataVersion';

interface VocabularyCache {
  version: number;
  fuse: Fuse<string>;
}
const caches = new WeakMap<Database, VocabularyCache>();

/** Words that really appear in the library (letters only), used to fix typos. */
function vocabulary(db: Database): Fuse<string> {
  const cached = caches.get(db);
  if (cached && cached.version === currentDataVersion()) return cached.fuse;
  const words = (
    db
      .prepare(
        `SELECT term FROM parts_search_vocab
         WHERE length(term) >= 3 AND term NOT GLOB '*[0-9]*'`,
      )
      .all() as { term: string }[]
  ).map((row) => row.term);
  const fuse = new Fuse(words, { threshold: 0.4, includeScore: true, ignoreLocation: true });
  caches.set(db, { version: currentDataVersion(), fuse });
  return fuse;
}

function termExists(db: Database, term: string): boolean {
  const row = db
    .prepare('SELECT 1 AS found FROM parts_search WHERE parts_search MATCH ? LIMIT 1')
    .get(`"${term}"*`);
  return row !== undefined;
}

export interface Correction {
  terms: string[];
  changes: Array<{ from: string; to: string }>;
}

/**
 * If a typed word matches nothing, swap it for the closest word in the library
 * ("brik" becomes "brick"). Returns null when nothing could be fixed.
 */
export function correctTerms(db: Database, terms: string[]): Correction | null {
  const changes: Correction['changes'] = [];
  const fixed = terms.map((term) => {
    const clean = term.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    if (clean.length < 3 || /\d/.test(clean) || termExists(db, clean)) return term;
    const best = vocabulary(db).search(clean, { limit: 1 })[0];
    if (!best) return term;
    changes.push({ from: term, to: best.item });
    return best.item;
  });
  return changes.length > 0 ? { terms: fixed, changes } : null;
}
