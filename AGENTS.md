# AGENTS.md — synthetic-family (and any family / local-history KB)

This is a family / local-history Semiont knowledge base. The corpus is biographical narratives, photographs, and curated historical-context articles. The skills detect people, places, events, and dates from those documents and build out a real-world historical-context layer around them, with Wikipedia citations and (for users with real data) Find a Grave search URLs.

If you're an AI assistant working in this repo, this file is your orientation. The skills are **corpus-generic** — drop a different family / local-history corpus into the same directory layout and they work without modification.

## What's here

- **`bios/`** — biographical narratives (markdown). One file per Subject; skill 1 ingests each as a Subject Person resource.
- **`generated/`** — pre-curated historical-context articles. Skill 1 ingests them as HistoricalContext resources on day 1; skill 6 *matches* against them rather than overwriting.
- **`photos/`** — photographs (`.jpg`, etc.). Ingested as binary Photograph resources.
- **`data/`** — bulk source files (census excerpts, registry exports, etc.) if any. Optional.
- **`src/`** — small helper modules:
  - `src/sdk.ts` — shared SemiontClient connect helper
  - `src/files.ts` — corpus file discovery and classification
  - `src/wikipedia.ts` — Wikipedia URL lookups + "External references" formatting (cached locally to `.cache/wikipedia/`)
  - `src/findagrave.ts` — Find a Grave search URL builder, memorial-URL extraction
  - `src/interactive.ts` — `confirm` / `pick` / `preview` helpers for tier-3 interactive checkpoints
- **`skills/`** — eleven skills, each shipping a `SKILL.md` (orientation + frontmatter for skill-aware tools like Claude Code) plus a `script.ts` that uses `@semiont/sdk` against the running backend.

| Skill | What it does | New SDK verbs |
|---|---|---|
| [`ingest-corpus`](skills/ingest-corpus/) | Walk the repo, create one resource per file | `yield.resource` |
| [`mark-people`](skills/mark-people/) | Detect Person mentions (named + descriptive) | `mark.assist` (linking + descriptive references) |
| [`mark-places-and-events`](skills/mark-places-and-events/) | Detect Place / HistoricalEvent / Date mentions | `mark.assist` (linking) |
| [`assess-historical-anchors`](skills/assess-historical-anchors/) | Flag biography-meets-history inflection moments | `mark.assist` (assessing) |
| [`comment-life-context`](skills/comment-life-context/) | Add inline historical exposition | `mark.assist` (commenting) |
| [`build-historical-context`](skills/build-historical-context/) | Synthesize HistoricalContext resources with Wikipedia citations | `+ yield.resource`, `bind.body` |
| [`build-place-articles`](skills/build-place-articles/) | Promote Place mentions to canonical Place resources with Wikipedia + Find a Grave URLs | `+ yield.fromAnnotation` |
| [`map-relationships`](skills/map-relationships/) | Promote Person mentions to Person resources, encode kinship & relationships, attach Find a Grave search URLs | `+ yield.fromAnnotation`, `bind.body` |
| [`build-timeline`](skills/build-timeline/) | Synthesize a unified chronological Timeline resource | `+ yield.resource` |
| [`extract-period-themes`](skills/extract-period-themes/) | Tag and synthesize Theme resources for recurring period concerns | `mark.assist` (tagging) |
| [`build-life-and-times`](skills/build-life-and-times/) | Per-Subject narrative synthesis interleaving life events with historical backdrop | full pipeline composition |

The four tier-1 skills are one SDK call each; the seven tier-2 skills compose `mark.assist` + `gather` + `match` / `yield` + `bind` into pipelines that grow new structured layers (HistoricalContext, Place, Person, Timeline, Theme, LifeAndTimes).

## What does family / local-history research involve?

Working historical and genealogical research usually involves several braided activities:

1. **Cataloging** — who, when, where: birth/death/marriage records, parents, children, occupations.
2. **Place anchoring** — where they lived, fought, worshipped, were buried.
3. **Event anchoring** — what historical events shaped their lives.
4. **Relationship mapping** — kinship lines, neighbors, employers, fellow soldiers.
5. **Source verification** — distinguishing primary documents from family lore.
6. **Era contextualization** — broader historical patterns the subject participated in.
7. **Local history connection** — how a personal life intersects with town / county / regional history.

