/**
 * build-place-articles — synthesize Place resources from place annotations.
 *
 * Mirror of build-historical-context, scoped to place-related entity types.
 * Matches against existing curated Place articles where they exist, otherwise
 * synthesizes new ones with Wikipedia citations.
 *
 * Usage: tsx skills/build-place-articles/script.ts [--interactive]
 */

import {
  SemiontClient,
  annotationId,
  resourceId as ridBrand,
  type GatheredContext,
  type ResourceId,
} from '@semiont/sdk';
import { wikipediaSearch, formatExternalReferences } from '../../src/wikipedia.js';
import { confirm, close as closeInteractive } from '../../src/interactive.js';

const MATCH_THRESHOLD = Number(process.env.MATCH_THRESHOLD ?? 30);

const PLACE_TYPES = new Set([
  'Place',
  'Town',
  'County',
  'State',
  'Region',
  'MilitaryLocation',
  'Institution',
  'Cemetery',
]);

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

  type AnnoRef = { rId: ResourceId; annId: string; text: string; entityTypes: string[] };
  const placeAnnotations: AnnoRef[] = [];
  for (const r of bioResources) {
    const rId = ridBrand(r['@id']);
    const annotations = await semiont.browse.annotations(rId);
    for (const ann of annotations) {
      if (ann.motivation !== 'linking') continue;
      const ets = (ann.body ?? [])
        .filter((b: any) => b.type === 'TextualBody' && b.purpose === 'tagging')
        .flatMap((b: any) => Array.isArray(b.value) ? b.value : [b.value]);
      const matchedPlaces = ets.filter((t: string) => PLACE_TYPES.has(t));
      if (matchedPlaces.length === 0) continue;
      placeAnnotations.push({
        rId,
        annId: ann.id,
        text: ann.target?.selector?.exact ?? '',
        entityTypes: matchedPlaces,
      });
    }
  }

  if (placeAnnotations.length === 0) {
    console.log('No place annotations found. Run skills/mark-places-and-events/script.ts first.');
    semiont.dispose();
    closeInteractive();
    return;
  }

  const clusters = new Map<string, AnnoRef[]>();
  for (const a of placeAnnotations) {
    const key = a.text.toLowerCase().trim();
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key)!.push(a);
  }

  console.log(
    `Found ${placeAnnotations.length} place annotations, ` +
      `clustered into ${clusters.size} distinct places.`,
  );

  const proceed = await confirm('Proceed to match each cluster, synthesize where needed, and bind?', true);
  if (!proceed) {
    console.log('Aborted.');
    semiont.dispose();
    closeInteractive();
    return;
  }

  let bound = 0;
  let synthesized = 0;

  for (const [_, anns] of clusters) {
    const sample = anns[0];
    const sampleAnnId = annotationId(sample.annId);

    const gather = await semiont.gather.annotation(sampleAnnId, sample.rId, { contextWindow: 1500 });
    const context = gather.response as GatheredContext;

    const matchResult = await semiont.match.search(sample.rId, sampleAnnId, context, {
      limit: 5,
      useSemanticScoring: true,
    });
    const top = matchResult.response[0];

    let targetResourceId: string;
    if (top && (top.score ?? 0) >= MATCH_THRESHOLD) {
      targetResourceId = top['@id'];
      console.log(`  ↪ "${sample.text}" → ${top.name} (existing, score ${top.score})`);
    } else {
      const wikiUrl = await wikipediaSearch(sample.text);
      const externalRefs = wikiUrl
        ? formatExternalReferences([{ term: sample.text, url: wikiUrl }])
        : '';
      const body =
        `# ${sample.text}\n\n` +
        `Place referenced in this corpus. Generated stub.\n\n` +
        `**Type(s):** ${sample.entityTypes.join(', ')}\n\n` +
        `Mentioned in ${anns.length} passage(s) across the corpus.\n\n` +
        externalRefs;

      const { resourceId: newRId } = await semiont.yield.resource({
        name: sample.text,
        file: Buffer.from(body, 'utf-8'),
        format: 'text/markdown',
        entityTypes: ['Place', ...sample.entityTypes],
        storageUri: `file://generated/place-${slugify(sample.text)}.md`,
      });
      targetResourceId = newRId as unknown as string;
      synthesized++;
      console.log(`  + "${sample.text}" → ${newRId} (synthesized${wikiUrl ? `, Wikipedia: ${wikiUrl}` : ''})`);
    }

    for (const a of anns) {
      await semiont.bind.body(a.rId, annotationId(a.annId), [
        {
          op: 'add',
          item: { type: 'SpecificResource', source: targetResourceId, purpose: 'linking' },
        },
      ]);
      bound++;
    }
  }

  console.log(
    `\nDone. Bound ${bound} annotations across ${clusters.size} place clusters; ${synthesized} new Place resources synthesized.`,
  );
  semiont.dispose();
  closeInteractive();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
