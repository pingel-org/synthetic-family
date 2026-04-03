#!/usr/bin/env bash
set -euo pipefail

# Build and run the Semiont frontend in a container.
#
# Prerequisites:
#   - Container runtime (Apple Container, Docker, or Podman)
#   - Backend running on http://localhost:4000
#
# Usage:
#   .semiont/scripts/local_frontend.sh
#   .semiont/scripts/local_frontend.sh --no-cache

cd "$(git rev-parse --show-toplevel)"

# --- Parse arguments ---

CACHE_FLAG=""
for arg in "$@"; do
  case "$arg" in
    --no-cache) CACHE_FLAG="--no-cache" ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

# --- Detect container runtime ---

for rt in container docker podman; do
  if command -v "$rt" > /dev/null 2>&1; then
    RT="$rt"
    break
  fi
done
if [[ -z "${RT:-}" ]]; then
  echo "No container runtime found. Install Apple Container, Docker, or Podman."
  exit 1
fi
echo "Using container runtime: $RT"

NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org}"
echo "npm registry: $NPM_REGISTRY"

# --- Build frontend ---

echo ""
echo "Building frontend..."
$RT build $CACHE_FLAG --tag semiont-frontend \
  --build-arg NPM_REGISTRY="$NPM_REGISTRY" \
  --file .semiont/containers/Dockerfile.frontend .

# --- Run frontend ---

echo ""
echo "Starting frontend on http://localhost:3000..."
$RT run --publish 3000:3000 -it semiont-frontend