The Semiont SDK is well-suited for the entity, place, event, relationship, and contextualization work. The skills below are organized to demonstrate that.

## Important constraint: the skills do NOT invent biographical subjects

`map-relationships` is strictly source-grounded. It promotes Person spans that the source documents actually contain to canonical Person resources — but it never synthesizes fictional family members or attaches unsupported claims to existing Persons. If a name doesn't appear in the corpus, the skill does not invent it.

## Entity types used in this KB

- **People**: `Person`, `Subject`, `Relative`, `Acquaintance`, `HistoricalFigure`
- **Places**: `Place`, `Town`, `County`, `State`, `Region`, `MilitaryLocation`, `Institution`, `Cemetery`
- **Events**: `HistoricalEvent`, `War`, `Battle`, `Disaster`, `LegislativeAct`, `EconomicEvent`, `Migration`, `Era`, `Decade`
- **Time**: `Date`, `Year`, `DateRange`, `LifeEvent`
- **Synthesized aggregates**: `HistoricalContext`, `Curated`, `Theme`, `Timeline`, `LifeAndTimes`
- **Source types**: `Biography`, `Subject`, `Letter`, `Diary`, `Memoir`, `Photograph`, `FamilyImage`, `SourceData`

## External references pattern

The SDK does not yet have a first-class verb for representing external links. For now, synthesized resources cite their external anchors (Wikipedia articles, Find a Grave memorials, etc.) via a **plain markdown "External references" section** in the resource body:

```markdown
## External references

- [Homestead Acts](https://en.wikipedia.org/wiki/Homestead_Acts) — Wikipedia
- [Subject Name (cemetery search)](https://www.findagrave.com/memorial/search?...) — Find a Grave search
```

`src/wikipedia.ts:formatExternalReferences` builds the markdown; `src/findagrave.ts` produces the Find a Grave URLs (search-URL only — see "Find a Grave caveat" below).

## Find a Grave caveat

Find a Grave (owned by Ancestry.com) does **not** have a public API and explicitly disallows scraping. So `src/findagrave.ts` does not fetch records — it only:

1. **Builds a deterministic search URL** the user can follow manually (parameters: name, birth year, death year, location, cemetery).
2. **Reads pre-supplied memorial URLs** out of bio markdown frontmatter (e.g., `memorial: https://www.findagrave.com/memorial/12345`) for users with real data who have already located records.

For the synthetic Turner family seeded in this repo, the search URLs return no useful results — the Turners are fictional. The integration is here for users with real family-history data who fork this repo.

For programmatic verification of cemetery and death records (active record check, photo retrieval), use APIs that have terms permitting it — BillionGraves and FamilySearch are the practical options. Out of scope for v1.

## Worked example

For a corpus of 19th–early-20th-century American family biographies (like the seeded Turner family), running the full pipeline produces:

