/**
 * map-relationships — promote Person mentions to Person resources, encode
 * kinship/relationship edges, and attach Find a Grave search URLs for users
 * with real family-history data.
 *
 * Strictly source-grounded: only promotes Person spans that the source
 * documents actually contain. Does not invent biographical subjects.
 *
 * Usage: tsx skills/map-relationships/script.ts [--interactive]
 */

import {
  SemiontClient,
  annotationId,
  resourceId as ridBrand,
  type GatheredContext,
  type ResourceId,
} from '@semiont/sdk';
import { wikipediaSearch, formatExternalReferences, type ExternalRef } from '../../src/wikipedia.js';
import { findAGraveSearchRef, extractMemorialUrl, findAGraveMemorialRef } from '../../src/findagrave.js';
import { confirm, close as closeInteractive } from '../../src/interactive.js';

const MATCH_THRESHOLD = Number(process.env.MATCH_THRESHOLD ?? 30);

const PERSON_TYPES = new Set(['Person', 'Subject', 'Relative', 'Acquaintance', 'HistoricalFigure']);

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

interface AnnoRef {
  rId: ResourceId;
  annId: string;
  text: string;
  entityTypes: string[];
  /** Source resource markdown body (read for memorial-URL extraction). */
  sourceBody?: string;
}

