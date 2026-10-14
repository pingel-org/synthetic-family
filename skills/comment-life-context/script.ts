/**
 * comment-life-context — add inline historical exposition to life events.
 *
 * Single mark.delegate with motivation 'commenting'. Where assess-historical-anchors
 * flags moments, this skill explains them — adding short paragraphs of historical
 * exposition surrounding individual life events, in the voice of an attentive historian.
 *
 * Usage: tsx skills/comment-life-context/script.ts [<resourceId>] [--interactive]
 */

import { SemiontSession, InMemorySessionStorage, httpKb, resourceId as ridBrand, type ResourceId } from '@semiont/sdk';
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

  const gateway = new URL(process.env.SEMIONT_API_URL ?? 'http://localhost:4000');
  const session = await SemiontSession.signInDevice({
    kb: httpKb({
      id: 'synthetic-family-comment-life-context',
      label: 'synthetic-family comment-life-context',
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
  const semiont = session.client;

  try {
    let targets: ResourceId[];
    if (explicitResourceId) {
      targets = [ridBrand(explicitResourceId)];
    } else {
      const all = (await semiont.browse.resources({ limit: 1000 }).fresh()).resources;
      targets = all
        .filter((r) =>
          (r.entityTypes ?? []).some(
            (t) => t === 'Biography' || t === 'Subject' || t === 'Letter' || t === 'Diary' || t === 'Memoir',
          ),
        )
        .map((r) => r['@id']);
    }

    if (targets.length === 0) {
      console.log('No biographical resources found. Run skills/ingest-corpus/script.ts first.');
      closeInteractive();
      return;
    }

    console.log(
      `Will run mark.delegate (motivation: commenting) against ${targets.length} resource(s).`,
    );

    const proceed = await confirm('Proceed?', true);
    if (!proceed) {
      console.log('Aborted.');
      closeInteractive();
      return;
    }

    let totalCreated = 0;
    for (const rId of targets) {
      const done = await semiont.mark.delegate(rId, {
        motivation: 'commenting',
        instructions: INSTRUCTIONS,
      });
      const n = done.result && 'persisted' in done.result ? done.result.persisted : 0;
      totalCreated += n;
      console.log(`  ${rId}: ${n} contextual comments added`);
    }

    console.log(`\nDone. Added ${totalCreated} life-context commenting annotations.`);
    closeInteractive();
  } finally {
    await session.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
