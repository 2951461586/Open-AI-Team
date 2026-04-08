# @ai-team/team-runtime

A **platform runtime package** for team-oriented multi-agent execution.

This package is not just a migration bucket. It is the canonical package authority for the current packaged Team Runtime export surface.

---

## What this package is

`@ai-team/team-runtime` is the package-level runtime/orchestration surface for:
- TL-first routing and execution
- task delegation and follow-up
- review/governance/delivery helpers
- desk/workbench/runtime support modules
- packaged runtime exports that belong in the platform runtime layer

Use it when you want the **Team Runtime product layer**, not just the lower-level harness substrate.

---

## Core runtime story

This package exists to support a runtime model like:

```text
request ingress
  -> TL runtime
  -> direct | confirm | partial_delegate | delegate | followup
  -> orchestration / planning / execution helpers
  -> artifacts / evidence / review / acceptance
  -> dashboard/API observation surfaces
```

This makes the package a runtime product surface, not merely an implementation container.

---

## What this package owns

This package currently owns the package-level implementation/export surface for modules such as:
- TL runtime and `tl-runtime/*`
- governance/runtime/lifecycle packaged exports
- desk/delivery/workbench packaged exports
- event/session/channel packaged exports already migrated into the package surface
- packaged channel adapter modules currently exported from the package surface

Representative files include:
- `src/team-tl-runtime.mjs`
- `src/tl-runtime/*.mjs`
- `src/team-governance-runtime.mjs`
- `src/workbench-manager.mjs`
- `src/delivery-contracts.mjs`
- `src/agent-desk.mjs`
- `src/desk-storage.mjs`
- `src/im-channel-router.mjs`
- `src/channel-adapters/*`

---

## What this package does not own

This package does not automatically own all runtime-related code in the repository.
Remaining boundaries still matter.

Not owned here by default:
- app/server route authority under `apps/api-server/`
- host/runtime adapter authority under `src/team-runtime-adapters/`
- optional integration-specific host wiring
- still-local or app-local seams that have not been formally flipped

---

## Stable execution contract

The Team Runtime is converging around four stable contract layers:

### 1) TL decision contract
- direct
- confirm task
- partial delegate
- delegate
- follow-up continuation

### 2) Execution/orchestration contract
- work item expansion
- member execution
- single-flight/follow-up handling
- fail-fast and fallback

### 3) Delivery contract
- deliverables
- artifacts
- evidence
- review/judge signals
- acceptance closure

### 4) Observation contract
- dashboard read models
- timeline/task/workbench visibility
- runtime state presentation

This is the architectural reason the package should be understood as a **platform runtime package**.

---

## Key files

- `src/index.mjs` — package export surface
- `src/team-tl-runtime.mjs` — top-level TL runtime export
- `src/tl-runtime/` — execution helpers and runtime submodules
- `src/team-task-dispatcher.mjs` — routing/classification surface
- `src/team-governance-runtime.mjs` — governance runtime export
- `src/workbench-manager.mjs` — workbench package surface
- `src/delivery-contracts.mjs` — delivery/acceptance contract helpers
- `src/agent-desk.mjs` / `src/desk-storage.mjs` — desk surface

---

## Compatibility rule

Covered legacy source paths under `src/team/*.mjs` and `src/team/tl-runtime/*.mjs` remain thin compatibility shims only where migration has completed.
New logic for the covered package-owned surface should land here.

---

## Relationship to the rest of the repo

Use this package when you want:
- the packaged runtime/orchestration layer
- TL-first runtime exports
- packaged desk/governance/workbench/delivery/runtime helpers

Use `@ai-team/agent-harness` when you want:
- a lower-level forkable harness substrate
- independent-agent runtime contracts and shell/doctor flows

---

## Recommended reading

- `../../docs/oss/what-is-ai-team-runtime.md`
- `../../docs/architecture/current-team-runtime-architecture.md`
- `../agent-harness/README.md`
