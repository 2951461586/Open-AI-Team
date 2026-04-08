# Product Surface and Repo Map

> P0 authority document for answering **what this repository is**, **which surfaces are public-safe**, and **which repo shape we are converging toward**.

---

## 1. Final Product Framing

AI Team Harness is now understood as **one open-source product family with four clearly separated surfaces**:

### A. AI Team Runtime — primary product
A team-oriented multi-agent runtime for planning, delegation, review, recovery, and evidence-driven delivery.

Primary code surface:
- `src/team/`
- `src/team-core/`
- `src/team-runtime-adapters/`
- `src/routes/`

### B. Dashboard — primary application UI
The dashboard/workbench is the main frontend product surface for task flow, runtime visibility, timeline, artifacts, and collaboration.

Primary code surface:
- `dashboard/src/`

### C. Harness Core + Agent Package SDK — reusable substrate
The reusable execution substrate and independent-agent onboarding contract set.

Primary code surface:
- `src/agent-harness-core/`
- `schemas/`
- `examples/oss-minimal/`
- `examples/third-party-agent-sample/`

### D. Optional Integrations — non-primary, non-required
Host/provider/channel-specific integration surfaces.

Examples:
- `src/integrations/openclaw/`
- QQ / webhook / NapCat compatibility surfaces
- maintainer-host deployment and live acceptance wiring
- plugin ecosystems under `plugins/`
- optional/companion service surfaces under `services/`
- secondary desktop shell work under `electron/`

Rule:
- **A / B / C are the public product family**.
- **D is optional integration surface, not part of the minimum product story**.
- Related/experimental side projects under `projects/` and low-authority shared/output areas under `shared/` are outside the default first-read product story.

---

## 2. Canonical Reading Order

If someone new opens the repository, they should understand it in this order:

1. `README.md`
2. `GETTING-STARTED.md`
3. `ARCHITECTURE.md`
4. `docs/architecture/product-surface-and-repo-map.md`
5. `docs/architecture/release-surface-allowlist.md`
6. `docs/architecture/current-team-runtime-architecture.md`
7. `docs/architecture/independent-agent-onboarding.md`
8. `docs/architecture/standalone-harness-baseline-release.md`

If any archived/investigation doc disagrees with this file, prefer this file.

---

## 3. Current Repo Shape vs Target Repo Shape

## 3.1 Current repo shape

```text
README.md
GETTING-STARTED.md
ARCHITECTURE.md
docs/
config/
src/
dashboard/
examples/
schemas/
fixtures/
scripts/
```

This shape is still acceptable during transition, but the repository must now be mentally understood through the four product surfaces above, not through historical host/integration baggage.

## 3.2 Target repo shape (locked direction)

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

Interpretation:
- `packages/harness-core` = reusable execution substrate
- `packages/team-runtime` = main orchestration product
- `packages/agent-package-sdk` = onboarding/tooling/contracts for third-party agents
- `packages/integration-*` = optional integration packages only
- `apps/dashboard` = UI application
- `examples/*` = runnable and forkable public examples
- `archive/` = historical material kept out of the main product story

This target shape is the **north star** for future repository restructuring.

---

## 4. Product Boundary Rules

### Public product authority
Belongs to the main product story:
- Team Runtime
- Dashboard
- Harness Core
- Agent Package SDK
- Public schemas
- Runnable public examples

### Optional integration authority
May remain in-tree during transition, but is not required for understanding or running the public product:
- OpenClaw integration
- channel-specific ingress adapters
- QQ/NapCat compatibility fixtures
- maintainer-host control-plane wiring

### Historical authority
Not part of the mainline product story:
- archived docs
- retired compat explanations
- live production incident notes
- private deployment specifics

### Secondary / background / sample authority
Allowed in-tree, but not part of the default first-read product authority:
- `config/examples/` as public-safe example configuration
- `config/team/` as maintainer-facing active runtime inventory
- `fixtures/` as public-safe sample/validation material
- `references/` as comparison/background context
- `memory/` as continuity and derived maintainer context

---

## 5. Release Narrative Rule

All release-facing docs should now reinforce one compact narrative:

```text
Primary product = AI Team Runtime + Dashboard
Reusable substrate = Harness Core + Agent Package SDK
Optional integrations = OpenClaw / QQ / maintainer-host wiring
Historical material = archive only
```

Anything that makes the repository feel OpenClaw-first, QQ-first, gateway-first, or maintainer-host-first is now considered off-mainline narrative.

---

## 6. P0 Exit Criteria

P0 is considered complete when:
- product family boundaries are explicit
- public-vs-optional-vs-historical separation is documented
- main entry docs point to the same story
- target repo shape is fixed as a roadmap authority
- release-facing reading order is stable

---

<!-- P0 authority doc -->
