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

## Quick Start

Explore this dataset using [Semiont](https://github.com/The-AI-Alliance/semiont), an open-source knowledge base platform for annotation and knowledge extraction.

This repo follows the same layout and startup flow as [`semiont-template-kb`](https://github.com/The-AI-Alliance/semiont-template-kb). See its README for full setup instructions:

- [Quick Start: Local](https://github.com/The-AI-Alliance/semiont-template-kb#quick-start-local) — run the backend stack on your machine via `.semiont/scripts/start.sh`
- [Quick Start: Codespaces](https://github.com/The-AI-Alliance/semiont-template-kb#quick-start-codespaces) — launch a preconfigured backend in the cloud
- [Inference Configuration](https://github.com/The-AI-Alliance/semiont-template-kb#inference-configuration) — Ollama (local) vs. Anthropic (cloud) configs

### Open in Codespaces

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://github.com/codespaces/new/pingel-org/synthetic-family)

> **Before launching:** add `ANTHROPIC_API_KEY` as a [user secret](https://github.com/settings/codespaces) with this repo selected. Otherwise the backend comes up but inference is non-functional until you add the secret and rebuild the container.

## License

Apache 2.0 — See [LICENSE](LICENSE) for details.
