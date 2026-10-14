/**
 * map-relationships — promote Person mentions to Person resources, and attach
 * Find a Grave search URLs for users with real family-history data.
 *
 * Kinship and other relationships between people are not found by a job:
 * SKILL.md says how they are recorded.
 *
 * Strictly source-grounded: only promotes Person spans that the source
 * documents actually contain. Does not invent biographical subjects.
 *
 * Usage: tsx skills/map-relationships/script.ts [--interactive]
 */

import {
  SemiontSession,
  InMemorySessionStorage,
  httpKb,
  getAnnotationExactText,
  getEntityTypes,
  type AnnotationId,
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
  annId: AnnotationId;
  text: string;
  entityTypes: string[];
  /** Source resource markdown body (read for memorial-URL extraction). */
  sourceBody?: string;
}

async function main(): Promise<void> {
  const gateway = new URL(process.env.SEMIONT_API_URL ?? 'http://localhost:4000');
  const session = await SemiontSession.signInDevice({
    kb: httpKb({
      id: 'synthetic-family-map-relationships',
      label: 'synthetic-family map-relationships',
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
    // Find biographical resources to walk
    const all = (await semiont.browse.resources({ limit: 1000 }).fresh()).resources;
    const bioResources = all.filter((r) =>
      (r.entityTypes ?? []).some(
        (t) => t === 'Biography' || t === 'Subject' || t === 'Letter' || t === 'Diary' || t === 'Memoir',
      ),
    );

    // Collect Person annotations
    const personAnnotations: AnnoRef[] = [];
    for (const r of bioResources) {
      const rId = r['@id'];
      const annotations = await semiont.browse.annotations(rId).fresh();
      for (const ann of annotations) {
        if (ann.motivation !== 'linking') continue;
        const ets = getEntityTypes(ann);
        const matchedPeople = ets.filter((t) => PERSON_TYPES.has(t));
        if (matchedPeople.length === 0) continue;
        const text = getAnnotationExactText(ann);
        personAnnotations.push({
          rId,
          annId: ann.id,
          text,
          entityTypes: matchedPeople,
        });
      }
    }

    if (personAnnotations.length === 0) {
      console.log('No person annotations found. Run skills/mark-people/script.ts first.');
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
      closeInteractive();
      return;
    }

    let bound = 0;
    let synthesized = 0;

    for (const [, anns] of clusters) {
      const sample = anns[0];
      if (!sample) continue;

      const { response: context } = await semiont.gather.annotation(sample.rId, sample.annId, { contextWindow: 1500 });

      // Match against existing Person resources (could include skill-1-ingested
      // Subject biographies — those are already Person-typed).
      const matchResult = await semiont.match.search(sample.rId, sample.annId, context, {
        limit: 5,
        useSemanticScoring: true,
      });
      const top = matchResult.response[0];

      let targetResourceId: ResourceId;
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
          const sourceBody = await semiont.browse.resourceContent(sample.rId);
          const memUrl = extractMemorialUrl(sourceBody);
          if (memUrl) memorialRef = findAGraveMemorialRef(sample.text, memUrl);
        } catch {
          // Source content may be unreadable; failing the lookup is fine.
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
        targetResourceId = newRId;
        synthesized++;
        console.log(`  + "${sample.text}" → ${newRId} (synthesized, refs: ${refs.length})`);
      }

      for (const a of anns) {
        await semiont.bind.body(a.rId, a.annId, [
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

    closeInteractive();
  } finally {
    await session.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
