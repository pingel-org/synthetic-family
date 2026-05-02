---
name: map-relationships
description: Promote Person mentions to canonical Person resources, encode kinship and other relationships between them, and attach Find a Grave search URLs (or pre-supplied memorial URLs) for users with real family-history data. Strictly source-grounded — never invents biographical subjects.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read, Write
---

You are helping the user build a queryable people-and-relationships layer atop a family / local-history corpus.

This skill is the most consequential of the tier-2 skills for genealogy work: it produces the Person resources and the kinship graph that the other skills (`build-historical-context`, `build-life-and-times`) depend on for grounding their narratives.

## Source-grounded constraint

The skill **only promotes Person spans that the source documents actually contain**. It does not synthesize fictional family members, attach unsupported claims to existing Persons, or invent relationships not stated or strongly implied in the text. If a name doesn't appear in the corpus, no Person resource is created for it.

## What it does

1. Collect all Person-related linking annotations across biographical resources.
2. Cluster by canonical text (lowercased).
3. For each cluster:
   - `gather.annotation` for context, `match.search` against existing Person resources.
   - If a candidate scores above `MATCH_THRESHOLD`: bind to it.
   - Otherwise: synthesize a new Person resource. Body markdown includes an "External references" section with:
     - Wikipedia URL (if the search returns one — typically for HistoricalFigure-typed people).
     - **Find a Grave**: a pre-supplied memorial URL if the source bio frontmatter or body contains one (`memorial: https://www.findagrave.com/memorial/12345`); otherwise a deterministic *search URL* the user can follow manually.
   - Bind every annotation in the cluster to the resolved/synthesized resource.
4. Relationship-extraction pass: `mark.assist` with an instruction to tag relationship pairs (kinship, employment, military, neighbor, etc.). Each detected relationship becomes a tagged linking annotation.

## SDK verbs

- `browse.resources`, `browse.annotations`, `browse.resource`
- `gather.annotation`, `match.search`
- `yield.resource` (synthesized Person resources)
- `bind.body` (annotations → Person)
- `mark.assist` (relationship-extraction pass)

## Find a Grave integration — important caveat

Find a Grave (owned by Ancestry.com) does **not** have a public API and explicitly disallows scraping. So this skill never fetches Find a Grave records. Instead, two things happen:

1. **For users with known memorial URLs**: if a bio file has a `memorial: https://www.findagrave.com/memorial/...` field in its frontmatter (or a `Find a Grave: <url>` line in the body, or a markdown link to such a URL), the URL is extracted via `src/findagrave.ts:extractMemorialUrl` and embedded as a direct Find a Grave external reference in the synthesized Person resource.
2. **For users without known memorial URLs**: a Find a Grave *search URL* is constructed from the person's name (and dates / cemetery hints if available — currently just name) and embedded as a clickable search link. Following the link takes the user to Find a Grave's results page where they can manually identify the right memorial.

For the synthetic Turner family seeded in this repo, the search URLs return no useful results — the Turners are fictional. The integration is here for users with real family-history data who fork this repo.

For programmatic verification of cemetery / death records, use APIs that have terms permitting it — BillionGraves, FamilySearch. Out of scope for v1.

## Parameters

| Parameter | Type | Default | Purpose |
|---|---|---|---|
| `MATCH_THRESHOLD` | env var | 30 | Tune match-vs-synthesize threshold for Person resources |

## Tier-3 interactive checkpoints

Two checkpoints:

1. Before promoting Person clusters: `confirm` after showing the cluster count, with explicit reminder that the skill never invents people.
2. Before the relationship-extraction pass: `confirm` separately so users can skip it (it's an extra `mark.assist` call per resource).

## Run it

**Prerequisite: tier-1 skills 1 and 2 have been run.**

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  -e SEMIONT_USER_EMAIL=admin@example.com \
  -e SEMIONT_USER_PASSWORD=<your-password> \
  -e MATCH_THRESHOLD=30 \
  node:24-alpine \
  sh -c 'npm install --silent --no-fund @semiont/sdk tsx && npx tsx skills/map-relationships/script.ts'
```

(See [`ingest-corpus`'s "Run it"](../ingest-corpus/SKILL.md#run-it) for networking notes.)

## Output

Per-cluster decisions during the run, plus per-resource relationship annotation counts. Final summary: count of synthesized Persons, count of bound annotations, count of relationship annotations.

## Guidance for the AI assistant

- **Pre-supplied memorial URLs are honored.** A user with real family-history data can edit a bio file's frontmatter to add `memorial: <findagrave-url>` and this skill will surface that as a direct Find a Grave reference in the synthesized Person resource. This is the recommended workflow for real users — they do the manual cemetery lookup once, drop the URL into the bio, and the skill picks it up.
- **The fake Turner family won't get useful Find a Grave hits.** The search URLs render but Find a Grave's results page won't show real matches. That's expected — the integration is for real users.
- **Disambiguation is hard.** Same name appearing in two different bios might or might not be the same person. The cluster heuristic (lowercased text) is coarse; the model's `gather + match` does the real work, but is imperfect. Tier-3 interactive mode would help here (let the user confirm/split clusters); this skill currently doesn't surface that prompt — adding it is a follow-up.
- **Relationships are tagged, not synthesized into separate resources.** A relationship-extraction pass tags spans like "her son" or "his colleague" with a relationship label (parent, spouse, employee, etc.). Querying the relationship graph means walking these tagged annotations.
