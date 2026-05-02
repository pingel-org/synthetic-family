---
name: mark-people
description: Detect Person mentions across biographical resources, including descriptive references like "his father" or "the schoolteacher". Tags spans for promotion to canonical Person resources by skill 8.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read, Write
---

You are helping the user detect Person mentions in a family / local-history corpus.

This is one of four tier-1 marking skills (the others are `mark-places-and-events`, `assess-historical-anchors`, `comment-life-context`). Each one is a thin wrapper around a single `mark.assist` call.

## What it does

For each Biography / Subject resource in the corpus (or one specific resource passed as a CLI arg), runs `mark.assist` with motivation `linking`, `includeDescriptiveReferences: true`, and a configured list of person-related entity types. Tags both formal-name spans ("Margaret Hale", "Justice Smith") and anaphoric mentions ("his father", "the schoolteacher", "the visiting cousin").

The annotations are unresolved — they record what kind of entity each span refers to, but don't yet link to a canonical Person resource. Skill 8 (`map-relationships`) does that promotion.

## SDK verbs

- `browse.resources` — find Biography/Subject targets (when no resourceId arg)
- `mark.assist({ motivation: 'linking', includeDescriptiveReferences: true, entityTypes: [...] })`

## Parameters

| Parameter | Type | Default | Purpose |
|---|---|---|---|
| `<resourceId>` | CLI arg (optional) | all Biography/Subject resources | Scope to a single resource |
| `ENTITY_TYPES` | env var | `Person,Subject,Relative,Acquaintance,HistoricalFigure` | Override or extend the type list |

## Tier-3 interactive checkpoint

Before the run: prints the resource count, target list, and entity-type list, then `confirm`s. Lets the user catch a bad `ENTITY_TYPES` override before paying for detection.

## Run it

**Prerequisite: `ingest-corpus` has been run.** See [AGENTS.md › Backend setup](../../AGENTS.md#backend-setup) for backend startup.

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  -e SEMIONT_USER_EMAIL=admin@example.com \
  -e SEMIONT_USER_PASSWORD=<your-password> \
  node:24-alpine \
  sh -c 'npm install --silent --no-fund @semiont/sdk tsx && npx tsx skills/mark-people/script.ts'
```

Override the entity types per run with `-e ENTITY_TYPES='Person,Relative'` for a faster kin-only pass. Add `-e SEMIONT_INTERACTIVE=1 -it` to enable the confirm prompt.

(See [`ingest-corpus`'s "Run it"](../ingest-corpus/SKILL.md#run-it) for the host-gateway / networking discussion — same patterns apply.)

## Output

For each Biography/Subject resource, prints the count of newly-created linking annotations. Final line summarizes total across all resources.

## Guidance for the AI assistant

- **Descriptive references are the point.** Genealogical text leans heavily on "his father", "her sister", "the firm's senior partner" rather than always-using-formal-names. With `includeDescriptiveReferences: true` these get caught.
- **Re-running adds annotations cumulatively.** No deduplication. Re-runs create additional annotations on the same spans. To restart, drop the resource and re-ingest.
- **The annotations stay unresolved here.** Skill 8 (`map-relationships`) clusters and promotes to Person resources, then binds these annotations.
