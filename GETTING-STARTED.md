# Getting Started

This repository supports three main entry paths. Pick one based on what you want to understand.

---

## Path A — Run the main product

Use this path if you want to understand **AI Team Runtime + Dashboard**.

```bash
npm install
cp .env.example .env
npm run smoke:team
npm run dashboard:build
npm start
```

Then open the runtime/dashboard entry your local setup exposes.
If you are validating the repo-local dashboard surface explicitly, also read `dashboard/README.md` and use `npm run dashboard:build` as the dashboard build authority.

What you are looking at:
- a TL-first team runtime
- task/workbench execution flow
- artifacts/evidence/review-oriented delivery
- dashboard/operator visibility

Read next:
1. `ARCHITECTURE.md`
2. `docs/oss/what-is-ai-team-runtime.md`
3. `docs/architecture/current-team-runtime-architecture.md`

---

## Path B — Run the forkable agent harness baseline

Use this path if you want the **independent execution substrate**.

```bash
npm install
npm run demo:oss-minimal
npm run status:oss-minimal
npm run doctor:oss-minimal
```

What you are looking at:
- standalone harness lifecycle
- shell / doctor / activation shape
- provider registry and runtime wiring
- role-based execution and resume path

Read next:
1. `packages/agent-harness/README.md`
2. `examples/oss-minimal/README.md`
3. `docs/architecture/independent-agent-onboarding.md`

---

## Path C — Explore third-party agent onboarding

Use this path if you want to see how an external agent integrates without depending on OpenClaw internals.

```bash
npm install
npm run validate:third-party-agent
npm run smoke:third-party-agent
node examples/third-party-agent-sample/agent-shell.mjs package
node examples/third-party-agent-sample/agent-shell.mjs onboarding
```

What you are looking at:
- explicit manifest/package contracts
- session / desk / bridge / lifecycle / shell surfaces
- onboarding and doctor entrypoints
- a host-neutral third-party agent template

Read next:
1. `examples/third-party-agent-sample/README.md`
2. `docs/architecture/independent-agent-onboarding.md`
3. `docs/oss/dashboard-observability-surface.md`
4. `docs/oss/open-source-release-engineering.md`

---

## Repository mental model

Do **not** try to understand the repo through historical migration layers first.
Use this product-first model instead:

### Primary product surfaces
- **AI Team Runtime**
- **Dashboard**
- **Agent Harness**

### Secondary / non-mainline surfaces
- **Optional Integrations**
- **Plugins** (`plugins/`) — optional ecosystem, not core onboarding
- **Services** (`services/`) — optional/companion services, not core onboarding
- **Electron** (`electron/`) — secondary desktop shell
- **Projects** (`projects/`) — related/experimental side projects
- **Shared** (`shared/`) — low-authority shared/output area

### Current authority summary
- `packages/agent-harness/` = canonical harness substrate
- `packages/team-runtime/` = canonical packaged team-runtime export surface
- `apps/api-server/` = current app/server authority for server entry and route surface
- `src/team/` = compatibility shims + still-local runtime areas not yet moved behind package/app authority
- `dashboard/` = current primary dashboard UI authority
- `plugins/`, `services/`, `electron/`, `projects/`, and `shared/` = secondary/optional/non-mainline surfaces unless explicitly documented otherwise

For deeper authority detail, read:
- `docs/oss/repo-authority.md`
- `docs/oss/dashboard-authority-and-transition.md`
- `docs/architecture/product-surface-and-repo-map.md`

---

## What to read if you only have 15 minutes

1. `README.md`
2. `ARCHITECTURE.md`
3. `docs/oss/what-is-ai-team-runtime.md`
4. `packages/agent-harness/README.md`
5. `packages/team-runtime/README.md`

---

## Troubleshooting

### `npm run smoke:team` fails
Check Node.js version. This repo expects Node 22+.

### `npm start` runs but the UI is unclear
Read:
- `docs/oss/what-is-ai-team-runtime.md`
- `docs/architecture/current-team-runtime-architecture.md`

### You only care about the harness, not the whole runtime
Skip directly to:
- `packages/agent-harness/README.md`
- `examples/oss-minimal/README.md`

### You only care about third-party agent onboarding
Skip directly to:
- `examples/third-party-agent-sample/README.md`
- `docs/architecture/independent-agent-onboarding.md`

---

## Contribution guardrails

- Put new harness logic in `packages/agent-harness/`, not legacy compatibility paths
- Put new packaged runtime logic in `packages/team-runtime/` when the surface is already package-owned
- Do not expand optional integrations into the default product story
- Keep public docs host-neutral and public-safe by default
- Update docs together with authority changes
