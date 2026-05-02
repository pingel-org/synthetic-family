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
