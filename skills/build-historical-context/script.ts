/**
 * build-historical-context — synthesize HistoricalContext resources
 *
 * For each distinct historical event / era / institution annotation, ensure
 * there's a canonical HistoricalContext resource. Existing curated articles
 * (HistoricalContext-typed resources from skill 1) are matched, not overwritten.
 *
 * New resources cite Wikipedia via the "External references" pattern.
 *
 * Usage: tsx skills/build-historical-context/script.ts [--interactive]
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

const HISTORICAL_TYPES = new Set([
  'HistoricalEvent',
  'War',
  'Battle',
  'Disaster',
  'LegislativeAct',
  'EconomicEvent',
  'Migration',
  'Era',
  'Decade',
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

  // Find biographical resources to walk for historical-event annotations
  const all = await semiont.browse.resources({ limit: 1000 });
  const bioResources = all.filter((r) =>
    (r.entityTypes ?? []).some(
      (t) => t === 'Biography' || t === 'Subject' || t === 'Letter' || t === 'Diary' || t === 'Memoir',
    ),
  );

  if (bioResources.length === 0) {
    console.log('No biographical resources found.');
    semiont.dispose();
    closeInteractive();
    return;
  }

  // Collect all historical-event annotations across the corpus
  type AnnoRef = {
    rId: ResourceId;
    annId: string;
    text: string;
    entityTypes: string[];
  };
  const historicalAnnotations: AnnoRef[] = [];
  for (const r of bioResources) {
    const rId = ridBrand(r['@id']);
    const annotations = await semiont.browse.annotations(rId);
    for (const ann of annotations) {
      if (ann.motivation !== 'linking') continue;
      const ets = (ann.body ?? [])
        .filter((b: any) => b.type === 'TextualBody' && b.purpose === 'tagging')
        .flatMap((b: any) => Array.isArray(b.value) ? b.value : [b.value]);
      const matchedHistorical = ets.filter((t: string) => HISTORICAL_TYPES.has(t));
      if (matchedHistorical.length === 0) continue;
      historicalAnnotations.push({
        rId,
        annId: ann.id,
        text: ann.target?.selector?.exact ?? '',
        entityTypes: matchedHistorical,
      });
    }
  }

  if (historicalAnnotations.length === 0) {
    console.log(
      'No historical-event annotations found. Run skills/mark-places-and-events/script.ts first.',
    );
    semiont.dispose();
    closeInteractive();
    return;
  }

  // Cluster by canonical-name (lowercased text). Real disambiguation is the
  // model's job via gather/match — this is a coarse first pass.
  const clusters = new Map<string, AnnoRef[]>();
  for (const a of historicalAnnotations) {
    const key = a.text.toLowerCase().trim();
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key)!.push(a);
  }

  console.log(
    `Found ${historicalAnnotations.length} historical-event annotations, ` +
      `clustered into ${clusters.size} distinct events.`,
  );

  const proceed = await confirm(
    `Proceed to match each cluster against existing HistoricalContext resources, synthesize new ones with Wikipedia citations where needed, and bind annotations?`,
    true,
  );
  if (!proceed) {
    console.log('Aborted.');
    semiont.dispose();
    closeInteractive();
    return;
  }

  let bound = 0;
  let synthesized = 0;

  for (const [key, anns] of clusters) {
    const sample = anns[0];
    const sampleAnnId = annotationId(sample.annId);

    // Try to match against existing HistoricalContext resources
    const gather = await semiont.gather.annotation(sampleAnnId, sample.rId, {
      contextWindow: 1500,
    });
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
      // Synthesize a new HistoricalContext resource
      const wikiUrl = await wikipediaSearch(sample.text);
      const externalRefs = wikiUrl
        ? formatExternalReferences([{ term: sample.text, url: wikiUrl }])
        : '';
      const body =
        `# ${sample.text}\n\n` +
        `Historical context referenced in this corpus. Generated stub — replace with curated content as desired.\n\n` +
        `**Type(s):** ${sample.entityTypes.join(', ')}\n\n` +
        `Mentioned in ${anns.length} passage(s) across the corpus.\n\n` +
        externalRefs;

      const { resourceId: newRId } = await semiont.yield.resource({
        name: sample.text,
        file: Buffer.from(body, 'utf-8'),
        format: 'text/markdown',
        entityTypes: ['HistoricalContext', ...sample.entityTypes],
        storageUri: `file://generated/historical-${slugify(sample.text)}.md`,
      });
      targetResourceId = newRId as unknown as string;
      synthesized++;
      console.log(`  + "${sample.text}" → ${newRId} (synthesized${wikiUrl ? `, Wikipedia: ${wikiUrl}` : ''})`);
    }

    // Bind every annotation in this cluster to the resolved/synthesized resource
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
    `\nDone. Bound ${bound} annotations across ${clusters.size} clusters; ${synthesized} new HistoricalContext resources synthesized.`,
  );
  semiont.dispose();
  closeInteractive();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
