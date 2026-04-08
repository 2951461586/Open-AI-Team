# Optional Integrations

This directory contains **secondary integration surfaces** for the open-source AI Team Runtime line.

These modules are allowed to carry:
- host-specific wiring
- provider/platform naming
- deployment/bootstrap assumptions
- control-plane/tool mapping glue

## Public rule

These integrations are:
- useful
- supported in-tree when needed
- explicitly **secondary** to the main runtime/harness product story

Do not use this directory as the first-read path for understanding the product.

## Current sub-surfaces

- `openclaw/` — OpenClaw-specific bootstrap and control-plane glue
- `host-bootstrap-selector.mjs` — integration selection seam

## Read first instead

- `../../README.md`
- `../../ARCHITECTURE.md`
- `../../docs/oss/repo-authority.md`
- `../../docs/oss/what-is-ai-team-runtime.md`
