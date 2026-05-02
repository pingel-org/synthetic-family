/**
 * assess-historical-anchors — flag biography-meets-history inflection moments.
 *
 * Single mark.assist with motivation 'assessing'. The instructions parameter
 * scopes the focus to spans where personal life events directly intersect
 * documented historical events, periods, or institutions.
 *
 * Usage: tsx skills/assess-historical-anchors/script.ts [<resourceId>] [--interactive]
 */

import { SemiontClient, resourceId as ridBrand, type ResourceId } from '@semiont/sdk';
import { confirm, close as closeInteractive } from '../../src/interactive.js';

const DEFAULT_INSTRUCTIONS =
  'Identify and tag spans where a personal life event is shaped by, or directly references, ' +
  'a documented historical event, period, or institution — military service in a named conflict, ' +
  'participation in a named legislative scheme (homesteading, etc.), survival of a named disaster, ' +
  'employment in a named industry/era, civic activity in a named movement. ' +
  'Skip personal events (births, marriages) without historical anchoring.';

const INSTRUCTIONS = process.env.ASSESS_INSTRUCTIONS ?? DEFAULT_INSTRUCTIONS;

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
        (r.entityTypes ?? []).some(
          (t) => t === 'Biography' || t === 'Subject' || t === 'Letter' || t === 'Diary' || t === 'Memoir',
        ),
      )
      .map((r) => ridBrand(r['@id']));
  }

  if (targets.length === 0) {
    console.log('No biographical resources found. Run skills/ingest-corpus/script.ts first.');
    semiont.dispose();
    closeInteractive();
    return;
  }

  console.log(
    `Will run mark.assist (motivation: assessing) against ${targets.length} resource(s).`,
  );
  console.log(`Focus: ${INSTRUCTIONS}\n`);

  const proceed = await confirm('Proceed?', true);
  if (!proceed) {
    console.log('Aborted.');
    semiont.dispose();
    closeInteractive();
    return;
  }

  let totalCreated = 0;
  for (const rId of targets) {
    const progress = await semiont.mark.assist(rId, 'assessing', {
      instructions: INSTRUCTIONS,
    });
    const n = progress.progress?.createdCount ?? 0;
    totalCreated += n;
    console.log(`  ${rId}: ${n} historical anchors flagged`);
  }

  console.log(`\nDone. Flagged ${totalCreated} historical-anchor moments.`);
  semiont.dispose();
  closeInteractive();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
