---
name: build-timeline
description: Synthesize a unified chronological Timeline resource interleaving dated events from every biography in the corpus.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read, Write
---

You are helping the user produce a single navigable Timeline resource — a chronological view across every dated event in every biography in the corpus.

## What it does

1. Walks all biographical resources, collects every linking annotation whose entity types include a date-related type (`Date`, `Year`, `DateRange`, `LifeEvent`).
2. Best-effort extracts a year from each span (regex for 4-digit year-shaped numbers between 1500-2199).
3. Sorts chronologically; events without an extractable year go to an "Undated" section at the end.
4. Composes a markdown document grouped by year, one bullet per event, citing the source biography.
5. `yield.resource` the Timeline as a single Timeline-typed resource.

## SDK verbs

- `browse.resources`, `browse.annotations` — collect dated events
- `yield.resource` — Timeline output

## Parameters

(No skill-specific parameters; uses the standard env vars.)

## Tier-3 interactive checkpoint

Before yielding: prints the event count and asks `confirm`.

## Run it

**Prerequisite: tier-1 skill 3 (`mark-places-and-events`) has been run.**

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  -e SEMIONT_USER_EMAIL=admin@example.com \
  -e SEMIONT_USER_PASSWORD=<your-password> \
  node:24-alpine \
  sh -c 'npm install --silent --no-fund @semiont/sdk tsx && npx tsx skills/build-timeline/script.ts'
```

## Output

Single Timeline resource with markdown content like:

```markdown
# Timeline

Auto-generated chronological synthesis of dated events…

## 1844

- **1844 — Born in [...]** (in *Subject Name*)

## 1862

- **1862–1865 — Served in [...]** (in *Subject Name*)
```

## Guidance for the AI assistant

- **Year extraction is heuristic.** Spans like "in the late 1860s" or "after the war" don't get a clean year — they end up in the Undated section. To improve, the user can hand-edit the Timeline resource or rerun after refining the date annotations.
- **Re-running creates a new Timeline.** No deduplication. To regenerate after corpus updates, delete the prior Timeline resource via the Semiont browser.
- **The Timeline depends on dated events being annotated.** If the corpus has dates that weren't captured by `mark-places-and-events`, they won't appear here. Re-run skill 3 with a tighter `ENTITY_TYPES=Date,LifeEvent,Year,DateRange` if you need to broaden coverage.
