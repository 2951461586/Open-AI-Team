# AI Team Harness / Architecture

> Repository layering authority for the public product family.
> If `README.md` answers **what this project is**, this file answers **how the repository is layered**.

---

## 1. Final Product Positioning

This repository now has **four explicit surfaces**:

### A. AI Team Runtime — primary product
The main orchestration/runtime product for planning, delegation, review, and evidence-driven delivery.

Primary code surface:
- `src/team/`
- `src/team-core/`
- `src/team-runtime-adapters/`
- `src/routes/`

### B. Dashboard — primary application UI
The operational workbench and visualization layer for tasks, artifacts, timelines, node/runtime visibility, and chat.

Primary code surface:
- `dashboard/src/`

### C. Harness Core + Agent Package SDK — reusable substrate
The reusable execution substrate plus explicit contracts for third-party or independent-agent onboarding.

Primary code surface:
- `src/agent-harness-core/`
- `schemas/`
- `examples/oss-minimal/`
- `examples/third-party-agent-sample/`

### D. Optional Integrations — non-primary surface
Host-, channel-, or environment-specific integrations.

Examples:
- `src/integrations/openclaw/`
- compatibility ingress surfaces
- maintainer-host / live deployment wiring

Rule:
- **A / B / C are the public product family**.
- **D is optional integration surface, not required to understand the mainline product**.

---

## 2. Authority Order

Current authority order for understanding the repository:

1. `README.md`
2. `GETTING-STARTED.md`
3. `ARCHITECTURE.md`
4. `docs/architecture/product-surface-and-repo-map.md`
5. `docs/architecture/release-surface-allowlist.md`
6. `docs/architecture/current-team-runtime-architecture.md`
7. `docs/architecture/session-capability-and-followup-fallback.md`
8. `docs/architecture/independent-agent-onboarding.md`
9. `docs/architecture/standalone-harness-baseline-release.md`

If an archived or maintainer-facing document disagrees with this stack, prefer this stack.

---

## 3. Current Top-Level Layering

```text
Repository
├── README.md
├── GETTING-STARTED.md
├── ARCHITECTURE.md
├── docs/
├── config/
├── src/
├── dashboard/
├── examples/
├── schemas/
├── fixtures/
└── scripts/
```

This is the **current** repo shape.
The **target** repo shape remains:

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

That target shape is the structural north star for future extraction and cleanup.

---

## 4. Source Tree Responsibilities

## 4.1 `src/agent-harness-core/`
**Role:** reusable execution substrate and contract authority.

This layer owns:
- runtime contracts
- workflow / policy abstractions
- provider / backend / worker / broker contracts
- shell / plugin / bridge / session / desk / lifecycle contracts
- standalone product runtime assets

This is the canonical authority for the reusable substrate.

---

## 4.2 `src/team-core/`
**Role:** platform-neutral team semantics.

This layer should contain only:
- data contracts
- work item normalization
- decision parsing
- query contracts
- pure safety / helper logic

It should not contain host-specific transport or operational wiring.

---

## 4.3 `src/team-runtime-adapters/`
**Role:** neutral adapter layer between platform-neutral semantics and concrete runtime/control-plane capabilities.

This layer owns:
- control-plane client abstractions
- runtime adapter wiring
- execution adapter wiring
- transport-facing contract surfaces
- capability mediation between product runtime and live execution substrate

This layer is public-safe only when it stays contract-first and host-neutral in narrative.

---

## 4.4 `src/team/`
**Role:** active Team Runtime product logic.

This layer owns:
- TL runtime
- planner / executor / critic / judge orchestration
- dispatch / governance runtime integration
- artifacts / memory / follow-up orchestration
- team execution coordination

This is the main operational heart of the primary product.

---

## 4.5 `src/routes/`
**Role:** ingress, state routes, and delivery/query-facing runtime surface.

This layer owns:
- route registration
- task dispatch entrypoints
- health/state endpoints
- query/read-model surfaces
- runtime control routes

This is the HTTP/control-facing surface of the Team Runtime.

---

## 4.6 `src/integrations/`
**Role:** optional integrations only.

This tree may contain:
- OpenClaw-specific wiring
- channel-specific compatibility layers
- host-specific control-plane mappings

It must not redefine the primary repository mental model.

---

## 4.7 `dashboard/src/`
**Role:** primary application UI.

This layer owns:
- task/workbench presentation
- node and runtime visibility
- timeline/artifact presentation
- chat and operator interaction

It should align to public-neutral schemas and read models, not private host fields.

---

## 4.8 `examples/`
**Role:** public runnable/forkable examples.

- `examples/oss-minimal/` = runnable standalone sample and regression facade
- `examples/third-party-agent-sample/` = minimal external onboarding template
- `examples/team-runtime-public/` = public-facing Team Runtime example track

Examples exist to help people run or fork the system.
They are not the primary definition authority for the product.

---

## 5. Documentation Layering

### Current authority docs
- `README.md`
- `GETTING-STARTED.md`
- `ARCHITECTURE.md`
- `docs/architecture/`
- `docs/api/`
- `docs/index.md`

### Maintainer / operational docs
- `docs/architecture/maintainer-private-ops-boundary.md`
- `docs/ops/README.md`
- `docs/ops/`
- `docs/changelog/`
- selected deployment and investigation notes

### Historical docs
- `docs/archive/`

Rule:
- current truth lives in `README.md`, `GETTING-STARTED.md`, `ARCHITECTURE.md`, and `docs/architecture/`
- maintainer/private operational context should not become the public mental model
- historical context belongs in archive only

---

## 6. Script Layering

### Public mainline validation
- `scripts/smoke/`
- public-safe parts of `scripts/team/`

### Higher-cost or live validation
- `scripts/acceptance/`

### Maintainer / investigation utilities
- `scripts/ops/`
- `scripts/index-surface/`

Recommended mental model:
- `scripts/smoke/*` = default public-safe regression gate
- `scripts/team/*` = product/baseline-specific guards
- `scripts/acceptance/*` = higher-cost or live validation
- `scripts/ops/*` = maintainer/investigation utilities

---

## 7. Canonical Mental Model

### Primary product path

```text
Ingress / routes
  -> Team Runtime
  -> TL orchestration
  -> runtimeAdapter + executionAdapter
  -> member execution
  -> artifacts / evidence / memory / review loop
  -> dashboard / state surface / response
```

### Reusable substrate path

```text
Harness Core contracts
  -> standalone runtime
  -> broker / worker / scheduler / state
  -> shell / doctor / activation / recovery
  -> independent agent package onboarding
```

### Optional integration path

```text
OpenClaw / channel / host-specific integration
  -> adapter / normalization layer
  -> Team Runtime or Harness Core
```

Optional integrations may connect to the product, but they are not the product definition.

---

## 8. P0 Boundary Rule

Any new document, script, route, or directory should now be easy to classify as one of:
- primary product
- reusable substrate
- optional integration
- maintainer/private ops
- archive

If it is not clear which one it belongs to, it does not belong in the primary public story by default.
