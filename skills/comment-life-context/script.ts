/**
 * comment-life-context — add inline historical exposition to life events.
 *
 * Single mark.assist with motivation 'commenting'. Where assess-historical-anchors
 * flags moments, this skill explains them — adding short paragraphs of historical
 * exposition surrounding individual life events, in the voice of an attentive historian.
 *
 * Usage: tsx skills/comment-life-context/script.ts [<resourceId>] [--interactive]
 */

import { SemiontClient, resourceId as ridBrand, type ResourceId } from '@semiont/sdk';
import { confirm, close as closeInteractive } from '../../src/interactive.js';

const DEFAULT_INSTRUCTIONS =
  'For each life event in the biographical text where the historical conditions are not ' +
  'self-evident, add a commenting annotation that briefly explains the surrounding context: ' +
  'what era, what institutions, what economic or social conditions were at play. Quote the ' +
  'source line, write the comment as if for a reader unfamiliar with the period.';

const INSTRUCTIONS = process.env.COMMENT_INSTRUCTIONS ?? DEFAULT_INSTRUCTIONS;

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
    `Will run mark.assist (motivation: commenting) against ${targets.length} resource(s).`,
  );

  const proceed = await confirm('Proceed?', true);
  if (!proceed) {
    console.log('Aborted.');
    semiont.dispose();
    closeInteractive();
    return;
  }

  let totalCreated = 0;
  for (const rId of targets) {
    const progress = await semiont.mark.assist(rId, 'commenting', {
      instructions: INSTRUCTIONS,
    });
    const n = progress.progress?.createdCount ?? 0;
    totalCreated += n;
    console.log(`  ${rId}: ${n} contextual comments added`);
  }

  console.log(`\nDone. Added ${totalCreated} life-context commenting annotations.`);
  semiont.dispose();
  closeInteractive();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
