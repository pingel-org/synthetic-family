/**
 * ingest-corpus — walk the repo, create one resource per file.
 *
 * Discovers files in conventional subdirectories (`bios/`, `letters/`,
 * `diaries/`, `memoirs/`, `generated/`, `photos/`, `data/`), classifies
 * each one, and uploads via yield.resource.
 *
 * Usage: tsx skills/ingest-corpus/script.ts [--interactive]
 */

import { SemiontClient } from '@semiont/sdk';
import { discoverCorpus, readForUpload, type CorpusFile } from '../../src/files.js';
import { confirm, close as closeInteractive, isInteractive } from '../../src/interactive.js';

/**
 * The full entity-type vocabulary this KB uses across all eleven skills.
 * Declared via `frame.addEntityTypes` once on each ingest run — idempotent,
 * so re-runs are harmless. This is what makes `browse.entityTypes()` return
 * a coherent published vocabulary instead of an implicit accumulation of
 * whatever any individual mark.assist call happened to stamp.
 */
const KB_ENTITY_TYPES = [
  // Source-document types from src/files.ts
  'Biography',
  'Subject',
  'Letter',
  'Correspondence',
  'Diary',
  'Journal',
  'Memoir',
  'Photograph',
  'FamilyImage',
  'SourceData',
  // Curated-context article markers
  'HistoricalContext',
  'Curated',
  // mark-people entity types
  'Person',
  'Relative',
  'Acquaintance',
  'HistoricalFigure',
  // mark-places-and-events entity types — places
  'Place',
  'Town',
  'County',
  'State',
  'Country',
  'Region',
  'MilitaryLocation',
  'Institution',
  'Cemetery',
  // mark-places-and-events entity types — events
  'HistoricalEvent',
  'War',
  'Battle',
  'Disaster',
  'LegislativeAct',
  'EconomicEvent',
  'Migration',
  'Era',
  'Decade',
  // mark-places-and-events entity types — time
  'Date',
  'Year',
  'DateRange',
  'LifeEvent',
  // Theme + synthesized aggregates
  'Theme',
  'Timeline',
  'LifeAndTimes',
  'Aggregate',
];

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const files = discoverCorpus(repoRoot);

  console.log(`Discovered ${files.length} corpus files:`);
  const byKind: Record<string, number> = {};
  for (const f of files) {
    byKind[f.source] = (byKind[f.source] ?? 0) + 1;
  }
  for (const [kind, n] of Object.entries(byKind).sort()) {
    console.log(`  ${kind}: ${n}`);
  }
  console.log();

  if (files.length === 0) {
    console.log('No ingestable files found. Exiting.');
    closeInteractive();
    return;
  }

  // Tier-3 checkpoint: confirm scope before bulk upload.
  const proceed = await confirm(
    `About to create ${files.length} resources via yield.resource. Proceed?`,
    true,
  );
  if (!proceed) {
    console.log('Aborted before upload.');
    closeInteractive();
    return;
  }

  const semiont = await SemiontClient.signInHttp({
    baseUrl: process.env.SEMIONT_API_URL ?? 'http://localhost:4000',
    email: process.env.SEMIONT_USER_EMAIL!,
    password: process.env.SEMIONT_USER_PASSWORD!,
  });

  // Declare this KB's entity-type vocabulary via frame. Idempotent.
  console.log(`Declaring ${KB_ENTITY_TYPES.length} entity types via frame...`);
  await semiont.frame.addEntityTypes(KB_ENTITY_TYPES);

  let created = 0;
  let failed = 0;
  for (const file of files) {
    try {
      const buffer = readForUpload(file, repoRoot);
      const { resourceId } = await semiont.yield.resource({
        name: file.name,
        file: buffer,
        format: file.format,
        entityTypes: file.entityTypes,
        storageUri: file.storageUri,
      });
      created++;
      console.log(`  + ${file.path} → ${resourceId} [${file.entityTypes.join(', ')}]`);
    } catch (e) {
      failed++;
      console.warn(`  ! ${file.path} failed: ${(e as Error).message}`);
    }
  }

  console.log(`\nDone. ${created} resources created, ${failed} failed.`);
  semiont.dispose();
  closeInteractive();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
