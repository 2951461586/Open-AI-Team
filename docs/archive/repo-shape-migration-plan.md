# Repo Shape Migration Plan

> Purpose: turn the already-locked **target repo shape** into an executable migration blueprint.

## 1. Target shape (north star)

```text
packages/
  harness-core/
  team-runtime/
  agent-package-sdk/
  integration-openclaw/
  integration-qq/
apps/
  dashboard/
examples/
  oss-minimal/
  third-party-agent/
docs/
archive/
```

This document defines **how to get there**, not just what the end state should look like.

## 2. Verified current source grouping

### Natural future `packages/harness-core`
Current source candidates:
- `src/agent-harness-core/*`

Why this boundary is already strong:
- standalone harness baseline is already documented as canonical
- OSS/package/shell/plugin/bridge contracts already live here
- examples already treat it as the reusable substrate

### Natural future `packages/team-runtime`
Current source candidates:
- `src/team/*`
- `src/team-core/*`
- `src/team-runtime-adapters/*`
- selected `src/routes/*`
- selected `src/routes/team-state/*`

Why this boundary is strong:
- it is the main orchestration product
- TL runtime, routing, store, governance, query contracts, and node/runtime observability all live in this band

### Natural future `packages/integration-openclaw`
Current source candidates:
- `src/integrations/openclaw/*`
- maintainer-host/OpenClaw-specific bootstrap glue split out from `src/index-host-config.mjs`

Why this boundary is strong:
- repository docs already treat it as optional integration
- code is already grouped under `src/integrations/openclaw/`

### Natural future `apps/dashboard`
Current source candidates:
- `dashboard/*`

Why this boundary is already obvious:
- full app source tree exists
- build authority already isolated
- release and deployment docs already point to it as one application surface

### Natural future `packages/agent-package-sdk`
Current source candidates:
- currently mixed across `src/agent-harness-core/*`, `schemas/*`, and example/package validation tooling

Why this needs a deliberate split:
- package/manifest/shell/contracts exist
- but they are still bundled together with harness runtime implementation

## 3. Migration order

### Phase A — no-runtime-break structural preparation
- keep existing paths authoritative
- add migration docs and ownership boundaries
- avoid changing imports yet unless it reduces confusion immediately

### Phase B — package-ready entry surfaces
- add thin package-facing entry files/re-export layers
- keep current source paths as implementation homes temporarily
- ensure CI can validate both old source authority and future package grouping story

### Phase C — first physical moves
Recommended first moves:
1. `dashboard/` -> `apps/dashboard/`
2. `src/integrations/openclaw/` -> `packages/integration-openclaw/`
3. `src/agent-harness-core/` -> `packages/harness-core/`

Reason:
- these three already have the strongest independent identity
- lowest conceptual ambiguity
- easiest to explain to OSS readers

### Phase D — split team runtime package
Move toward:
- `packages/team-runtime/core`
- `packages/team-runtime/routes`
- `packages/team-runtime/adapters`

This can still publish or present as one repo-local package even if internally subdivided.

### Phase E — extract agent-package-sdk
Move package-facing contract builders, manifest helpers, validation, and shell-facing onboarding surfaces into:
- `packages/agent-package-sdk/`

Do this only after harness-core and team-runtime boundaries are stable enough.

## 4. Keep vs move decisions

### Keep at root for now
- `README.md`
- `README_zh.md`
- `GETTING-STARTED.md`
- `ARCHITECTURE.md`
- `package.json`
- `docs/`
- `examples/`
- `schemas/`
- `fixtures/`
- `config/`

### Move later or re-home behind packages/apps
- `dashboard/`
- `src/agent-harness-core/`
- `src/integrations/openclaw/`
- eventually parts of `src/team*/`

### Keep as maintainer/private/secondary during transition
- `config/team/`
- `docs/ops/`
- `scripts/ops/`
- `scripts/acceptance/`

## 5. Required guardrails before physical moves

Before any directory move:
- preserve current public entry docs
- update smoke paths in the same change
- keep repo-local onboarding readable
- ensure dashboard build authority remains explicit
- ensure examples still run without reading maintainer/private docs first

## 6. First executable migration batch

The first low-risk batch should be:

1. add this migration plan as roadmap authority
2. finish OpenClaw retirement boundary plan
3. introduce package/app wording consistently in docs
4. optionally add compatibility wrappers or repo aliases for future paths
5. only then start physical directory relocation

## 7. Success condition

This line is successful when the repository can be explained as:

- `apps/dashboard` = UI app
- `packages/harness-core` = reusable execution substrate
- `packages/team-runtime` = orchestration product runtime
- `packages/integration-openclaw` = optional host integration
- `packages/agent-package-sdk` = public onboarding/contracts/tooling

without forcing readers to learn the historical `src/` layout first.
