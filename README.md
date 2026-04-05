# AI Team Harness

> An open-source multi-agent product family: **AI Team Runtime + Dashboard** as the primary product, with a reusable **Harness Core + Agent Package SDK** beneath it.

---

## What It Is

AI Team Harness is now defined through **four explicit surfaces**:

### 1) AI Team Runtime — primary product
A DeerFlow-style team workflow runtime for planning, delegation, review, recovery, and evidence-driven delivery.

### 2) Dashboard — primary application UI
The workbench / cockpit for task flow, runtime visibility, timelines, artifacts, and collaborative interaction.

### 3) Harness Core + Agent Package SDK — reusable substrate
A host-neutral execution substrate plus explicit onboarding contracts for independent agents.

### 4) Optional Integrations — non-primary surface
Host-, channel-, or deployment-specific integrations such as OpenClaw wiring or legacy compatibility ingress.

It provides:

- **Planning and review loops** — structured plan → execute → review → decide
- **Crash recovery and resume** — persistent run state and restart-safe continuation
- **Evidence-driven delivery** — artifacts, run reports, retrieval, blackboard, durable memory
- **Plugin and bridge contracts** — extensible capabilities, routing, desk/inbox/outbox surfaces
- **Broker-based execution** — distributed scheduling, placement, worker orchestration
- **Shell and doctor surfaces** — onboarding validation, activation checklist, observable runtime state

## What It Is Not

- Not tied to any single assistant host, gateway, or messaging stack
- Not an OpenClaw-only product
- Not a QQ-first or webhook-first system narrative
- Not a wrapper around one LLM API

---

## Product Family at a Glance

### Primary product
- **AI Team Runtime** — team orchestration and evidence-driven delivery
- `team-tl-runtime.mjs`：**当前唯一对话 authority ＋ 任务编排主运行时**
- **Dashboard** — task/workbench/control visualization UI

### Reusable substrate
- **Harness Core** — runtime contracts, worker/broker/session/bridge/shell substrate
- **Agent Package SDK** — independent agent onboarding contracts and examples

### Optional integrations
- OpenClaw integration
- channel/webhook compatibility layers
- maintainer-host deployment wiring

These optional integrations may remain in-tree during transition, but they are not required to understand or run the public product story.

Maintainer/private operational material may also remain in-tree during transition, but it should be treated as **secondary maintainer context**, not as default contributor onboarding. See `docs/architecture/maintainer-private-ops-boundary.md`.

---

## Repository Shape

Today the repository is still transitioning, but the product boundary is now fixed:

- **Primary product** = AI Team Runtime + Dashboard
- **Reusable substrate** = Harness Core + Agent Package SDK
- **Optional integrations** = OpenClaw / QQ / maintainer-host wiring
- **Historical material** = archive only

If you are new to the project, start with:

- `GETTING-STARTED.md`
- `README.md`
- `ARCHITECTURE.md`
- `docs/architecture/product-surface-and-repo-map.md`
- `docs/architecture/release-surface-allowlist.md`
- `dashboard/README.md`
- `src/agent-harness-core/README.md`
- `docs/architecture/independent-agent-onboarding.md`

The long-term repo shape this project is converging toward is:

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

This target shape is the north star for future cleanup and extraction work.

---

## Current Top-Level Layout

This is the current repository layout, interpreted through the fixed product boundaries above:

```text
src/
  agent-harness-core/     reusable execution substrate and contracts
  team-core/              platform-neutral team contracts and semantics
  team/                   active team runtime logic
  team-runtime-adapters/  runtime/control-plane adapter layer
  routes/                 ingress and state/query routes
  integrations/           optional host/channel integrations

dashboard/
  src/                    primary application UI

config/
  team/                   active team runtime config authority
  examples/               public-safe example configs

examples/
  oss-minimal/            runnable standalone sample
  third-party-agent-sample/ minimal external onboarding template
  team-runtime-public/    public-facing team runtime example track

docs/
  architecture/           current architecture and release docs
  api/                    API docs
  ops/                    maintainer/operational notes
  archive/                historical material only

scripts/
  smoke/                  default public-safe regression gate
  team/                   product/baseline-specific guards
  acceptance/             higher-cost or live validation
  ops/                    maintainer/investigation utilities
```

