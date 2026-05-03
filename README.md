# Family History Demo Dataset

Synthetic family history documents created for demonstration purposes — designed for annotation, entity recognition, and knowledge extraction.

## About This Dataset

This repository contains **synthetic family history documents** with fictional but historically plausible names, dates, locations, and events representative of typical American family histories from the mid-19th to early 20th centuries.

- **Biographical narratives** — Life stories of fictional Turner family members
- **Historical photographs** — Representative images that could appear in family collections
- **Timeline entries** — Key life events presented in chronological format

The stories reflect real historical experiences: Civil War service, westward expansion under the Homestead Act, the 1870s locust plagues, the transition from agricultural to industrial economies, and small-town American life in the late 1800s and early 1900s.

This corpus is well-suited for entity recognition across people, places, dates, and events; mapping relationships between family members; temporal annotation and timeline construction; and showing how historical context can enrich family narratives.

All content is fictional and should not be used as actual historical references.

## Skills

This repo ships eleven skills that build a layered family / local-history KB on top of the Semiont SDK. See [AGENTS.md](AGENTS.md) for the full design discussion.

| Skill | What it does |
|---|---|
| [`ingest-corpus`](skills/ingest-corpus/SKILL.md) | Walk the repo's biographical and historical-context files; create one resource per file. |
| [`mark-people`](skills/mark-people/SKILL.md) | Detect Person mentions including descriptive references ("his father", "the schoolteacher"). |
| [`mark-places-and-events`](skills/mark-places-and-events/SKILL.md) | Detect Place, HistoricalEvent, and Date mentions. |
| [`assess-historical-anchors`](skills/assess-historical-anchors/SKILL.md) | Flag biography-meets-history inflection moments where a personal life event is shaped by a documented historical event. |
| [`comment-life-context`](skills/comment-life-context/SKILL.md) | Add inline historian's commentary explaining flagged inflection moments. |
| [`build-historical-context`](skills/build-historical-context/SKILL.md) | Synthesize HistoricalContext resources for events / eras / institutions, with Wikipedia citations. |
| [`build-place-articles`](skills/build-place-articles/SKILL.md) | Synthesize Place resources for towns, counties, military locations, institutions, cemeteries. |
| [`map-relationships`](skills/map-relationships/SKILL.md) | Promote Person mentions to canonical Person resources; encode kinship; attach Find a Grave URLs. |
| [`extract-period-themes`](skills/extract-period-themes/SKILL.md) | Tag passages with recurring period themes; synthesize one Theme resource per distinct theme. |
| [`build-timeline`](skills/build-timeline/SKILL.md) | Synthesize a unified chronological Timeline resource interleaving dated events from every biography. |
| [`build-life-and-times`](skills/build-life-and-times/SKILL.md) | For a target Subject, synthesize a unified narrative interleaving life events with simultaneous historical context. |

## Quick Start

Explore this dataset using [Semiont](https://github.com/The-AI-Alliance/semiont), an open-source knowledge base platform for annotation and knowledge extraction.

This repo follows the same layout and startup flow as [`semiont-template-kb`](https://github.com/The-AI-Alliance/semiont-template-kb). See its README for full setup instructions:

- [Quick Start: Local](https://github.com/The-AI-Alliance/semiont-template-kb#quick-start-local) — run the backend stack on your machine via `.semiont/scripts/start.sh`
- [Quick Start: Codespaces](https://github.com/The-AI-Alliance/semiont-template-kb#quick-start-codespaces) — launch a preconfigured backend in the cloud
- [Inference Configuration](https://github.com/The-AI-Alliance/semiont-template-kb#inference-configuration) — Ollama (local) vs. Anthropic (cloud) configs

### Open in Codespaces

Install the [GitHub CLI (`gh`)](https://cli.github.com/) if you haven't already.

> **Before creating:** add `ANTHROPIC_API_KEY` as a [user secret](https://github.com/settings/codespaces) with this repo selected. Otherwise the backend comes up but inference is non-functional until you add the secret and rebuild the container.

Create the codespace on a premium machine for faster builds and more headroom:

```bash
gh codespace create --repo pingel-org/synthetic-family --machine premiumLinux
```

Forward the backend port to your local machine, then fetch the auto-generated admin credentials:

```bash
gh codespace ports forward 4000:4000
gh codespace ssh -- cat .devcontainer/admin.json
```

The credentials let you log in via the Semiont browser — see [Quick Start: Codespaces](https://github.com/The-AI-Alliance/semiont-template-kb#quick-start-codespaces) on the template-kb README for the full browser-side flow.

## License

Apache 2.0 — See [LICENSE](LICENSE) for details.
