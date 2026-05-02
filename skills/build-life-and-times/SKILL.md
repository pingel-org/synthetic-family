---
name: build-life-and-times
description: For a target Subject Person resource, synthesize a unified narrative that interleaves the subject's documented life events with the historical context happening simultaneously. The capstone skill — depends on most prior skills having run.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read, Write
---

You are helping the user produce a "Life and Times of [Subject]" research artifact — a hybrid biographical narrative that interleaves the subject's documented life events with the broader historical backdrop they lived through.

This is the capstone skill. It depends on most prior skills having run, since it pulls together the layers they produced:

- The subject's biographical resource (skill 1)
- Dated annotations from `mark-people` and `mark-places-and-events` (skills 2, 3)
- Historical-anchor flags from `assess-historical-anchors` (skill 4)
- Inline contextual exposition from `comment-life-context` (skill 5)
- Bound HistoricalContext / Place resources (skills 6, 7)
- Theme resources (skill 10), if available

## What it does

1. Loads the target Subject resource and all its annotations.
2. Sorts annotations chronologically by best-effort extracted year.
3. Composes a markdown narrative grouped by year:
   - Linking annotations (life events) → bullet entries
   - Assessing annotations (anchor flags) → 🚩 sub-bullets
   - Commenting annotations (historical exposition) → 📝 sub-bullets carrying the comment text
4. `yield.resource` the composed narrative as a LifeAndTimes-typed resource.

The result reads as a one-life narrative that the corpus's other layers have already populated with historical depth.

## SDK verbs

- `browse.resource`, `browse.annotations`
- `yield.resource`

## Parameters

| Parameter | Type | Default | Purpose |
|---|---|---|---|
| `<subjectResourceId>` | CLI arg | required | The Subject Person resource to narrate |

To find candidate subject IDs:

```typescript
const subjects = await semiont.browse.resources({ entityType: 'Subject' });
```

## Tier-3 interactive checkpoint

Before yielding: prints the annotation count for the subject and asks `confirm`.

## Run it

**Prerequisite: most of the prior skills have been run** (1, 2, 3 minimum; 4, 5, 6, 7, 10 add content depth).

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  -e SEMIONT_USER_EMAIL=admin@example.com \
  -e SEMIONT_USER_PASSWORD=<your-password> \
  node:24-alpine \
  sh -c 'npm install --silent --no-fund @semiont/sdk tsx && npx tsx skills/build-life-and-times/script.ts <subjectResourceId>'
```

(See [`ingest-corpus`'s "Run it"](../ingest-corpus/SKILL.md#run-it) for networking notes.)

## Output

A LifeAndTimes resource. Body shape:

```markdown
# Life and Times of [Subject Name]

## 1844

- **1844 — Born in [...]** *(bound to 2 resource(s))*
  - 🚩 *Anchor*: 1844 — Born in [...]
  - 📝 *Context*: [historical exposition added by skill 5]

## 1862

- **1862–1865 — Served in [war]** *(bound to 1 resource(s))*
  - 🚩 *Anchor*: Served in [war]
  - 📝 *Context*: [exposition about the war and the subject's involvement]
```

## Guidance for the AI assistant

- **Run it per Subject.** The corpus may have multiple Subject Persons (one biography per Subject). Run `build-life-and-times` once per Subject to get a per-person narrative.
- **Quality scales with prior layers.** Without `comment-life-context` you lose the inline exposition. Without `build-historical-context` you lose the bound HistoricalContext resources. Without `assess-historical-anchors` you lose the inflection-point flags. Run them all for the richest output.
- **Output is editable.** The resource is markdown; the user can hand-edit it via the Semiont browser to refine the narrative voice or add additional commentary. Re-running this skill creates a new resource (no overwriting).
- **Year extraction is heuristic.** Same regex limitation as `build-timeline` — spans without a clear 4-digit year go into the Undated section. To improve, the user can hand-edit the source bio to use clearer date forms before running tier-1 skill 3.
