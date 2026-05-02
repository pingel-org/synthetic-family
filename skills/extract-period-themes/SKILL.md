---
name: extract-period-themes
description: Tag passages with recurring period themes (economic, social, civic, generational) and synthesize one Theme resource per distinct theme, with example passages bound to it.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read, Write
---

You are helping the user surface the recurring concerns that thread through a family / local-history corpus, and produce navigable Theme resources for each.

## What it does

1. Pass 1 — tagging: `mark.assist({ motivation: 'tagging', instructions: ... })` over each biographical resource. The model tags passages with short hyphenated theme labels (e.g., `agricultural-transformation`, `frontier-resilience`, `womens-civic-engagement`).
2. Pass 2 — aggregation: collect every tagging annotation by theme value. For each distinct theme, `yield.resource` a Theme resource with markdown body listing example passages and their source biographies.

The themes that surface depend entirely on the corpus — a 19th-century homestead family produces different themes than a 20th-century immigration archive.

## SDK verbs

- `mark.assist({ motivation: 'tagging', instructions: ... })` — pass 1
- `browse.resources`, `browse.annotations` — pass 2 collection
- `yield.resource` — Theme resources

## Parameters

| Parameter | Type | Default | Purpose |
|---|---|---|---|
| `THEME_INSTRUCTIONS` | env var | the standard period-theme tagging directive | Replace the directive |

## Tier-3 interactive checkpoint

Before pass 1: `confirm` after showing the target count. (No second checkpoint between pass 1 and 2 — the aggregation is automatic once tags exist.)

## Run it

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  -e SEMIONT_USER_EMAIL=admin@example.com \
  -e SEMIONT_USER_PASSWORD=<your-password> \
  node:24-alpine \
  sh -c 'npm install --silent --no-fund @semiont/sdk tsx && npx tsx skills/extract-period-themes/script.ts'
```

## Output

Per-resource tag counts, then per-theme synthesis decisions. Final summary: count of synthesized Theme resources.

## Guidance for the AI assistant

- **Open vocabulary.** This skill does not constrain the model to a fixed theme list — whatever the model considers a coherent recurring concern becomes a theme. To constrain the vocabulary, override `THEME_INSTRUCTIONS` with an explicit list of acceptable theme values.
- **Cross-corpus theme matching.** The current implementation creates a new Theme resource per distinct tag; if the corpus already has a Theme resource with that tag from a prior run, you'll get a duplicate. Future enhancement: `match.search` for an existing Theme before synthesizing. (Same caveat as build-historical-context.)
- **Themes feed `build-life-and-times`.** Skill 11 surfaces relevant themes when narrating a Subject's life-and-times. Skipping this skill yields a flatter narrative.
