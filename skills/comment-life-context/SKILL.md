---
name: comment-life-context
description: Add inline historical exposition to biographical life events. Where assess-historical-anchors flags inflection moments, this skill explains them — adding short historian's commentary in the margins.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read, Write
---

You are helping the user illuminate biographical narratives with surrounding historical context — short paragraphs in the voice of an attentive historian explaining what was going on when each life event happened.

This is one of four tier-1 marking skills. It uses `mark.delegate` with motivation `commenting`.

## What it does

For each biographical resource, runs `mark.delegate({ motivation: 'commenting', instructions: ... })` to surface life events whose historical conditions aren't self-evident, and add a short commentary explaining the surrounding context: what era, what institutions, what economic or social conditions were at play. The result is a lightly-illuminated reading copy — the surface biographical text plus a layer of inline exposition.

## SDK verbs

- `browse.resources` — find biographical targets
- `mark.delegate({ motivation: 'commenting', instructions: ... })`

## Parameters

| Parameter | Type | Default | Purpose |
|---|---|---|---|
| `<resourceId>` | CLI arg (optional) | all biographical resources | Scope to one |
| `COMMENT_INSTRUCTIONS` | env var | the standard exposition directive | Replace the directive |

## Tier-3 interactive checkpoint

Before the run: prints the target count and `confirm`s.

## Run it

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  node:24-alpine \
  sh -c 'npm ci --no-audit --no-fund && npx tsx skills/comment-life-context/script.ts'
```

The script prints an address: open it in a browser and approve the sign-in. [Signing in](https://github.com/The-AI-Alliance/semiont/blob/main/docs/builder/SIGN-IN.md) has the other ways a script can sign in.

(See [`ingest-corpus`'s "Run it"](../ingest-corpus/SKILL.md#run-it) for networking notes.)

## Output

Per-resource comment counts; final total. Comments are visible as commenting annotations in the Semiont browser, anchored to the source paragraphs.

## Guidance for the AI assistant

- **assess-historical-anchors flags; this skill explains.** Run them in either order — they don't depend on each other. Together they produce a richly-annotated read of the biography.
- **Comments feed `build-life-and-times`.** Skill 11's narrative pulls these comments forward as the bridging exposition between life events and their historical setting. Without this skill, the LifeAndTimes resource is sparser.
- **Re-running adds new comments.** No deduplication.
