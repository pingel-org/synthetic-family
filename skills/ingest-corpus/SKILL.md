---
name: ingest-corpus
description: Walk the repo's biographical and historical-context files (bios, letters, diaries, memoirs, generated context, photos, data) and create one Semiont resource per file with appropriate entity types.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read, Write
---

You are helping a user bootstrap a family / local-history corpus into a Semiont knowledge base. This is the foundation skill — every other skill in this repo operates against the resources this one creates.

## What it does

1. Calls `discoverCorpus()` (in [`src/files.ts`](../../src/files.ts)) to walk conventional subdirectories under the repo root and classify each file by directory + extension.
2. For each ingestable file, calls `yield.resource(...)` with an appropriate `format`, `entityTypes`, and `storageUri`.
3. Reports a per-class summary at the start and a per-file outcome during the run.

The file-discovery convention:

| Directory | Treated as | Default entity types |
|---|---|---|
| `bios/`, `biographies/` | biographical | `Biography`, `Subject` |
| `letters/` | biographical | `Letter`, `Correspondence` |
| `diaries/` | biographical | `Diary`, `Journal` |
| `memoirs/` | biographical | `Memoir` |
| `generated/`, `context/` | curated context | `HistoricalContext`, `Curated` |
| `photos/`, `images/` | photograph | `Photograph`, `FamilyImage` |
| `data/` | source data | `SourceData` |

Files in any other directory are skipped. `README.md`, `LICENSE`, `AGENTS.md`, and `.DS_Store` are explicitly ignored.

## SDK verbs

- `yield.resource` — one call per discovered file

## Tier-3 interactive checkpoint

Before the bulk upload: `confirm` shows the per-class summary and asks the user to proceed. In non-interactive mode the same summary still prints and the run proceeds automatically.

## Run it

**Prerequisite: the Semiont backend is running** — see [AGENTS.md › Backend setup](../../AGENTS.md#backend-setup).

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  -e SEMIONT_USER_EMAIL=admin@example.com \
  -e SEMIONT_USER_PASSWORD=<your-password> \
  node:24-alpine \
  sh -c 'npm install --silent --no-fund @semiont/sdk tsx && npx tsx skills/ingest-corpus/script.ts'
```

Run with `-it` (interactive TTY) and add `-e SEMIONT_INTERACTIVE=1` to enable the tier-3 confirm prompt.

**Why the `HOST_ADDR` discovery probe:** `localhost` from inside a freshly-spawned container is its own loopback, not the host's. `start.sh` uses the same trick to let backend containers find their data services. Substitute `docker run` or `podman run` for `container run` if those are your runtimes.

For Docker Desktop / Podman on macOS, replace the `HOST_ADDR` probe with `SEMIONT_API_URL=http://host.docker.internal:4000`. For Linux Docker, `--network host` + `SEMIONT_API_URL=http://localhost:4000` works.

## Output

The script prints, for each file, the resource id assigned and the entity types attached. Note these in passing — downstream skills (`mark-people`, `mark-places-and-events`, etc.) operate against the resource set this skill creates.

## Guidance for the AI assistant

- **Re-running creates duplicates.** The script does not deduplicate against existing resources. Use `semiont.browse.resources({ search: '<title>' })` to check before re-running, or have the user `down + up` their backend stack to start fresh.
- **The corpus directory layout is configurable.** A user with non-standard subdirectories can pass `overrides` to `discoverCorpus()` — see [`src/files.ts`](../../src/files.ts).
- **PDFs and images are ingested as binary.** They become catalog entries but `mark.assist` (which runs in subsequent skills) only operates on `text/plain` and `text/markdown`. PDF-to-markdown conversion is out of scope for v1.
- **Pre-curated context articles in `generated/`** ingest as `HistoricalContext` resources on day 1. Skill 6 (`build-historical-context`) matches against them rather than overwriting — so any hand-curated article a user has placed there is preserved.
