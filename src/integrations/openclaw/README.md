# OpenClaw Integration Surface

This directory contains **OpenClaw-specific integration glue** for the otherwise host-neutral AI Team runtime.

## Purpose

Keep these concerns out of runtime-core and adapter-core whenever possible:

- OpenClaw tool names
- OpenClaw transport naming conventions
- maintainer-host bootstrap assumptions
- compatibility shims for OpenClaw session/control-plane semantics

## Current Contents

- `session-control-plane-tools.mjs` — maps the host-neutral control-plane operations onto current OpenClaw tool names.
- `host-bootstrap.mjs` — carries OpenClaw/maintainer-host bootstrap wiring, node controls, and session-substrate assembly.

## Boundary Rule

`src/team-runtime-adapters/*` should depend only on configurable contracts.

`src/integrations/openclaw/*` is allowed to carry provider-/host-specific naming and wiring.
It is an **optional integration surface**, not part of the primary product mental model or the canonical ingress/delivery contract.
