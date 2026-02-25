#!/usr/bin/env bash
set -euo pipefail

if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

if [[ -f ".env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.local"
  set +a
fi

if [[ -n "${NODE_EXTRA_CA_CERTS:-}" ]]; then
  if [[ ! -f "${NODE_EXTRA_CA_CERTS}" ]]; then
    echo "NODE_EXTRA_CA_CERTS points to a missing file: ${NODE_EXTRA_CA_CERTS}" >&2
    exit 1
  fi
fi

subcommand="${1:-dev}"
shift || true

exec next "${subcommand}" "$@"
