/**
 * extract-period-themes — discover recurring period themes (economic, social,
 * civic, generational) across the biographical corpus and synthesize one
 * Theme resource per distinct theme.
 *
 * Two-pass: discovery + aggregation.
 *
 *   Pass 1 — mark.delegate with motivation 'commenting'. The instructions ask
 *   the model to comment on every thematically-significant span, with the
 *   theme alone as the comment: a short hyphenated phrase (e.g.
 *   'agricultural-transformation', 'frontier-resilience',
 *   'womens-civic-engagement'). Period theme labels are an open per-corpus
 *   vocabulary, not a registered structural-analysis schema.
 *
 *   Pass 2 — walk every commenting annotation whose comment is such a label,
 *   group by label, publish the labels via frame.addEntityTypes so
 *   browse.entityTypes() surfaces them, and synthesize one Theme resource per
 *   distinct label.
 *
 * Why commenting? It is a job that takes instructions and records the model's
 * own words on a span. A linking job detects mentions of entity types and
 * takes no instructions; a tagging job needs a registered schema of
 * categories, which an open vocabulary is not.
 *
 * Usage: tsx skills/extract-period-themes/script.ts [--interactive]
 */

import { SemiontSession, InMemorySessionStorage, httpKb, getAnnotationExactText, getCommentText, type ResourceId } from '@semiont/sdk';
import { confirm, close as closeInteractive } from '../../src/interactive.js';

const DEFAULT_INSTRUCTIONS =
  'Comment on every passage that exemplifies a recurring period theme — economic, social, civic, ' +
  'generational. Make each comment the theme alone, as one short hyphenated phrase in lower case ' +
  '(e.g. "agricultural-transformation", "frontier-resilience", "womens-civic-engagement"), with ' +
  'no other words. The same theme may apply to many passages; comment on each.';

const INSTRUCTIONS = process.env.THEME_INSTRUCTIONS ?? DEFAULT_INSTRUCTIONS;

// A theme label, as the instructions ask for it. Other comments in the
// knowledge base do not read as one.
const THEME_LABEL = /^[a-z0-9]+(?:-[a-z0-9]+){0,5}$/;

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

async function main(): Promise<void> {
  const gateway = new URL(process.env.SEMIONT_API_URL ?? 'http://localhost:4000');
  const opened = await SemiontSession.signInDevice({
    kb: httpKb({
      id: 'synthetic-family-extract-period-themes',
      label: 'synthetic-family extract-period-themes',
      host: gateway.hostname,
      port: Number(gateway.port) || 4000,
      protocol: gateway.protocol === 'https:' ? 'https' : 'http',
    }),
    storage: new InMemorySessionStorage(),
    onCode: ({ verificationUri, verificationUriComplete, userCode }) => {
      console.error(`Approve this script at ${verificationUriComplete ?? verificationUri}`);
      if (!verificationUriComplete) console.error(`Code: ${userCode}`);
    },
  });
  const semiont = opened.session.client;

  try {
    const all = (await semiont.browse.resources({ limit: 1000 }).fresh()).resources;
    const bioResources = all.filter((r) =>
      (r.entityTypes ?? []).some(
        (t) => t === 'Biography' || t === 'Subject' || t === 'Letter' || t === 'Diary' || t === 'Memoir',
      ),
    );

    if (bioResources.length === 0) {
      console.log('No biographical resources found.');
      closeInteractive();
      return;
    }

    console.log(
      `Will run mark.delegate (motivation: commenting) against ${bioResources.length} resource(s) ` +
        `for period-theme discovery.`,
    );
    const proceed = await confirm('Proceed?', true);
    if (!proceed) {
      console.log('Aborted.');
      closeInteractive();
      return;
    }

    // Pass 1: discovery — comment on thematic spans, each comment a theme label.
    for (const r of bioResources) {
      const rId = r['@id'];
      const done = await semiont.mark.delegate(rId, { motivation: 'commenting', instructions: INSTRUCTIONS });
      const n = done.result && 'persisted' in done.result ? done.result.persisted : 0;
      console.log(`  ${rId}: ${n} thematic spans`);
    }

    // Pass 2: aggregate by discovered theme label.
    console.log('\nAggregating by discovered theme label...');
    const themesByLabel = new Map<string, Array<{ rId: ResourceId; rName: string; text: string }>>();

    for (const r of bioResources) {
      const rId = r['@id'];
      const annotations = await semiont.browse.annotations(rId).fresh();
      for (const ann of annotations) {
        if (ann.motivation !== 'commenting') continue;
        const label = getCommentText(ann)?.trim().toLowerCase();
        if (!label || !THEME_LABEL.test(label)) continue;
        const text = getAnnotationExactText(ann);
        if (!themesByLabel.has(label)) themesByLabel.set(label, []);
        themesByLabel.get(label)!.push({ rId, rName: r.name, text });
      }
    }

    console.log(`Found ${themesByLabel.size} distinct theme label(s) across the corpus.`);

    // Publish the discovered theme vocabulary via frame so browse.entityTypes() sees it.
    if (themesByLabel.size > 0) {
      const discovered = Array.from(themesByLabel.keys());
      console.log(`Declaring ${discovered.length} discovered period-theme labels via frame...`);
      await semiont.frame.addEntityTypes(discovered);
    }

    let synthesized = 0;
    for (const [label, examples] of themesByLabel) {
      const lines = [
        `# ${label.replace(/-/g, ' ')}`,
        '',
        `Recurring period theme exemplified across ${examples.length} passage(s) in the corpus.`,
        '',
        '## Examples',
        '',
      ];
      for (const ex of examples.slice(0, 25)) {
        lines.push(`- *In ${ex.rName}*: "${ex.text}"`);
      }
      if (examples.length > 25) lines.push(`- … and ${examples.length - 25} more.`);
      const body = lines.join('\n') + '\n';

      const { resourceId } = await semiont.yield.resource({
        name: `Theme: ${label}`,
        file: Buffer.from(body, 'utf-8'),
        format: 'text/markdown',
        entityTypes: ['Theme', label],
        storageUri: `file://generated/theme-${slugify(label)}.md`,
      });
      synthesized++;
      console.log(`  + ${label} → ${resourceId} (${examples.length} examples)`);
    }

    console.log(
      `\nDone. Synthesized ${synthesized} Theme resources from ${themesByLabel.size} distinct theme labels.`,
    );
    closeInteractive();
  } finally {
    opened.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
