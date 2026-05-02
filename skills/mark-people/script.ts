/**
 * mark-people — detect Person mentions across the corpus.
 *
 * Runs mark.assist with motivation 'linking', includeDescriptiveReferences: true,
 * and a configurable list of person-related entity types. Operates over all
 * Biography-typed resources by default; pass <resourceId> to scope to one.
 *
 * Usage: tsx skills/mark-people/script.ts [<resourceId>] [--interactive]
 */

import { SemiontClient, entityType, resourceId as ridBrand, type ResourceId } from '@semiont/sdk';
import { confirm, close as closeInteractive } from '../../src/interactive.js';

const ENTITY_TYPES = (
  process.env.ENTITY_TYPES ??
  'Person,Subject,Relative,Acquaintance,HistoricalFigure'
)
  .split(',')
  .map((t) => entityType(t.trim()));

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const explicitResourceId = args[0];

  const semiont = await SemiontClient.signInHttp({
    baseUrl: process.env.SEMIONT_API_URL ?? 'http://localhost:4000',
    email: process.env.SEMIONT_USER_EMAIL!,
    password: process.env.SEMIONT_USER_PASSWORD!,
  });

  let targets: ResourceId[];
  if (explicitResourceId) {
    targets = [ridBrand(explicitResourceId)];
  } else {
    const all = await semiont.browse.resources({ limit: 1000 });
    targets = all
      .filter((r) =>
        (r.entityTypes ?? []).some((t) => t === 'Biography' || t === 'Subject'),
      )
      .map((r) => ridBrand(r['@id']));
  }

  if (targets.length === 0) {
    console.log(
      'No Biography / Subject resources found. Run skills/ingest-corpus/script.ts first.',
    );
    semiont.dispose();
    closeInteractive();
    return;
  }

  console.log(
    `Will run mark.assist (motivation: linking, descriptive references on, ` +
      `${ENTITY_TYPES.length} types) against ${targets.length} resource(s):`,
  );
  for (const t of targets) console.log(`  - ${t}`);
  console.log(`Entity types: [${ENTITY_TYPES.join(', ')}]`);

  const proceed = await confirm('Proceed?', true);
  if (!proceed) {
    console.log('Aborted.');
    semiont.dispose();
    closeInteractive();
    return;
  }

  let totalCreated = 0;
  for (const rId of targets) {
    const progress = await semiont.mark.assist(rId, 'linking', {
      entityTypes: ENTITY_TYPES,
      includeDescriptiveReferences: true,
    });
    const n = progress.progress?.createdCount ?? 0;
    totalCreated += n;
    console.log(`  ${rId}: ${n} new annotations`);
  }

  console.log(`\nDone. Created ${totalCreated} linking annotations across ${targets.length} resource(s).`);
  semiont.dispose();
  closeInteractive();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
