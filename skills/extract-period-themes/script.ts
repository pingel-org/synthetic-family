/**
 * extract-period-themes — discover recurring period themes (economic, social,
 * civic, generational) across the biographical corpus and synthesize one
 * Theme resource per distinct theme.
 *
 * Two-pass: discovery + aggregation.
 *
 *   Pass 1 — mark.assist with motivation 'linking' and a single generic
 *   entity type 'Theme'. The instructions ask the model to mark every
 *   thematically-significant span and include the specific hyphenated theme
 *   name as a tagging-purpose body value (e.g. 'agricultural-transformation',
 *   'frontier-resilience', 'womens-civic-engagement'). This is the
 *   *vocabulary classification* shape — period theme labels are an open per-
 *   corpus enum, not a registered structural-analysis schema. After the run,
 *   the discovered theme labels get published via frame.addEntityTypes so
 *   browse.entityTypes() surfaces them.
 *
 *   Pass 2 — walk every linking annotation, extract the discovered theme
 *   labels (the tagging body values that aren't the umbrella 'Theme' tag),
 *   group by label, synthesize one Theme resource per distinct label.
 *
 * Why not motivation 'tagging'? Tagging requires a registered schemaId in
 * packages/ontology/src/tag-schemas.ts — appropriate for IRAC / IMRAD /
 * Toulmin. Open-vocabulary period themes don't deserve a registered schema;
 * the linking shape is the right fit.
 *
 * Usage: tsx skills/extract-period-themes/script.ts [--interactive]
 */

import { SemiontClient, entityType, resourceId as ridBrand, type ResourceId } from '@semiont/sdk';
import { confirm, close as closeInteractive } from '../../src/interactive.js';

const DEFAULT_INSTRUCTIONS =
  'Mark every passage that exemplifies a recurring period theme — economic, social, civic, ' +
  'generational. For each marked span, attach the specific theme as a hyphenated phrase via a ' +
  'tagging-purpose body value (e.g. "agricultural-transformation", "frontier-resilience", ' +
  '"womens-civic-engagement"). The same theme may apply to many passages; mark each. The ' +
  'umbrella "Theme" entity-type tag is added automatically — do not duplicate it as a tagging value.';

const INSTRUCTIONS = process.env.THEME_INSTRUCTIONS ?? DEFAULT_INSTRUCTIONS;
const UMBRELLA_THEME_TAG = 'Theme';

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
    `Will run mark.assist (motivation: linking, entityTypes: ['${UMBRELLA_THEME_TAG}']) ` +
      `against ${bioResources.length} resource(s) for period-theme discovery.`,
  );
  const proceed = await confirm('Proceed?', true);
  if (!proceed) {
    console.log('Aborted.');
    semiont.dispose();
    closeInteractive();
    return;
  }

  // Pass 1: discovery — mark thematic spans as Theme-typed linking annotations,
  // with discovered theme labels as tagging-purpose body values.
  for (const r of bioResources) {
    const rId = ridBrand(r['@id']);
    const progress = await semiont.mark.assist(rId, 'linking', {
      entityTypes: [entityType(UMBRELLA_THEME_TAG)],
      instructions: INSTRUCTIONS,
    });
    const n = progress.progress?.createdCount ?? 0;
    console.log(`  ${rId}: ${n} thematic spans`);
  }

  // Pass 2: aggregate by discovered theme label.
  console.log('\nAggregating by discovered theme label...');
  const themesByLabel = new Map<string, Array<{ rId: ResourceId; rName: string; text: string }>>();

  for (const r of bioResources) {
    const rId = ridBrand(r['@id']);
    const annotations = await semiont.browse.annotations(rId);
    for (const ann of annotations) {
      if (ann.motivation !== 'linking') continue;
      const carriesUmbrella = (ann.body ?? []).some(
        (b: any) =>
          b.type === 'TextualBody' &&
          b.purpose === 'tagging' &&
          (Array.isArray(b.value) ? b.value : [b.value]).includes(UMBRELLA_THEME_TAG),
      );
      if (!carriesUmbrella) continue;

      const tagValues = (ann.body ?? [])
        .filter((b: any) => b.type === 'TextualBody' && b.purpose === 'tagging')
        .flatMap((b: any) => (Array.isArray(b.value) ? b.value : [b.value]))
        .filter((v: string) => v && v !== UMBRELLA_THEME_TAG);

      const text = ann.target?.selector?.exact ?? '';
      for (const label of tagValues) {
        if (!themesByLabel.has(label)) themesByLabel.set(label, []);
        themesByLabel.get(label)!.push({ rId, rName: r.name ?? r['@id'], text });
      }
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
  semiont.dispose();
  closeInteractive();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
