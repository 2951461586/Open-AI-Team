# Getting Started

> External entrypoint for contributors evaluating AI Team Harness.

This repository now has **four explicit surfaces**:
- **AI Team Runtime** — primary product
- **Dashboard** — primary application UI
- **Harness Core + Agent Package SDK** — reusable substrate
- **Optional Integrations** — non-primary, non-required surface

If you only read one story first, read the **AI Team Runtime + Dashboard** story.

---

## 1. Start Here First

Read in this order:
1. `README.md`
2. `ARCHITECTURE.md`
3. `docs/architecture/product-surface-and-repo-map.md`
4. `docs/architecture/release-surface-allowlist.md`

Then choose one of the paths below.

---

## 2. Choose Your Path

### A) AI Team Runtime — primary product surface
Use this path if you want the DeerFlow-style team workflow product.

Key surfaces:
- `src/team/`
- `src/team-core/`
- `src/team-runtime-adapters/`
- `src/routes/`

Start here:
```bash
npm install
cp .env.example .env
npm run smoke:team
node scripts/team/team-query-route-catalog-example.mjs
```

Then read:
- `docs/architecture/current-team-runtime-architecture.md`
- `docs/api/team-governance-query-api/README.md`
- `dashboard/README.md`

---

### B) Dashboard — primary application UI
Use this path if you care about the frontend-facing workbench, task cockpit, runtime visibility, and schema/read-model alignment.

Key surfaces:
- `dashboard/src/app/page.tsx`
- `dashboard/src/lib/types.ts`
- `dashboard/src/lib/api.ts`
- `dashboard/src/components/`
- `/state/team/dashboard`
- `/state/team/workbench`
- `/state/team/residents`
- `/state/team/control`

Validation:
```bash
node scripts/team/team-uat-observability-neutralization-smoke.mjs
npm run dashboard:build
```

---

### C) Harness Core + Agent Package SDK — reusable substrate
Use this path if you want the OpenHanako-style independent-agent substrate and onboarding contract set.

Key surfaces:
- `src/agent-harness-core/`
- `schemas/`
- `examples/oss-minimal/`
- `examples/third-party-agent-sample/`

Start here:
```bash
npm run demo:oss-minimal
npm run status:oss-minimal
npm run doctor:oss-minimal
npm run validate:agent-package
npm run validate:third-party-agent
npm run smoke:third-party-agent
```

Then read:
- `src/agent-harness-core/README.md`
- `docs/architecture/independent-agent-onboarding.md`
- `docs/architecture/standalone-harness-baseline-release.md`
- `docs/architecture/standalone-run-layout-authority.md`

---

### D) Optional Integrations — non-primary surface
Use this path only if you are intentionally working on host/channel-specific integration layers.

Examples:
- `src/integrations/openclaw/`
- compatibility ingress routes
- maintainer-host deployment/runtime wiring

Rule:
- useful for integration work
- not required to understand the public product story
- should not be treated as the default starting point

### E) Maintainer / private ops — secondary surface
Use this only if you are maintaining a live deployment, auditing a current environment, or reading rollout/investigation notes.

Examples:
- `docs/ops/README.md`
- `scripts/ops/README.md`
- `config/team/README.md`
- `docs/architecture/maintainer-private-ops-boundary.md`

Rule:
- useful for maintainers
- not part of the default public onboarding path
- not a substitute for public examples under `config/examples/`

---

## 3. Repository Map

```text
README.md                product overview and boundary definition
ARCHITECTURE.md          repository layering authority
GETTING-STARTED.md       contributor entrypoint
config/team/             active team runtime config authority
config/examples/         public-safe example config
src/team*/               primary runtime and neutral semantics
src/agent-harness-core/  reusable execution substrate
src/integrations/        optional integrations only
dashboard/src/           primary application UI
examples/                runnable and forkable public examples
schemas/                 public machine-readable contracts
fixtures/                canonical, derived, and public samples
scripts/                 validation, smoke, acceptance, ops
```

---

## 4. Which Surfaces Are Primary?

- **Primary product:** AI Team Runtime + Dashboard
- **Reusable substrate:** Harness Core + Agent Package SDK
- **Optional surface:** host/channel/deployment integrations
- **Historical surface:** archive only

If you are unsure where to start, start with the primary product, not the integrations.

---

## 5. Public Example Tracks

- `examples/README.md` — examples index
- `examples/team-runtime-public/` — Team Runtime public-facing track
- `examples/oss-minimal/` — runnable standalone sample
- `examples/third-party-agent-sample/` — external onboarding template
- `config/examples/` — public-safe example configuration

---

## 6. Validation Shortlist

```bash
npm run smoke:team
npm run smoke:team:batch
npm run smoke:oss-minimal
npm run smoke:public-schemas
node scripts/team/team-uat-observability-neutralization-smoke.mjs
```

---

## 7. Public Contract / Sample Shortcuts

```bash
node scripts/team/team-query-route-catalog-example.mjs
npm run fixtures:real-run-published
npm run fixtures:real-run-provenance
```