1. `ingest-corpus` creates Biography resources for each bio + HistoricalContext resources for the curated articles already in `generated/`.
2. `mark-people` detects names and descriptive references ("his father", "the schoolteacher").
3. `mark-places-and-events` tags places (counties, towns, military locations), events (Civil War, Homestead Act, regional disasters), and dates.
4. `assess-historical-anchors` flags moments where personal life intersects documented history (e.g., a homesteading reference, a military service entry).
5. `comment-life-context` adds inline exposition explaining the historical conditions surrounding each life event.
6. `build-historical-context` matches against existing curated articles, synthesizes new HistoricalContext resources for events/eras the corpus references, with Wikipedia URLs.
7. `build-place-articles` promotes places to canonical Place resources, citing Wikipedia.
8. `map-relationships` promotes Person mentions to Person resources, encodes kinship and acquaintance edges, attaches Find a Grave search URLs.
9. `build-timeline` produces a unified chronological Timeline resource interleaving life events from every bio.
10. `extract-period-themes` surfaces recurring concerns (e.g., agricultural transformation, women's civic engagement, generational continuity).
11. `build-life-and-times` produces a per-Subject "Life and Times" narrative resource that interleaves the subject's life events with the historical backdrop.

For a corpus from a different period (e.g., a 20th-century immigration archive or an industrial-revolution memoir collection), entirely different events, places, and themes surface — the skills are generic about what they detect.

## Working in containers — do not install npm packages on the host

This template assumes a containerized workflow. The backend stack runs in containers (`.semiont/scripts/start.sh` brings it up); the skills run in containers too. There is **no need** to install Node, the SDK, or any other tooling on the host machine.

Each skill's `SKILL.md` shows a `container run` invocation that:

1. Mounts the repo as `/work` inside a throwaway `node:24-alpine` container.
2. Installs `@semiont/sdk` and `tsx` *inside* the container.
3. Runs the skill's `script.ts` against the env-configured backend.

Apple Container, Docker, and Podman all accept the same `run --rm -v ... -w ... <image> <cmd>` form. The skills show `container run` (Apple's CLI); substitute `docker run` or `podman run` as needed. See [`skills/ingest-corpus/SKILL.md`](skills/ingest-corpus/SKILL.md) for the full networking discussion (the `HOST_ADDR` discovery probe).

## Backend setup

Before running any skill, the Semiont backend stack must be up. Two paths:

### Local: `start.sh`

```bash
.semiont/scripts/start.sh --email admin@example.com --password password --observe
```

Flags: `--email` / `--password` to seed an admin user, `--observe` to start a Jaeger sidecar (traces at http://localhost:16686), `--config anthropic` to use cloud inference (requires `ANTHROPIC_API_KEY`), `--no-cache` to force a fresh image build. `--help` lists all options.

### Codespaces

Open the repo in a Codespace — `post-create.sh` builds the stack, `post-start.sh` brings it up, admin credentials are auto-generated into `.devcontainer/admin.json`. Print them any time:

```bash
cat .devcontainer/admin.json
```

To reach the backend from your local Semiont browser:

```bash
gh codespace ports forward 4000:4000
```

(If `gh` rejects this with `must have admin rights to Repository`, run `gh auth refresh -h github.com -s codespace` once.)

## Parameterization and interactivity

Skills are parameterized in three tiers.

### Tier 1 — environment configuration

| Var | Purpose |
|---|---|
| `SEMIONT_API_URL` | Backend URL (default `http://localhost:4000`) |
| `SEMIONT_USER_EMAIL` | Authenticating user |
| `SEMIONT_USER_PASSWORD` | Authenticating user's password |

### Tier 2 — skill-invocation parameters

Per-skill env vars and CLI args. Most skills accept `MATCH_THRESHOLD` (default 30) for cluster-merge / candidate binding. Tier-1 mark skills also accept `ENTITY_TYPES` to override the default type list. Instruction text for `assess-*` and `comment-*` skills is exposed as `ASSESS_INSTRUCTIONS` / `COMMENT_INSTRUCTIONS` so users can retune focus without editing TypeScript. See each skill's `SKILL.md` for specifics.

### Tier 3 — interactive checkpoints

Off by default (batch automation works as before). Enable per-run with `--interactive` (CLI flag) or `SEMIONT_INTERACTIVE=1` (env var). Skills pause at natural decision points and show what they found / what they're about to do, letting the user steer.

The same render-what-found logic runs in non-interactive mode — output goes to logs instead of pausing for input. Visibility without blocking.

Tier-2 env vars can pre-answer tier-3 prompts (e.g., `MATCH_THRESHOLD=25` pre-answers cluster-merge confidence). The "interactive once, scripted thereafter" workflow falls out naturally: a user runs interactively to discover the right values for a corpus, then locks them in via env vars for batch runs.

## Background reading

| Where | What |
|---|---|
| [`@semiont/sdk` README](https://github.com/The-AI-Alliance/semiont/tree/main/packages/sdk) | The TypeScript surface — eight verbs (frame, yield, mark, match, bind, gather, browse, beckon) plus admin/auth/job. |
| [SDK Usage docs](https://github.com/The-AI-Alliance/semiont/tree/main/packages/sdk/docs) | Cache semantics, reactive model, state units, error handling. |
| [Semiont protocol docs](https://github.com/The-AI-Alliance/semiont/tree/main/docs/protocol) | The eight-flow framing. |
| [Semiont protocol skills](https://github.com/The-AI-Alliance/semiont/tree/main/docs/protocol/skills) | Reference skill packs — `semiont-wiki`, `semiont-comment`, `semiont-highlight`, etc. The patterns in this repo borrow from these. |
| [.plans/HISTORY-SKILLS.md](.plans/HISTORY-SKILLS.md) | The full design plan for these skills. |
