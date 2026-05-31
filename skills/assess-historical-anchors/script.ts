/**
 * assess-historical-anchors — flag biography-meets-history inflection moments.
 *
 * Single mark.assist with motivation 'assessing'. The instructions parameter
 * scopes the focus to spans where personal life events directly intersect
 * documented historical events, periods, or institutions.
 *
 * Usage: tsx skills/assess-historical-anchors/script.ts [<resourceId>] [--interactive]
 */

import { SemiontSession, InMemorySessionStorage, type KnowledgeBase, resourceId as ridBrand, type ResourceId } from '@semiont/sdk';
import { confirm, close as closeInteractive } from '../../src/interactive.js';
import { createdCount } from '../../src/mark-result.js';

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

  const baseUrl = process.env.SEMIONT_API_URL ?? 'http://localhost:4000';
  const email = process.env.SEMIONT_USER_EMAIL!;
  const password = process.env.SEMIONT_USER_PASSWORD!;
  const u = new URL(baseUrl);
  const kb: KnowledgeBase = {
    id: 'synthetic-family-assess-historical-anchors',
    label: 'synthetic-family assess-historical-anchors',
    email,
    endpoint: { kind: 'http', host: u.hostname, port: Number(u.port) || 4000, protocol: u.protocol.replace(':', '') as 'http' | 'https' },
  };
  const session = await SemiontSession.signInHttp({ kb, storage: new InMemorySessionStorage(), baseUrl, email, password });
  const semiont = session.client;

  try {
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
      closeInteractive();
      return;
    }

    let totalCreated = 0;
    for (const rId of targets) {
      const progress = await semiont.mark.assist(rId, 'assessing', {
        instructions: INSTRUCTIONS,
      });
      const n = createdCount(progress);
      totalCreated += n;
      console.log(`  ${rId}: ${n} historical anchors flagged`);
    }

    console.log(`\nDone. Flagged ${totalCreated} historical-anchor moments.`);
    closeInteractive();
  } finally {
    await session.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
