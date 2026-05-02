/**
 * build-timeline — synthesize a unified chronological Timeline resource.
 *
 * Walks every Date / Year / DateRange / LifeEvent annotation across the
 * corpus, sorts chronologically, composes a markdown timeline with a line
 * per dated event, and yields a Timeline resource.
 *
 * Usage: tsx skills/build-timeline/script.ts [--interactive]
 */

import { SemiontClient, resourceId as ridBrand, type ResourceId } from '@semiont/sdk';
import { confirm, close as closeInteractive } from '../../src/interactive.js';

const DATE_TYPES = new Set(['Date', 'Year', 'DateRange', 'LifeEvent']);

interface TimelineEntry {
  /** Numeric year sort key (best-effort). */
  year: number | null;
  /** Original span text. */
  text: string;
  /** Source resource. */
  rId: ResourceId;
  /** Source resource name for rendering. */
  rName: string;
}

/** Best-effort year extraction. Pulls the first 4-digit year-shaped number. */
function extractYear(text: string): number | null {
  const m = text.match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);
  if (!m) return null;
  return Number(m[1]);
}

async function main(): Promise<void> {
  const semiont = await SemiontClient.signInHttp({
    baseUrl: process.env.SEMIONT_API_URL ?? 'http://localhost:4000',
    email: process.env.SEMIONT_USER_EMAIL!,
    password: process.env.SEMIONT_USER_PASSWORD!,
  });

  const all = await semiont.browse.resources({ limit: 1000 });
  const bioResources = all.filter((r) =>
    (r.entityTypes ?? []).some(
      (t) => t === 'Biography' || t === 'Subject' || t === 'Letter' || t === 'Diary' || t === 'Memoir',
    ),
  );

  if (bioResources.length === 0) {
    console.log('No biographical resources found.');
    semiont.dispose();
    closeInteractive();
    return;
  }

  const entries: TimelineEntry[] = [];
  for (const r of bioResources) {
    const rId = ridBrand(r['@id']);
    const annotations = await semiont.browse.annotations(rId);
    for (const ann of annotations) {
      if (ann.motivation !== 'linking') continue;
      const ets = (ann.body ?? [])
        .filter((b: any) => b.type === 'TextualBody' && b.purpose === 'tagging')
        .flatMap((b: any) => Array.isArray(b.value) ? b.value : [b.value]);
      const matchedDates = ets.filter((t: string) => DATE_TYPES.has(t));
      if (matchedDates.length === 0) continue;
      const text = ann.target?.selector?.exact ?? '';
      entries.push({
        year: extractYear(text),
        text,
        rId,
        rName: r.name ?? r['@id'],
      });
    }
  }

  if (entries.length === 0) {
    console.log(
      'No date annotations found. Run skills/mark-places-and-events/script.ts first.',
    );
    semiont.dispose();
    closeInteractive();
    return;
  }

  // Sort: known years ascending, unknown to the end
  entries.sort((a, b) => {
    if (a.year === null && b.year === null) return 0;
    if (a.year === null) return 1;
    if (b.year === null) return -1;
    return a.year - b.year;
  });

  console.log(`Collected ${entries.length} dated events across ${bioResources.length} biographies.`);
  const proceed = await confirm(
    `Proceed to synthesize a unified Timeline resource?`,
    true,
  );
  if (!proceed) {
    console.log('Aborted.');
    semiont.dispose();
    closeInteractive();
    return;
  }

  // Compose markdown timeline
  const lines: string[] = [
    '# Timeline',
    '',
    'Auto-generated chronological synthesis of dated events across the biographical corpus.',
    '',
    `Source: ${bioResources.length} biographical resource(s); ${entries.length} dated events.`,
    '',
    '---',
    '',
  ];

  let lastYear: number | null = -1;
  for (const e of entries) {
    if (e.year !== null && e.year !== lastYear) {
      lines.push('');
      lines.push(`## ${e.year}`);
      lines.push('');
      lastYear = e.year;
    } else if (e.year === null && lastYear !== null) {
      lines.push('');
      lines.push('## Undated');
      lines.push('');
      lastYear = null;
    }
    lines.push(`- **${e.text}** (in *${e.rName}*)`);
  }

  const body = lines.join('\n') + '\n';

  const { resourceId } = await semiont.yield.resource({
    name: 'Timeline (Auto-Generated)',
    file: Buffer.from(body, 'utf-8'),
    format: 'text/markdown',
    entityTypes: ['Timeline', 'Aggregate'],
    storageUri: 'file://generated/timeline.md',
  });

  console.log(`\nTimeline resource created: ${resourceId} (${body.length} bytes)`);
  semiont.dispose();
  closeInteractive();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
