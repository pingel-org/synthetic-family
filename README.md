# Family History Demo Dataset

## Running with Semiont

Explore this dataset using [Semiont](https://github.com/The-AI-Alliance/semiont), an open-source knowledge base platform for annotation and knowledge extraction.

### Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org/)
- **Docker or Podman** — for the database and proxy containers
- **Inference provider** — either an `ANTHROPIC_API_KEY` (cloud) or [Ollama](https://ollama.com/) running locally
- **Neo4j** — a free cloud instance at [Neo4j Aura](https://neo4j.com/cloud/aura/) or Neo4j running locally

### Install and run

```bash
npm install -g @semiont/cli neo4j-driver
git clone https://github.com/pingel-org/synthetic_family
cd synthetic_family
semiont serve
```

`semiont local` sets up and starts all services in one step. When it finishes, open **http://localhost:8080** and log in with:

- **Email:** `admin@example.com`
- **Password:** `password`

For full details see the [Semiont Local Setup Guide](https://github.com/The-AI-Alliance/semiont/blob/main/docs/LOCAL-SEMIONT.md).

---

## About This Dataset

This directory contains **synthetic family history documents** created for demonstration purposes. All names, dates, locations, and events are fictional, though they are designed to be historically plausible and representative of typical American family histories from the mid-19th to early 20th centuries.

## Purpose

These materials are crafted to:
- Be relatable to general audiences interested in genealogy and family history
- Demonstrate the annotation and knowledge extraction capabilities of Semiont
- Provide realistic examples of biographical narratives and historical documentation
- Show how family relationships, timelines, and historical contexts can be annotated and linked

## Contents

The synthetic documents include:
- **Biographical narratives** - Life stories of fictional Turner family members
- **Historical photographs** - Representative images that could appear in family collections
- **Timeline entries** - Key life events presented in chronological format

## Historical Context

While the Turner family is entirely fictional, their stories reflect real historical experiences:
- Civil War service and its impact on families
- Westward expansion and homesteading under the Homestead Act
- Agricultural challenges like the 1870s locust plagues
- The transition from agricultural to industrial economies
- Small-town American life in the late 1800s and early 1900s

## Usage

These materials are ideal for:
- Testing entity recognition (people, places, dates, events)
- Exploring relationship mapping between family members
- Demonstrating temporal annotation and timeline construction
- Showing how historical context can enrich family narratives
- Training annotation models on genealogical content

## Note on Authenticity

While these documents aim for historical plausibility, they should not be used as actual historical references. They are educational tools designed to demonstrate information extraction and annotation techniques on familiar, accessible content that many people can relate to through their own family histories.
