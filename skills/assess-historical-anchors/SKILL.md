---
name: assess-historical-anchors
description: Flag moments in biographical text where a personal life event is directly shaped by a documented historical event, period, or institution. Used by build-historical-context to prioritize anchor topics.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read, Write
---

You are helping the user identify the inflection points in a biographical narrative — the moments where individual lives are shaped by larger historical forces.

This is one of four tier-1 marking skills. It uses `mark.assist` with motivation `assessing` (Semiont's "red-underline" annotation type).

## What it does

For each biographical resource, runs `mark.assist({ motivation: 'assessing', instructions: ... })` with focus on spans where a personal life event is shaped by, or directly references, a documented historical event, period, or institution. Skips spans about purely personal events (births, marriages) without historical anchoring.

The result: assessing annotations highlight the moments that `build-historical-context` (skill 6) prioritizes when synthesizing HistoricalContext resources, and that `build-life-and-times` (skill 11) uses as landmarks in its narrative.

## SDK verbs

- `browse.resources` — find biographical targets
- `mark.assist({ motivation: 'assessing', instructions: ... })`

## Parameters

| Parameter | Type | Default | Purpose |
|---|---|---|---|
| `<resourceId>` | CLI arg (optional) | all biographical resources | Scope to one |
| `ASSESS_INSTRUCTIONS` | env var | the standard anchor-focus directive (see script) | Replace the directive entirely |

The default `ASSESS_INSTRUCTIONS` is opinionated — it explicitly tells the model to skip personal events without historical context. If your corpus is more memoir-style or you want every life event flagged, override:

```
ASSESS_INSTRUCTIONS="Identify and tag every concrete life event with a date or place. Quote the source line."
```

## Tier-3 interactive checkpoint

Before the run: prints the focus directive and target count, then `confirm`s.

## Run it

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  -e SEMIONT_USER_EMAIL=admin@example.com \
  -e SEMIONT_USER_PASSWORD=<your-password> \
  node:24-alpine \
  sh -c 'npm install --silent --no-fund @semiont/sdk tsx && npx tsx skills/assess-historical-anchors/script.ts'
```

(See [`ingest-corpus`'s "Run it"](../ingest-corpus/SKILL.md#run-it) for networking notes.)

## Output

Per-resource flag counts; final total. The flagged spans are visible as red-underline annotations in the Semiont browser and queryable via `browse.annotations({ motivation: 'assessing' })`.

## Guidance for the AI assistant

- **The default focus is selective.** The skill flags inflection points, not every life event. If you want a "tag every life event with a date" pass, override `ASSESS_INSTRUCTIONS`.
- **Anchor flags feed downstream skills.** `build-historical-context` prioritizes events that surfaced via this skill; `build-life-and-times` uses them as the narrative spine. Skipping this skill leaves those downstream skills working from less-prioritized signal.
