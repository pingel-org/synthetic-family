/**
 * Find a Grave search-URL builder.
 *
 * Find a Grave is a database of cemetery memorial records owned by Ancestry.com.
 * Important: Find a Grave does NOT have a public API and explicitly disallows
 * scraping. This module therefore does not fetch results — it only constructs
 * a deterministic search URL the user can follow manually, and supports a
 * convention where users with real family-history data can pre-add memorial URLs
 * to their bio frontmatter (`memorial: https://www.findagrave.com/memorial/...`)
 * which we read through.
 *
 * For programmatic verification of cemetery / death records, use APIs that DO
 * have terms permitting it: BillionGraves, FamilySearch, etc. (Future work.)
 */

import type { ExternalRef } from './wikipedia.js';

export interface FindAGraveHints {
  firstName?: string;
  lastName?: string;
  birthYear?: number;
  deathYear?: number;
  /** Free-text location (city, state, etc.) the search form accepts. */
  location?: string;
  /** Free-text cemetery name. */
  cemetery?: string;
}

/**
 * Build a Find a Grave search URL. The result is a clickable link, not a
 * direct memorial — Find a Grave's TOS forbids us from resolving that
 * programmatically. The URL takes the user to a results page they can review.
 */
export function findAGraveSearchUrl(hints: FindAGraveHints): string {
  const params = new URLSearchParams();
  if (hints.firstName) params.set('firstname', hints.firstName);
  if (hints.lastName) params.set('lastname', hints.lastName);
  if (hints.birthYear !== undefined) params.set('birthyear', String(hints.birthYear));
  if (hints.deathYear !== undefined) params.set('deathyear', String(hints.deathYear));
  if (hints.location) params.set('location', hints.location);
  if (hints.cemetery) params.set('cemeteryName', hints.cemetery);
  return `https://www.findagrave.com/memorial/search?${params.toString()}`;
}

/**
 * Build an ExternalRef pointing at a Find a Grave search for the given person.
 * The returned ref is suitable for inclusion in formatExternalReferences().
 */
export function findAGraveSearchRef(personName: string, hints: FindAGraveHints): ExternalRef {
  return {
    term: `${personName} (cemetery search)`,
    url: findAGraveSearchUrl(hints),
    source: 'Find a Grave search',
  };
}

/**
 * If a real memorial URL is already known (e.g. provided by the user in
 * frontmatter), wrap it as an ExternalRef pointing directly at the memorial.
 */
export function findAGraveMemorialRef(personName: string, memorialUrl: string): ExternalRef {
  return {
    term: `${personName} memorial`,
    url: memorialUrl,
    source: 'Find a Grave',
  };
}

/**
 * Pull a Find a Grave memorial URL out of bio markdown frontmatter or body
 * if the user has manually added one. Returns null if nothing is found.
 *
 * Recognizes:
 *   - YAML frontmatter:  `memorial: https://www.findagrave.com/memorial/...`
 *   - Body line:          `Find a Grave: https://www.findagrave.com/memorial/...`
 *   - Body line:          `[memorial](https://www.findagrave.com/memorial/...)`
 */
export function extractMemorialUrl(markdown: string): string | null {
  const patterns = [
    /^memorial:\s*(https?:\/\/(?:www\.)?findagrave\.com\/memorial\/\S+)/im,
    /Find a Grave:\s*(https?:\/\/(?:www\.)?findagrave\.com\/memorial\/\S+)/i,
    /\]\((https?:\/\/(?:www\.)?findagrave\.com\/memorial\/[^)]+)\)/,
  ];
  for (const pattern of patterns) {
    const m = markdown.match(pattern);
    if (m) return m[1];
  }
  return null;
}
