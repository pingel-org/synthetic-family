/**
 * extract-period-themes — tag and synthesize Theme resources.
 *
 * mark.assist with motivation 'tagging' across the corpus to identify
 * recurring period themes. Aggregates by tag and yields one Theme resource
 * per distinct theme, with passages bound to it.
 *
 * Usage: tsx skills/extract-period-themes/script.ts [--interactive]
 */

import { SemiontClient, resourceId as ridBrand, type ResourceId } from '@semiont/sdk';
import { confirm, close as closeInteractive } from '../../src/interactive.js';

const DEFAULT_INSTRUCTIONS =
  'Tag passages that exemplify recurring period themes — economic, social, civic, ' +
  'generational. Use a short phrase as the tag value (e.g. ' +
  '"agricultural-transformation", "frontier-resilience", "womens-civic-engagement"). ' +
  'The same theme may apply to many passages; tag each.';

const INSTRUCTIONS = process.env.THEME_INSTRUCTIONS ?? DEFAULT_INSTRUCTIONS;

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
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

  console.log(
    `Will run mark.assist (motivation: tagging) against ${bioResources.length} resource(s).`,
  );
  const proceed = await confirm('Proceed?', true);
  if (!proceed) {
    console.log('Aborted.');
    semiont.dispose();
    closeInteractive();
    return;
  }

  // Pass 1: tag passages with theme labels
  for (const r of bioResources) {
    const rId = ridBrand(r['@id']);
    const progress = await semiont.mark.assist(rId, 'tagging', { instructions: INSTRUCTIONS });
    const n = progress.progress?.createdCount ?? 0;
    console.log(`  ${rId}: ${n} theme tags`);
  }

  // Pass 2: aggregate by theme tag and yield Theme resources
  console.log('\nAggregating by theme tag...');
  const themesByTag = new Map<string, Array<{ rId: ResourceId; rName: string; text: string }>>();

  for (const r of bioResources) {
    const rId = ridBrand(r['@id']);
    const annotations = await semiont.browse.annotations(rId);
    for (const ann of annotations) {
      if (ann.motivation !== 'tagging') continue;
      const tagValues = (ann.body ?? [])
        .filter((b: any) => b.type === 'TextualBody' && b.purpose === 'tagging')
        .flatMap((b: any) => Array.isArray(b.value) ? b.value : [b.value]);
      const text = ann.target?.selector?.exact ?? '';
      for (const tag of tagValues) {
        if (!themesByTag.has(tag)) themesByTag.set(tag, []);
        themesByTag.get(tag)!.push({ rId, rName: r.name ?? r['@id'], text });
      }
    }
  }

  console.log(`Found ${themesByTag.size} distinct themes across the corpus.`);
  let synthesized = 0;
  for (const [tag, examples] of themesByTag) {
    const lines = [
      `# ${tag.replace(/-/g, ' ')}`,
      '',
      `Recurring theme exemplified across ${examples.length} passage(s) in the corpus.`,
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
      name: `Theme: ${tag}`,
      file: Buffer.from(body, 'utf-8'),
      format: 'text/markdown',
      entityTypes: ['Theme'],
      storageUri: `file://generated/theme-${slugify(tag)}.md`,
    });
    synthesized++;
    console.log(`  + ${tag} → ${resourceId} (${examples.length} examples)`);
  }

  console.log(
    `\nDone. Synthesized ${synthesized} Theme resources from ${themesByTag.size} distinct theme tags.`,
  );
  semiont.dispose();
  closeInteractive();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
