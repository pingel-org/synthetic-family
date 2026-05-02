---
name: build-historical-context
description: Synthesize HistoricalContext resources for events / eras / institutions referenced in the corpus. Matches against pre-curated articles where they exist, generates new stubs with Wikipedia citations otherwise.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read, Write
---

You are helping the user build a layer of HistoricalContext resources atop a family / local-history corpus — anchoring the personal narratives in real-world events, eras, and institutions, with Wikipedia citations.

## What it does

1. Walks all biographical resources and collects every linking annotation whose entity types include a historical-event type (`HistoricalEvent`, `War`, `Battle`, `Disaster`, `LegislativeAct`, `EconomicEvent`, `Migration`, `Era`, `Decade`).
2. Clusters annotations by canonical text (lowercased).
3. For each cluster:
   - `gather.annotation` for context.
   - `match.search` against existing HistoricalContext resources (e.g., articles pre-curated under `generated/`).
   - If the top candidate scores above `MATCH_THRESHOLD`: bind to it.
   - Otherwise: synthesize a new HistoricalContext resource, look up the Wikipedia article via `src/wikipedia.ts`, embed an "External references" section with the Wikipedia URL, then bind.

## SDK verbs

- `browse.resources`, `browse.annotations` — find historical-event annotations
- `gather.annotation` — context for matching
- `match.search` — find existing HistoricalContext to bind to
- `yield.resource` — synthesize new HistoricalContext
- `bind.body` — link annotations to the resolved/synthesized resource

## Parameters

| Parameter | Type | Default | Purpose |
|---|---|---|---|
| `MATCH_THRESHOLD` | env var | 30 | Tune match-vs-synthesize threshold |

## Tier-3 interactive checkpoint

Before processing: prints the cluster count and asks `confirm`. Cluster-by-cluster decisions print to log (binding vs. synthesizing) so the user can see what the model decided.

## Run it

**Prerequisite: tier-1 skills 1, 2, 3 have been run.**

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  -e SEMIONT_USER_EMAIL=admin@example.com \
  -e SEMIONT_USER_PASSWORD=<your-password> \
  -e MATCH_THRESHOLD=30 \
  node:24-alpine \
  sh -c 'npm install --silent --no-fund @semiont/sdk tsx && npx tsx skills/build-historical-context/script.ts'
```

(See [`ingest-corpus`'s "Run it"](../ingest-corpus/SKILL.md#run-it) for networking notes.)

## Output

Per-cluster decisions printed during the run. Final summary: count of bound annotations, count of clusters, count of synthesized resources.

## Wikipedia citation pattern

Synthesized HistoricalContext resources include an "External references" section in their body markdown:

```markdown
## External references

- [Homestead Acts](https://en.wikipedia.org/wiki/Homestead_Acts) — Wikipedia
```

The Wikipedia URL is looked up via the MediaWiki opensearch API and cached locally in `.cache/wikipedia/`. If no URL is found, the section is omitted (the resource still gets created — the user can hand-edit later).

## Guidance for the AI assistant

- **Pre-curated articles in `generated/` survive.** Skill 1 ingests them as HistoricalContext-typed resources; this skill matches against them via `match.search` rather than overwriting. Confidence: a curated article should always win over a fresh stub — set `MATCH_THRESHOLD` low if needed.
- **Cluster heuristic is coarse.** Lowercased text is a first-pass match. The model's `gather + match` work does the real disambiguation. If you see same-event-different-spellings showing as separate clusters, that's normal — they'll typically resolve to the same Resource via `match.search`.
- **Synthesized stubs are short.** A title, the entity types, the count of passages mentioning the event, and a Wikipedia link. Use them as scaffolding and curate them by hand later if they'll be load-bearing for downstream research.
