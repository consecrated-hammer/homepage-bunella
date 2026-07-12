#!/usr/bin/env bash
#
# build.sh — rebuild and redeploy the homepage-bunella container.
#
# The Dockerfile is a multi-stage build that compiles both the frontend and
# backend from source inside the image, so there's nothing to build locally —
# this just rebuilds the image and restarts the one service.
#
# Usage:
#   ./build.sh              Rebuild the image and restart the container
#   ./build.sh --no-cache   Rebuild from scratch (ignore Docker layer cache)
#   ./build.sh --logs       Rebuild, restart, then follow the container logs
#
set -euo pipefail

SERVICE="homepage-bunella"

# Resolve paths relative to this script so it works from any working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="$(dirname "$SCRIPT_DIR")"        # .../dockerconfigs (holds docker-compose.yml + .env)
COMPOSE_FILE="$COMPOSE_DIR/docker-compose.yml"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "error: docker-compose.yml not found at $COMPOSE_FILE" >&2
  exit 1
fi

NO_CACHE=""
FOLLOW_LOGS=0
for arg in "$@"; do
  case "$arg" in
    --no-cache) NO_CACHE="--no-cache" ;;
    --logs)     FOLLOW_LOGS=1 ;;
    -h|--help)
      sed -n '3,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)
      echo "error: unknown argument '$arg' (try --help)" >&2
      exit 1 ;;
  esac
done

# Run from the compose directory so the adjacent .env is picked up.
cd "$COMPOSE_DIR"

echo "==> Building image for $SERVICE${NO_CACHE:+ (no cache)}"
docker compose -f "$COMPOSE_FILE" build $NO_CACHE "$SERVICE"

echo "==> Restarting $SERVICE"
docker compose -f "$COMPOSE_FILE" up -d "$SERVICE"

echo "==> Done."
docker compose -f "$COMPOSE_FILE" ps "$SERVICE"

if [[ "$FOLLOW_LOGS" -eq 1 ]]; then
  echo "==> Following logs (Ctrl-C to stop)"
  docker compose -f "$COMPOSE_FILE" logs -f "$SERVICE"
fi
