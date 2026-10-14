/**
 * mark-places-and-events — detect places, historical events, and dates.
 *
 * Single mark.delegate with motivation 'linking' across a configured set of
 * non-person entity types (places, events, dates, eras).
 *
 * Usage: tsx skills/mark-places-and-events/script.ts [<resourceId>] [--interactive]
 */

import { SemiontSession, InMemorySessionStorage, httpKb, entityType, resourceId as ridBrand, type ResourceId } from '@semiont/sdk';
import { confirm, close as closeInteractive } from '../../src/interactive.js';

const ENTITY_TYPES = (
  process.env.ENTITY_TYPES ??
  [
    'Place',
    'Town',
    'County',
    'State',
    'Region',
    'MilitaryLocation',
    'Institution',
    'Cemetery',
    'HistoricalEvent',
    'War',
    'Battle',
    'Disaster',
    'LegislativeAct',
    'EconomicEvent',
    'Migration',
    'Era',
    'Decade',
    'Date',
    'Year',
    'DateRange',
    'LifeEvent',
  ].join(',')
)
  .split(',')
  .map((t) => entityType(t.trim()));

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const explicitResourceId = args[0];

  const gateway = new URL(process.env.SEMIONT_API_URL ?? 'http://localhost:4000');
  const session = await SemiontSession.signInDevice({
    kb: httpKb({
      id: 'synthetic-family-mark-places-and-events',
      label: 'synthetic-family mark-places-and-events',
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
      console.log(
        'No biographical resources found. Run skills/ingest-corpus/script.ts first.',
      );
      closeInteractive();
      return;
    }

    console.log(
      `Will run mark.delegate (motivation: linking, ${ENTITY_TYPES.length} place/event/date types) ` +
        `against ${targets.length} resource(s).`,
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
        motivation: 'linking',
        entityTypes: ENTITY_TYPES,
      });
      const n = done.result && 'persisted' in done.result ? done.result.persisted : 0;
      totalCreated += n;
      console.log(`  ${rId}: ${n} new annotations`);
    }

    console.log(`\nDone. Created ${totalCreated} place/event/date linking annotations.`);
    closeInteractive();
  } finally {
    await session.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
