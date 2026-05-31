/**
 * build-life-and-times — capstone biographical narrative synthesis.
 *
 * For a target Subject Person resource, synthesize a unified narrative that
 * interleaves the subject's documented life events with the historical
 * context happening simultaneously. Pulls from:
 *   - the Subject's biographical resource(s)
 *   - dated LifeEvent annotations (skill 3)
 *   - assessing annotations (skill 4)
 *   - commenting annotations (skill 5)
 *   - bound HistoricalContext / Place / Theme resources (skills 6, 7, 10)
 *
 * Yields a LifeAndTimes resource per Subject, with bindings back to source
 * biography paragraphs and forward to the historical-context resources cited.
 *
 * Usage: tsx skills/build-life-and-times/script.ts <subjectResourceId> [--interactive]
 */

import { SemiontSession, InMemorySessionStorage, type KnowledgeBase, resourceId as ridBrand, type ResourceDescriptor } from '@semiont/sdk';
import { confirm, close as closeInteractive } from '../../src/interactive.js';

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

interface DatedItem {
  year: number | null;
  text: string;
  motivation: 'linking' | 'assessing' | 'commenting';
  /** For commenting annotations, the comment body. */
  commentary?: string;
  /** Bound resource ids, if any (for linking annotations). */
  boundResources?: string[];
}

function extractYear(text: string): number | null {
  const m = text.match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);
  return m ? Number(m[1]) : null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const subjectResourceId = args[0];
  if (!subjectResourceId) {
    console.error(
      'Usage: tsx skills/build-life-and-times/script.ts <subjectResourceId> [--interactive]',
    );
    console.error(
      '\nFind candidate Subject IDs with: semiont.browse.resources({ entityType: "Subject" })',
    );
    process.exit(1);
  }

  const baseUrl = process.env.SEMIONT_API_URL ?? 'http://localhost:4000';
  const email = process.env.SEMIONT_USER_EMAIL!;
  const password = process.env.SEMIONT_USER_PASSWORD!;
  const u = new URL(baseUrl);
  const kb: KnowledgeBase = {
    id: 'synthetic-family-build-life-and-times',
    label: 'synthetic-family build-life-and-times',
    email,
    endpoint: { kind: 'http', host: u.hostname, port: Number(u.port) || 4000, protocol: u.protocol.replace(':', '') as 'http' | 'https' },
  };
  const session = await SemiontSession.signInHttp({ kb, storage: new InMemorySessionStorage(), baseUrl, email, password });
  const semiont = session.client;
  const subjectRId = ridBrand(subjectResourceId);

  try {
    let subject: ResourceDescriptor;
    try {
      subject = await semiont.browse.resource(subjectRId);
    } catch (e) {
      console.error(`Failed to load subject resource ${subjectResourceId}:`, (e as Error).message);
      closeInteractive();
      return;
    }

    const subjectName = subject.name ?? subjectResourceId;
    console.log(`Building Life and Times for: ${subjectName}`);

    const annotations = await semiont.browse.annotations(subjectRId);

    const items: DatedItem[] = [];
    for (const ann of annotations) {
      const target = ann.target;
      const selectors =
        typeof target === 'string' || !target.selector
          ? []
          : Array.isArray(target.selector)
            ? target.selector
            : [target.selector];
      let text = '';
      for (const s of selectors) {
        if (s.type === 'TextQuoteSelector') { text = s.exact; break; }
      }
      const year = extractYear(text);

      const bodies = Array.isArray(ann.body) ? ann.body : ann.body ? [ann.body] : [];

      if (ann.motivation === 'linking') {
        // Surface annotations bound to HistoricalContext, Place, or Theme resources
        const boundResources = bodies
          .filter((b: any) => b.type === 'SpecificResource')
          .map((b: any) => b.source);
        items.push({
          year,
          text,
          motivation: 'linking',
          boundResources,
        });
      } else if (ann.motivation === 'assessing') {
        items.push({ year, text, motivation: 'assessing' });
      } else if (ann.motivation === 'commenting') {
        const commentary = bodies
          .filter((b: any) => b.type === 'TextualBody' && (b.purpose === 'commenting' || !b.purpose))
          .map((b: any) => (typeof b.value === 'string' ? b.value : ''))
          .join(' ');
        items.push({ year, text, motivation: 'commenting', commentary });
      }
    }

    // Sort by year (undated to the end)
    items.sort((a, b) => {
      if (a.year === null && b.year === null) return 0;
      if (a.year === null) return 1;
      if (b.year === null) return -1;
      return a.year - b.year;
    });

    console.log(`Collected ${items.length} relevant annotations on this Subject.`);
    const proceed = await confirm(
      `Proceed to compose and yield a LifeAndTimes resource for ${subjectName}?`,
      true,
    );
    if (!proceed) {
      console.log('Aborted.');
      closeInteractive();
      return;
    }

    // Compose the narrative. Per-year sections; within each, dated linking
    // annotations come first (the life events themselves), then assessing
    // (anchor flags) and commenting (historical exposition) annotations
    // attached to the same period as bridging context.
    const lines: string[] = [
      `# Life and Times of ${subjectName}`,
      '',
      `Auto-generated narrative interleaving documented life events with surrounding historical context.`,
      '',
      `Source: ${subjectResourceId}`,
      '',
      '---',
      '',
    ];

    let lastYear: number | null = -1;
    for (const item of items) {
      if (item.year !== lastYear) {
        lines.push('');
        lines.push(item.year !== null ? `## ${item.year}` : '## Undated');
        lines.push('');
        lastYear = item.year;
      }
      if (item.motivation === 'linking') {
        const boundClause = item.boundResources && item.boundResources.length > 0
          ? ` *(bound to ${item.boundResources.length} resource(s))*`
          : '';
        lines.push(`- **${item.text}**${boundClause}`);
      } else if (item.motivation === 'assessing') {
        lines.push(`  - 🚩 *Anchor*: ${item.text}`);
      } else if (item.motivation === 'commenting' && item.commentary) {
        lines.push(`  - 📝 *Context*: ${item.commentary}`);
      }
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('*This narrative was synthesized by the `build-life-and-times` skill.*');
    lines.push(
      '*🚩 marks indicate spans flagged by `assess-historical-anchors` as biography-meets-history inflection moments.*',
    );
    lines.push(
      '*📝 marks indicate inline historical exposition added by `comment-life-context`.*',
    );

    const body = lines.join('\n') + '\n';

    const { resourceId } = await semiont.yield.resource({
      name: `Life and Times of ${subjectName}`,
      file: Buffer.from(body, 'utf-8'),
      format: 'text/markdown',
      entityTypes: ['LifeAndTimes', 'Aggregate'],
      storageUri: `file://generated/lifeandtimes-${slugify(subjectName)}.md`,
    });

    console.log(`\nLifeAndTimes resource created: ${resourceId} (${body.length} bytes)`);
    closeInteractive();
  } finally {
    await session.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
