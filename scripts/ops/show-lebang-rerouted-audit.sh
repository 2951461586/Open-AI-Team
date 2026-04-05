#!/usr/bin/env bash
set -euo pipefail
# Legacy filename preserved as a compatibility wrapper.
# Prefer: scripts/ops/show-node-b-rerouted-audit.sh
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/show-node-b-rerouted-audit.sh" "$@"
