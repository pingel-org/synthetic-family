/**
 * Wikipedia URL helpers with local caching.
 *
 * Used by skills that synthesize HistoricalContext, Place, or Person resources
 * to ground them in canonical Wikipedia articles. The MediaWiki opensearch API
 * is open and unauthenticated.
 *
 * Cache lives at `.cache/wikipedia/<sha1-of-term>.json` so a corpus-wide run
 * doesn't re-hit the API for every repeated term.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CACHE_DIR = join(process.cwd(), '.cache', 'wikipedia');

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function cacheKey(term: string): string {
  return createHash('sha1').update(term.toLowerCase().trim()).digest('hex');
}

/**
 * Look up a term against the MediaWiki opensearch API.
 * Returns the canonical article URL, or null if no good match.
 */
export async function wikipediaSearch(term: string): Promise<string | null> {
  if (!term.trim()) return null;
  ensureCacheDir();

  const cacheFile = join(CACHE_DIR, `${cacheKey(term)}.json`);
  if (existsSync(cacheFile)) {
    const cached = JSON.parse(readFileSync(cacheFile, 'utf-8'));
    return cached.url ?? null;
  }

  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(term)}&limit=1&format=json`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'semiont-kb-skill/1.0 (https://github.com/The-AI-Alliance/semiont)' },
    });
    if (!response.ok) {
      writeFileSync(cacheFile, JSON.stringify({ url: null, ts: Date.now() }));
      return null;
    }
    // opensearch returns [term, [titles], [descriptions], [urls]]
    const data = (await response.json()) as [string, string[], string[], string[]];
    const articleUrl = data[3]?.[0] ?? null;
    writeFileSync(cacheFile, JSON.stringify({ url: articleUrl, ts: Date.now() }));
    return articleUrl;
  } catch {
    return null;
  }
}

export interface ExternalRef {
  term: string;
  url: string;
  /** Optional source label, e.g., 'Wikipedia', 'Find a Grave'. Defaults to 'Wikipedia'. */
  source?: string;
}

/**
 * Format a list of (term, url) pairs as a markdown 'External references' section
 * suitable for embedding in a resource body. Returns an empty string if `refs` is empty.
 */
export function formatExternalReferences(refs: ExternalRef[]): string {
  if (refs.length === 0) return '';
  const lines = ['## External references', ''];
  for (const ref of refs) {
    const source = ref.source ?? 'Wikipedia';
    lines.push(`- [${ref.term}](${ref.url}) — ${source}`);
  }
  lines.push('');
  return lines.join('\n');
}
