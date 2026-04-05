# Host Runtime Config Boundary

> Goal: keep the default product runtime host-neutral while preserving maintainer-host probing as an explicit overlay.

## Public core

Default runtime config should be understandable from:
- repo config
- explicit env
- host-neutral node ids (`node-a/node-b/node-c`)

Public core authority:
- `src/index-host-config-neutral.mjs`

This layer may:
- read in-repo config inventory
- resolve canonical node ids
- merge explicit env overrides

This layer must not:
- assume `orchestrator.service`
- read live service env as its primary config source
- define maintainer-host topology as the public mental model

## Maintainer overlay

Maintainer/live-host probing is allowed, but only as an overlay.

Maintainer overlay authority:
- `src/index-host-config-maintainer.mjs`

This layer may:
- read service env
- probe live host process env
- inject live control tokens / live control URLs

This layer must be treated as:
- maintainer-facing
- optional
- secondary to public config authority

## Facade boundary

Compatibility/public import surface remains:
- `src/index-host-config.mjs`

Its job is to:
- expose stable helpers
- compose neutral config + optional maintainer overlay
- avoid re-mixing neutral logic and maintainer probing into one monolith

## Exit rule

Wave 2 is considered structurally landed when:
- neutral loader lives in its own module
- maintainer overlay lives in its own module
- facade remains thin
- smoke asserts the split directly