async function main(): Promise<void> {
  const semiont = await SemiontClient.signInHttp({
    baseUrl: process.env.SEMIONT_API_URL ?? 'http://localhost:4000',
    email: process.env.SEMIONT_USER_EMAIL!,
    password: process.env.SEMIONT_USER_PASSWORD!,
  });

  // Find biographical resources to walk
  const all = await semiont.browse.resources({ limit: 1000 });
  const bioResources = all.filter((r) =>
    (r.entityTypes ?? []).some(
      (t) => t === 'Biography' || t === 'Subject' || t === 'Letter' || t === 'Diary' || t === 'Memoir',
    ),
  );

  // Collect Person annotations
  const personAnnotations: AnnoRef[] = [];
  for (const r of bioResources) {
    const rId = ridBrand(r['@id']);
    const annotations = await semiont.browse.annotations(rId);
    for (const ann of annotations) {
      if (ann.motivation !== 'linking') continue;
      const ets = (ann.body ?? [])
        .filter((b: any) => b.type === 'TextualBody' && b.purpose === 'tagging')
        .flatMap((b: any) => Array.isArray(b.value) ? b.value : [b.value]);
      const matchedPeople = ets.filter((t: string) => PERSON_TYPES.has(t));
      if (matchedPeople.length === 0) continue;
      personAnnotations.push({
        rId,
        annId: ann.id,
        text: ann.target?.selector?.exact ?? '',
        entityTypes: matchedPeople,
      });
    }
  }

  if (personAnnotations.length === 0) {
    console.log('No person annotations found. Run skills/mark-people/script.ts first.');
    semiont.dispose();
    closeInteractive();
    return;
  }

  // Cluster by canonical text. (Coarse; gather/match handles fine-grained
  // disambiguation across the cluster boundary.)
  const clusters = new Map<string, AnnoRef[]>();
  for (const a of personAnnotations) {
    const key = a.text.toLowerCase().trim();
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key)!.push(a);
  }

  console.log(
    `Found ${personAnnotations.length} person annotations, ` +
      `clustered into ${clusters.size} distinct people.`,
  );

  const proceed = await confirm(
    'Proceed to promote person mentions to canonical Person resources, attach Find a Grave search URLs, and bind annotations? ' +
      '(This skill never invents new people — only spans already present in the corpus get promoted.)',
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
  const personResourceIds = new Map<string, string>(); // cluster-key → person resourceId

  for (const [key, anns] of clusters) {
    const sample = anns[0];
    const sampleAnnId = annotationId(sample.annId);

    const gather = await semiont.gather.annotation(sampleAnnId, sample.rId, { contextWindow: 1500 });
    const context = gather.response as GatheredContext;

    // Match against existing Person resources (could include skill-1-ingested
    // Subject biographies — those are already Person-typed).
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
      // Synthesize a new Person resource. Build "External references":
      //   - Wikipedia URL (for HistoricalFigure-typed people; shown for everyone).
      //   - Find a Grave: prefer a known memorial URL extracted from the source
      //     bio body, else a search URL constructed from name + dates.
      const refs: ExternalRef[] = [];
      const wikiUrl = await wikipediaSearch(sample.text);
      if (wikiUrl) refs.push({ term: sample.text, url: wikiUrl });

      // Look at the source resource body for a memorial URL the user provided.
      let memorialRef: ExternalRef | null = null;
      try {
        const srcResource = await semiont.browse.resource(sample.rId);
        const body = (srcResource as any)?.content ?? '';
        if (typeof body === 'string') {
          const memUrl = extractMemorialUrl(body);
          if (memUrl) memorialRef = findAGraveMemorialRef(sample.text, memUrl);
        }
      } catch {
        // browse.resource shape varies; failing the lookup is fine.
      }
      if (memorialRef) {
        refs.push(memorialRef);
      } else {
        // Best-effort: construct a Find a Grave search URL.
        // Names with two parts → first/last split. More parts → use last token as last.
        const parts = sample.text.trim().split(/\s+/);
        const firstName = parts.slice(0, -1).join(' ') || undefined;
        const lastName = parts[parts.length - 1];
        refs.push(findAGraveSearchRef(sample.text, { firstName, lastName }));
      }

      const externalRefs = formatExternalReferences(refs);
      const body =
        `# ${sample.text}\n\n` +
        `Person referenced in this corpus. Generated stub — replace with curated content as desired.\n\n` +
        `**Type(s):** ${sample.entityTypes.join(', ')}\n\n` +
        `Mentioned in ${anns.length} passage(s) across the corpus.\n\n` +
        externalRefs;

      const { resourceId: newRId } = await semiont.yield.resource({
        name: sample.text,
        file: Buffer.from(body, 'utf-8'),
        format: 'text/markdown',
        entityTypes: ['Person', ...sample.entityTypes],
        storageUri: `file://generated/person-${slugify(sample.text)}.md`,
      });
      targetResourceId = newRId as unknown as string;
      synthesized++;
      console.log(`  + "${sample.text}" → ${newRId} (synthesized, refs: ${refs.length})`);
    }

    personResourceIds.set(key, targetResourceId);

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
    `\nPerson layer: ${synthesized} new Person resources synthesized; ${bound} annotations bound.`,
  );

  // Relationship-extraction pass: ask the model to tag pairs of named people
  // with their relationship. Each detected relationship becomes a binding
  // annotation tagged with the relationship label.
  console.log(
    `\nRunning relationship-extraction pass (mark.assist with relationship instruction)...`,
  );
  const relProceed = await confirm(
    'Proceed to detect kinship / acquaintance relationships between named people in the corpus?',
    true,
  );
  if (relProceed) {
    const relInstructions =
      'For pairs of named persons in the text, identify any explicit relationship: ' +
      'kinship (parent, child, sibling, spouse, in-law), employment (employer, employee, ' +
      'colleague), military service together, civic association, neighbor, attorney-client, ' +
      'patient-doctor, etc. Tag the span where the relationship is established and quote the ' +
      "supporting language. Use a single tag value naming the relationship type, e.g. " +
      "'spouse', 'parent', 'colleague'.";

    let relTotal = 0;
    for (const r of bioResources) {
      const rId = ridBrand(r['@id']);
      const progress = await semiont.mark.assist(rId, 'linking', { instructions: relInstructions });
      const n = progress.progress?.createdCount ?? 0;
      relTotal += n;
      console.log(`  ${rId}: ${n} relationship annotations`);
    }
    console.log(`  Total relationship annotations created: ${relTotal}`);
  }

  semiont.dispose();
  closeInteractive();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
