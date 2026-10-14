---
name: mark-places-and-events
description: Detect Place, HistoricalEvent, and Date mentions in biographical resources. Tags spans for resolution by build-historical-context (events) and build-place-articles (places).
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read, Write
---

You are helping the user detect non-person historical entities in a family / local-history corpus.

This is one of four tier-1 marking skills. It mirrors `mark-people` but for places, events, and dates.

## What it does

For each biographical resource (Biography, Subject, Letter, Diary, Memoir), runs `mark.delegate` with motivation `linking` and a wide list of place / event / date entity types. Tags spans like county / town / state names, military locations, civic institutions, named wars and battles, named legislation, named disasters, dates and date ranges.

## SDK verbs

- `browse.resources` — find biographical targets
- `mark.delegate({ motivation: 'linking', entityTypes: [...] })`

## Parameters

| Parameter | Type | Default | Purpose |
|---|---|---|---|
| `<resourceId>` | CLI arg (optional) | all biographical resources | Scope to one |
| `ENTITY_TYPES` | env var | the 20-element default list (places + events + dates) | Override or pare down |

The default `ENTITY_TYPES` covers a broad sweep of biographical-historical territory. For a narrower run, e.g., places-only, override:
```
ENTITY_TYPES='Place,Town,County,State,Region,Cemetery'
```

## Tier-3 interactive checkpoint

Before the run: prints the resource count and target list, then `confirm`s.

## Run it

**Prerequisite: `ingest-corpus` has been run.** See [AGENTS.md › Stack setup](../../AGENTS.md#stack-setup).

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  node:24-alpine \
  sh -c 'npm ci --no-audit --no-fund && npx tsx skills/mark-places-and-events/script.ts'
```

The script prints an address: open it in a browser and approve the sign-in. [Signing in](https://github.com/The-AI-Alliance/semiont/blob/main/docs/builder/SIGN-IN.md) has the other ways a script can sign in.

(See [`ingest-corpus`'s "Run it"](../ingest-corpus/SKILL.md#run-it) for networking notes.)

## Output

Per-resource annotation counts; final total.

## Guidance for the AI assistant

- **The default entity-type list is broad.** That's intentional — biographical text doesn't tell you in advance whether a date will be tied to a war, a homestead claim, or a wedding. Casting wide here gives skills 6 and 9 enough material to anchor.
- **Same caveats as mark-people**: re-running adds annotations cumulatively; the unresolved annotations stay unresolved until the tier-2 skills resolve them.
