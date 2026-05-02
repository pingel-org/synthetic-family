---
name: build-place-articles
description: Synthesize Place resources for places mentioned in the corpus (towns, counties, military locations, institutions, cemeteries). Matches against pre-curated articles, generates new stubs with Wikipedia citations otherwise.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read, Write
---

You are helping the user build a layer of Place resources atop a family / local-history corpus — every distinct place mentioned in the biographies becomes a clickable canonical article anchored to Wikipedia.

This skill is the place-mirror of `build-historical-context` — same structure, scoped to place-related entity types.

## What it does

1. Walks all biographical resources and collects every linking annotation whose entity types include a place type (`Place`, `Town`, `County`, `State`, `Region`, `MilitaryLocation`, `Institution`, `Cemetery`).
2. Clusters by canonical text.
3. For each cluster: `gather → match → bind to existing or yield new Place resource with Wikipedia citation`.

## SDK verbs

- `browse.resources`, `browse.annotations`, `gather.annotation`, `match.search`, `yield.resource`, `bind.body`

## Parameters

| Parameter | Type | Default | Purpose |
|---|---|---|---|
| `MATCH_THRESHOLD` | env var | 30 | Tune match-vs-synthesize threshold |

## Tier-3 interactive checkpoint

Before processing: prints cluster count and asks `confirm`. Per-cluster decisions print to log.

## Run it

**Prerequisite: tier-1 skills 1, 3 have been run.**

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  -e SEMIONT_USER_EMAIL=admin@example.com \
  -e SEMIONT_USER_PASSWORD=<your-password> \
  -e MATCH_THRESHOLD=30 \
  node:24-alpine \
  sh -c 'npm install --silent --no-fund @semiont/sdk tsx && npx tsx skills/build-place-articles/script.ts'
```

(See [`ingest-corpus`'s "Run it"](../ingest-corpus/SKILL.md#run-it) for networking notes.)

## Guidance for the AI assistant

- **Cemeteries are interesting.** `Cemetery`-typed annotations get Place resources here, and `map-relationships` (skill 8) will use cemetery names as hints when constructing Find a Grave search URLs for any Person resources buried there.
- **Counties and towns disambiguate by state.** The cluster-merge pass uses lowercased text, but `match.search` includes context — same town name in two different states should resolve to two different Places via the gather context. If you see incorrect merges, raise `MATCH_THRESHOLD`.
