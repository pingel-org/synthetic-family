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

### Prerequisites

- A container runtime: [Apple Container](https://github.com/apple/container), [Docker](https://www.docker.com/), or [Podman](https://podman.io/)
- An inference provider: `ANTHROPIC_API_KEY` or [Ollama](https://ollama.com/) for fully local inference

No npm or Node.js installation required — everything runs in containers.

### Backend

Start the backend with one of the available inference configurations:

```bash
# Fully local with Ollama (default, no API key needed)
.semiont/scripts/start.sh --email admin@example.com --password password
```

```bash
# Anthropic cloud inference
export ANTHROPIC_API_KEY=<your-api-key>
.semiont/scripts/start.sh --config anthropic --email admin@example.com --password password
```

```bash
# See available configs
.semiont/scripts/start.sh --list-configs
```

Starts PostgreSQL and the Semiont backend in containers, and creates an admin user. The script stays attached and streams logs — open a separate terminal for the browser. Press Ctrl+C to stop.

Open **http://localhost:4000** to verify.

### Browse this knowledge base

Start a Semiont browser by [running the container or desktop app](https://github.com/The-AI-Alliance/semiont#start-the-browser).

Open **http://localhost:3000** and in the Knowledge Bases panel enter host `localhost`, port `4000`, and the email and password you provided above.

## What's Inside

The `.semiont/` directory contains the infrastructure to run a Semiont backend locally:

```
.semiont/
├── config                        # Project name and settings
├── compose/                      # Docker Compose file for backend
├── containers/                   # Dockerfile and inference configs for backend
│   └── semiontconfig/            # Inference config variants (.toml)
└── scripts/                      # Backend startup script
```

Documents anywhere in the project root become resources in the knowledge base when you upload them through the UI or CLI.

## Inference Configuration

Inference configs live in `.semiont/containers/semiontconfig/` and are selected with the `--config` flag. To create your own, add a `.toml` file to the same directory. See the [Configuration Guide](https://github.com/The-AI-Alliance/semiont/blob/main/docs/administration/CONFIGURATION.md) for the full reference.

## Documentation

See the [Semiont repository](https://github.com/The-AI-Alliance/semiont) for full documentation:

- [Configuration Guide](https://github.com/The-AI-Alliance/semiont/blob/main/docs/administration/CONFIGURATION.md) — inference providers, vector search, graph database settings
- [Project Layout](https://github.com/The-AI-Alliance/semiont/blob/main/docs/PROJECT-LAYOUT.md) — how `.semiont/` and resource files are organized
- [Local Semiont](https://github.com/The-AI-Alliance/semiont/blob/main/docs/LOCAL-SEMIONT.md) — alternative setup paths including the Semiont CLI

## License

Apache 2.0 — See [LICENSE](LICENSE) for details.
