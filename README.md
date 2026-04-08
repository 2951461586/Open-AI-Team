# AI Team Runtime

[English](./README.md) | [简体中文](./README.zh-CN.md)

An open-source **team-oriented multi-agent runtime** for planning, delegation, review, and evidence-driven delivery.

It is designed for people building systems that need more than chat:
- a **TL-first execution model** instead of ad-hoc agent calls
- **delegation and review loops** across planner / executor / critic / judge roles
- **artifacts, evidence, and acceptance traces** as first-class outputs
- a **dashboard/workbench** to observe tasks, timelines, and runtime state
- a reusable **agent harness** for onboarding independent or third-party agents

---

## What this repository is

This repository is one open-source product family with four clear surfaces:

1. **AI Team Runtime** — the main orchestration/runtime product
2. **Dashboard** — the operational UI and workbench
3. **Agent Harness** — a forkable execution substrate for independent agents
4. **Optional Integrations** — OpenClaw / channel / host-specific adapters

If you are new here, the main story is:

> **AI Team Runtime + Dashboard** are the primary product.
> **`packages/agent-harness`** is the reusable execution substrate.
> Optional integrations are intentionally secondary.

---

## Core capabilities

### TL-first execution
All major requests enter a TL (Team Leader) runtime first. TL decides whether to:
- answer directly
- confirm task creation
- partially delegate
- fully delegate
- continue an active task/follow-up path

### Team-style delegation
The runtime supports planner / executor / critic / judge style collaboration, with explicit task decomposition and controlled follow-up.

### Evidence-driven delivery
Outputs are not just text. The runtime is built around:
- artifacts
- evidence
- deliverables
- review/judge signals
- acceptance closure

### Dashboard and workbench visibility
The dashboard is not just a chat window. It is the observation surface for:
- task timelines
- runtime status
- task/workbench progress
- artifacts and evidence
- operator follow-up

### Independent-agent onboarding
Third-party agents do not need to understand OpenClaw internals. They can integrate through explicit contracts:
- manifest
- package
- provider registry
- shell / doctor / activation checklist
- session / desk / bridge / lifecycle contracts

---

## Quick start

Choose one path.

### A. See the main product

```bash
npm install
cp .env.example .env
npm run smoke:team
npm start
```

Then open the dashboard/API entry described in `GETTING-STARTED.md`.

### B. Explore the forkable agent harness

```bash
npm install
npm run demo:oss-minimal
npm run doctor:oss-minimal
```

Then read:
- `packages/agent-harness/README.md`
- `examples/oss-minimal/README.md`

### C. Explore third-party agent onboarding

```bash
npm install
npm run validate:third-party-agent
npm run smoke:third-party-agent
node examples/third-party-agent-sample/agent-shell.mjs onboarding
```

Then read:
- `examples/third-party-agent-sample/README.md`
- `docs/architecture/independent-agent-onboarding.md`

---

## Product surfaces

### 1) AI Team Runtime
Primary runtime/orchestration product for planning, delegation, review, and delivery closure.

Key surfaces:
- `packages/team-runtime/`
- `src/team/`
- `src/team-runtime-adapters/`
- `src/routes/`
- `apps/api-server/`

### 2) Dashboard
Primary UI for runtime visibility, task/workbench flow, and operator interaction.

Key surfaces:
- `dashboard/` — current UI authority
- `apps/dashboard/` — app packaging / transition surface, not the primary UI authority

### 3) Agent Harness
Reusable, forkable harness substrate for independent agents.

Key surfaces:
- `packages/agent-harness/`
- `examples/oss-minimal/`
- `examples/third-party-agent-sample/`
- `schemas/`

### 4) Optional Integrations
Non-primary surfaces such as:
- `src/integrations/openclaw/`
- channel adapters
- host/runtime-specific wiring
- optional plugin ecosystems under `plugins/`
- secondary/companion service surfaces under `services/`

These are useful, but they are **not** the default product story.
Related/experimental side projects under `projects/`, the secondary desktop shell under `electron/`, and low-authority shared/output areas under `shared/` are also outside the default first-read path.

---

## Reading order

If you want the shortest correct path through the repo, read in this order:

1. `README.md`
2. `GETTING-STARTED.md`
3. `ARCHITECTURE.md`
4. `dashboard/README.md`
5. `docs/architecture/product-surface-and-repo-map.md`
6. `docs/oss/repo-authority.md`
7. `docs/oss/what-is-ai-team-runtime.md`
8. `docs/architecture/current-team-runtime-architecture.md`
9. `docs/architecture/independent-agent-onboarding.md`
10. `docs/architecture/release-engineering-and-ci.md`
11. `docs/oss/dashboard-observability-surface.md`
12. `docs/oss/dashboard-observability-checklist.md`
13. `docs/oss/open-source-release-engineering.md`

---

## Repository map

```text
packages/
  agent-harness/     reusable execution substrate
  team-runtime/      packaged team runtime surface
  team-core/         platform-neutral team contracts/domain
  tools/             public tool/provider surface
apps/
  api-server/        current app/server authority surface
  dashboard/         app packaging surface
src/
  team/              mixed runtime surface: packaged shims + remaining local areas
  team-runtime-adapters/
  integrations/
dashboard/           current primary dashboard product UI
examples/
  oss-minimal/       runnable minimal harness baseline
  third-party-agent-sample/
schemas/             public contracts
plugins/             optional plugin ecosystem, not mainline core
services/            optional/companion services, not mainline core
electron/            secondary desktop shell
projects/            related or experimental side projects
shared/              low-authority shared/output area
```

---

## Why this repo is different

Compared with chat-first agent repos, this project is centered on **execution structure**:
- TL-first routing
- delegation and review
- evidence and acceptance
- dashboard/workbench observability
- host-neutral onboarding contracts for independent agents

Compared with host-bound private runtimes, this repo is converging toward a cleaner open-source shape where:
- the runtime is productized
- the harness is forkable
- integrations are optional
- release boundaries are explicit

## Open-source repository rules

Use these as the default authority assumptions:
- `dashboard/` is the current dashboard UI authority
- `apps/dashboard/` is a secondary app-packaging surface
- `packages/agent-harness/` is the execution substrate authority
- `packages/team-runtime/` is the packaged team-runtime authority
- `apps/api-server/` is the server entry authority
- `src/` contains compatibility shims plus still-local runtime areas that have not been moved behind package/app boundaries
- `plugins/`, `services/`, `electron/`, `projects/`, and `shared/` are secondary/optional/non-mainline surfaces unless explicitly documented otherwise

If you are contributing, land new logic in the owning package/app whenever that authority already exists.

---

## Security and deployment note

This repository contains optional integration and host-oriented surfaces, but the mainline open-source story is:
- host-neutral runtime contracts first
- public-safe schemas and examples first
- optional integrations second

For release, publishing, and public-safe boundaries, see:
- `docs/architecture/release-surface-allowlist.md`
- `docs/oss/open-source-release-engineering.md`

---

## License

MIT
