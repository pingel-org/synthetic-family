/**
 * mark-places-and-events — detect places, historical events, and dates.
 *
 * Single mark.assist with motivation 'linking' across a configured set of
 * non-person entity types (places, events, dates, eras).
 *
 * Usage: tsx skills/mark-places-and-events/script.ts [<resourceId>] [--interactive]
 */

import { SemiontClient, entityType, resourceId as ridBrand, type ResourceId } from '@semiont/sdk';
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
    console.log(
      'No biographical resources found. Run skills/ingest-corpus/script.ts first.',
    );
    semiont.dispose();
    closeInteractive();
    return;
  }

  console.log(
    `Will run mark.assist (motivation: linking, ${ENTITY_TYPES.length} place/event/date types) ` +
      `against ${targets.length} resource(s).`,
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
    const progress = await semiont.mark.assist(rId, 'linking', {
      entityTypes: ENTITY_TYPES,
    });
    const n = progress.progress?.createdCount ?? 0;
    totalCreated += n;
    console.log(`  ${rId}: ${n} new annotations`);
  }

  console.log(`\nDone. Created ${totalCreated} place/event/date linking annotations.`);
  semiont.dispose();
  closeInteractive();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
