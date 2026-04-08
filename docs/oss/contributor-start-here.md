# Contributor Start Here

If you want the shortest correct path into this repo, use this page.

---

## 1. Read in this order

1. `README.md`
2. `GETTING-STARTED.md`
3. `ARCHITECTURE.md`
4. `docs/oss/repo-authority.md`
5. `docs/architecture/product-surface-and-repo-map.md`

That will tell you what the project is, how to run it, and where the real implementation authority lives.

---

## 2. Where to add code

### Add team orchestration/runtime logic
Use:
- `packages/team-runtime/`

Typical examples:
- TL-first orchestration
- delegation/review/judge flow
- delivery closure
- task/workbench runtime semantics

### Add harness/execution-substrate logic
Use:
- `packages/agent-harness/`

Typical examples:
- model/tool runtime flow
- execution envelopes
- remote broker / worker / scheduler behavior
- standalone harness runtime
- public agent onboarding helpers

### Add platform-neutral contracts/domain logic
Use:
- `packages/team-core/`

Typical examples:
- work items
- decision/query contracts
- role capability contracts
- shared dashboard read-model helpers

### Add public tool/provider logic
Use:
- `packages/tools/`

### Add dashboard product code
Use:
- `dashboard/`

This is the current primary dashboard authority.
`apps/dashboard/` is not the primary UI authority today.

---

## 3. What not to treat as primary authority

Do **not** start by extending these as if they were the main product path:
- `apps/dashboard/` as primary dashboard implementation
- `src/agent-harness-core/` for covered harness logic
- `src/team-core/` for covered core logic
- covered shim surfaces inside `src/team/` / `src/team/tl-runtime/`
- `plugins/`, `services/`, `projects/`, `electron/`, `shared/` as default product story

Those areas may still exist for transition, compatibility, or optional integration reasons.

---

## 4. Where to put docs

### Durable open-source guidance
Use:
- `docs/oss/`

### Architecture/design docs
Use:
- `docs/architecture/`

### Historical material
Use:
- `docs/archive/`

### Do not rely on `reports/`
`reports/` should be treated as generated/local unless something is explicitly promoted into docs.

---

## 5. Minimum validation before opening a PR

Run the checks relevant to your surface.

### General OSS baseline
- `npm run smoke:team`
- `npm run smoke:oss-minimal`
- `npm run validate:agent-package`

### Release/story changes
- `npm run smoke:release-engineering`
- `npm run audit:repo-boundary`

### Repo hygiene changes
- `npm run audit:repo-hygiene`

---

## 6. Mental model

The intended repo story is:

- **AI Team Runtime** = main product
- **Dashboard** = operator/workbench surface
- **Agent Harness** = reusable standalone execution substrate
- **Optional integrations** = secondary wiring, not the main story

If your change makes the repo feel more host-specific, more legacy-path-first, or more transition-surface-first, it is probably moving in the wrong direction.
