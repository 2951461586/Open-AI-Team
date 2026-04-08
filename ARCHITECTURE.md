# Architecture

This file explains the **public product architecture** of the repository.
If `README.md` answers **what this project is**, this file answers **how the main product surfaces fit together**.

---

## 1. Product family

This repository is one open-source product family with four surfaces:

### A. AI Team Runtime — primary runtime product
A team-oriented multi-agent runtime for:
- planning
- delegation
- review
- evidence-driven delivery
- follow-up and closure

Primary code surfaces:
- `packages/team-runtime/`
- `src/team/`
- `src/team-runtime-adapters/`
- `src/routes/`
- `apps/api-server/`

### B. Dashboard — primary UI product
The dashboard/workbench is the operator-facing observation and interaction layer.

Primary code surfaces:
- `dashboard/`
- `apps/dashboard/` (transition/app packaging surface)

### C. Agent Harness — reusable execution substrate
A reusable harness substrate for standalone or third-party agents.

Primary code surfaces:
- `packages/agent-harness/`
- `examples/oss-minimal/`
- `examples/third-party-agent-sample/`
- `schemas/`

### D. Optional Integrations — secondary surfaces
Host-, channel-, and deployment-specific integrations.

Examples:
- `src/integrations/openclaw/`
- channel adapters
- maintainer-host wiring
- plugin ecosystems under `plugins/`
- optional/companion services under `services/`
- secondary desktop shell work under `electron/`

These are useful but **not required** to understand the mainline product.
Related/experimental side projects under `projects/` and low-authority shared/output areas under `shared/` are also outside the primary architecture story.

---

## 2. Runtime execution model

The primary execution story is:

```text
Ingress (dashboard / HTTP / compat inputs)
  -> dispatch / route surface
  -> TL runtime
  -> decision: direct | confirm | partial_delegate | delegate | followup
  -> runtime adapters / execution harness
  -> member sessions / execution roles
  -> artifacts / evidence / review / acceptance
  -> dashboard + API response surfaces
```

This is a **TL-first runtime**, not a chat-first runtime.

### TL-first means
The Team Leader runtime is the main authority for deciding whether a request should:
- be answered directly
- become a task
- continue an existing task thread
- delegate to one or more members
- enter review / replan / closure

### Why this matters
It gives the product a stable execution contract instead of ad-hoc agent routing.

---

## 3. Stable execution contract

The runtime is converging around four stable layers:

### 1) Routing and decision
- classify request shape
- normalize task intent
- decide direct vs delegated paths

### 2) Delegation and orchestration
- planner / executor / critic / judge style coordination
- work-item expansion
- follow-up continuation
- replan / fail-fast / fallback handling

### 3) Delivery closure
- deliverables
- artifacts
- evidence
- review signals
- acceptance / final closure

### 4) Observation
- dashboard read models
- task timeline
- runtime status
- task/workbench views
- operator follow-up and inspection

This is the reason the project is more than “agents chatting to tools”.

---

## 4. Package surfaces

## 4.1 `packages/agent-harness/`
This is the canonical package authority for the standalone harness substrate.

It owns:
- contract builders
- provider registry
- workflow / policy abstractions
- shell / doctor / activation surface
- standalone product runtime assets
- host-neutral onboarding contracts

Use this when you want a **forkable execution base** for independent agents.

## 4.2 `packages/team-runtime/`
This is the canonical package authority for the packaged team-runtime export surface.

It owns the current package-level runtime/orchestration surface including:
- TL runtime exports
- governance/lifecycle/workbench packaged exports
- desk/delivery/runtime helper exports
- packaged channel/runtime modules already migrated into the package-owned surface

Use this when you want the **platform runtime package**, not just the low-level harness.

## 4.3 `packages/team-core/`
Platform-neutral semantics, contracts, and domain helpers.

## 4.4 `packages/tools/`
Public tool/provider surface.

---

## 5. App and mixed surfaces

### `apps/api-server/`
Current app/server authority for server entry and route surface.

### `src/team/`
Compatibility shims plus still-local runtime areas that have not yet moved behind package/app authority.

### `src/team-runtime-adapters/`
Runtime/control-plane/session adapter layer.

### `src/integrations/`
Optional integrations only.

### `dashboard/`
Current primary dashboard UI authority.

---

## 6. Independent-agent onboarding model

Third-party agents are expected to integrate through explicit contracts, not through private host/session internals.

The public onboarding story is:
- manifest
- package
- provider registry
- shell
- doctor
- activation checklist
- session / desk / bridge / lifecycle contracts

This is the key bridge between:
- AI Team Runtime as a product
- Agent Harness as a reusable substrate
- Open-source onboarding as a credible external path

Read next:
- `docs/architecture/independent-agent-onboarding.md`
- `packages/agent-harness/README.md`
- `examples/third-party-agent-sample/README.md`

---

## 7. Optional integrations boundary

Optional integrations are intentionally outside the main product story.

That means:
- OpenClaw-specific wiring is optional
- channel-specific wiring is optional
- maintainer-host deployment specifics are optional
- none of these should redefine the public architecture narrative

This is important for open-source clarity.

---

## 8. Dashboard role

The dashboard should be understood as the **execution visibility front-end**, not just a chat UI.

Its job is to surface:
- task graph / task flow
- member execution progress
- runtime status
- artifacts and evidence
- review/acceptance state
- operator follow-up context

A strong dashboard is what makes the runtime feel observable and operational rather than opaque.

---

## 9. Release and OSS engineering

Open-source quality here is not only about code structure.
It also depends on:
- public-safe boundaries
- release-surface allowlists
- smoke tests
- example validity
- documentation alignment
- optional integration containment

Read next:
- `docs/architecture/release-surface-allowlist.md`
- `docs/oss/dashboard-observability-surface.md`
- `docs/oss/open-source-release-engineering.md`

---

## 10. Recommended reading order

1. `README.md`
2. `GETTING-STARTED.md`
3. `ARCHITECTURE.md`
4. `docs/architecture/product-surface-and-repo-map.md`
5. `docs/oss/repo-authority.md`
6. `docs/oss/what-is-ai-team-runtime.md`
7. `docs/architecture/current-team-runtime-architecture.md`
8. `docs/architecture/independent-agent-onboarding.md`
9. `docs/oss/open-source-release-engineering.md`