---

## Quick Start

```bash
npm install
cp .env.example .env
# edit .env with your local credentials/config
npm run smoke:oss-minimal
```

Or run the standalone example directly:

```bash
node examples/oss-minimal/standalone-bootstrap.mjs
```

Typical outputs:

- `workspace/artifacts/` — deliverables such as `PLAN.md`, `DELIVERABLE.md`, `REVIEW.md`, `DECISION.md`
- `run-report.json` — execution evidence
- `workspace/memory/` — blackboard and durable memory snapshots

---

## Core Concepts

### Roles
- **Planner** — decomposes objectives into structured plans
- **Executor** — produces deliverables using tools and workspace
- **Critic** — reviews output and can request replan
- **Judge** — makes the final approve / revise / escalate decision

### Evidence
Each run can produce:
- artifacts
- blackboard updates
- durable memory entries
- run reports
- broker / worker traces

### Recovery
Runs are designed to survive restarts through persisted state, resumable run directories, and task/session continuity.

---

## Smoke and Validation

```bash
npm run smoke:team
npm run smoke:team:batch
npm run smoke:oss-minimal
npm run demo:oss-minimal
npm run status:oss-minimal
npm run doctor:oss-minimal
npm run validate:agent-package
```

---

## Configuration

| File | Purpose |
|---|---|
| `.env` | local runtime configuration |
| `config/team/roles.json` | role contracts, defaults, deployment hints |
| `config/team/governance.json` | governance and review rules |
| `config/team/network-ports.json` | maintainer-oriented active multi-node wiring inventory |
| `config/examples/*.json` | host-neutral public example configs |

---

## Extending

### Independent Agent Onboarding
Third-party agents can integrate through explicit contracts instead of host-private session semantics.

See:
- `docs/architecture/independent-agent-onboarding.md`
- `src/agent-harness-core/oss-agent-manifest.json`
- `src/agent-harness-core/oss-agent-package.json`

### Plugins / Bridge / Desk
The harness exposes explicit plugin, bridge, session, desk, host-layer, and shell surfaces for integration.

---

## Documentation

- [Getting Started](GETTING-STARTED.md)
- [Architecture Overview](ARCHITECTURE.md)
- [Product Surface and Repo Map](docs/architecture/product-surface-and-repo-map.md)
- [Release Surface Allowlist](docs/architecture/release-surface-allowlist.md)
- [Dashboard Frontend](dashboard/README.md)
- [Independent Agent Onboarding](docs/architecture/independent-agent-onboarding.md)
- [Session Capability & Follow-up](docs/architecture/session-capability-and-followup-fallback.md)
- [Standalone Harness Baseline](docs/architecture/standalone-harness-baseline-release.md)
- [Release Preflight Inventory](docs/architecture/release-preflight-retirement-inventory.md)
- [Public Contract Schemas](docs/architecture/public-contract-schemas.md)
- [GitHub Open-Source Preflight](docs/architecture/github-open-source-preflight.md)
- [Release Engineering and CI](docs/architecture/release-engineering-and-ci.md)
- [Dashboard / UI Surface](dashboard/README.md)
- [Release Artifacts and Publishing](docs/architecture/release-artifacts-and-publishing.md)
- [Release Notes / Provenance / Version Story](docs/architecture/release-notes-provenance-and-version-story.md)
- [Team Ingress API](docs/api/team-ingress/README.md)

---

## Status

Pre-release, but already validated through smoke suites, authority checks, and runnable standalone samples.

### Stable
- plan → execute → review → decide pipeline
- broker-based standalone substrate
- recovery and resume
- artifacts / evidence / blackboard flow
- explicit session / desk / bridge / shell contract surfaces

### In Progress
- public schema publication
- CI for external contributors
- more third-party onboarding samples
- further neutralization of legacy compat fixtures
- repo restructuring toward the target public package/app shape

---

## License

MIT

---

## Legacy Note

This project evolved from a host-bound multi-agent orchestration system. Historical and compatibility material remains under `docs/archive/`, but is not part of the primary product surface.
