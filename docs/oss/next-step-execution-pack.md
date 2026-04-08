# Next-Step Execution Pack

Status: post-P4
Scope: package the completed P0-P4 work into commit-ready slices, release-facing summaries, and cleanup backlog.

---

## 1. What is complete now

The repository has already completed the major P0-P4 open-source hardening arc:

- P0: authority map / repo story / dashboard authority / docs convergence
- P1: harness execution chain / evidence / tool audit / tracing envelope
- P2: dashboard public read-model convergence / stable-first contract consumption
- P3: independent-agent onboarding productization / third-party sample / OSS minimal baseline
- P4: release engineering story / runnable demo credibility / public release gates

Validated gates already green:

- `npm run smoke:oss-minimal`
- `npm run smoke:release-engineering`
- `npm run validate:agent-package`
- `npm run audit:repo-boundary`
- `npm run audit:repo-hygiene`

---

## 2. Recommended immediate next step

The best next step is **not** another broad refactor.
It is to turn the completed work into:

1. commit-ready slices
2. release-facing change notes
3. a focused cleanup backlog for retired/runtime surfaces

This reduces rework and makes GitHub publishing much safer.

---

## 3. Commit split recommendation

### Commit A — docs / authority / release story

Purpose:
- lock the public narrative
- freeze product reading order
- freeze dashboard authority and repo authority wording

Primary surfaces:
- `README.md`
- `GETTING-STARTED.md`
- `ARCHITECTURE.md`
- `docs/oss/*`
- `docs/architecture/*`
- package READMEs / example READMEs
- release engineering docs

Suggested message:
- `docs(oss): converge authority map and release story`

---

### Commit B — harness execution substrate and standalone baseline

Purpose:
- land the DeerFlow-style strong execution substrate improvements
- freeze standalone harness baseline as a credible OSS product

Primary surfaces:
- `packages/agent-harness/src/*`
- `src/agent-harness-core/*` shims
- `examples/oss-minimal/*`
- `examples/third-party-agent-sample/*`
- related harness smoke / validate scripts

Key items:
- execution envelope
- model-router / tool-runtime evidence
- remote broker / scheduler / worker chain
- standalone-product-runtime fixes
- agent package / manifest productization

Suggested message:
- `feat(agent-harness): productize standalone execution substrate`

---

### Commit C — team runtime + dashboard public contract convergence

Purpose:
- lock AI Team Runtime as TL-first orchestration product
- align dashboard against stable-first public read models

Primary surfaces:
- `packages/team-runtime/src/*`
- `packages/team-core/src/*`
- `dashboard/src/*`
- dashboard config updates
- public contract smoke scripts

Key items:
- TL/member evidence write path
- stable-first read-model helper
- dashboard payload compatibility cleanup
- shared read-model normalization

Suggested message:
- `feat(team-runtime): align evidence flow and dashboard public contracts`

---

### Commit D — repo hygiene / retirement / guardrails

Purpose:
- make the repo safer for public push
- remove retired/generated/high-noise surfaces from tracked scope

Primary surfaces:
- `.gitignore`
- `.dockerignore`
- repo hygiene / boundary scripts
- removal of `.tmp*` / runtime residue / stale sample registry content
- reports that should remain as release/internal evidence

Suggested message:
- `chore(repo): tighten repo hygiene and retire generated surfaces`

Note:
- if some `reports/` are meant to stay in-repo as OSS planning artifacts, keep only the ones that help external contributors.
- if a report is purely maintainer-operational, move it to archive or stop tracking it.

---

## 4. Cleanup backlog (high priority)

These are the biggest remaining cleanup surfaces visible from repo status and hygiene audit.

### A. Runtime/generated directories

Priority: highest

Current audit shows runtime/generated/high-noise paths such as:
- `node_modules/`
- `dashboard/node_modules/`
- `apps/*/node_modules/`
- `artifacts/`
- `data/`
- `logs/`
- various `.tmp*` directories
- runtime output under run-like/report-like surfaces

Actions:
- ensure all generated/runtime paths are ignored
- remove already-tracked generated residues from git
- document which report directories are source vs runtime

---

### B. `.tmp-skill-registry*` and `.tmp/bridge-state.json`

Priority: highest

These are classic retired/runtime residues and should not remain as public-repo noise.

Actions:
- keep deleted from repo
- ensure ignore rules permanently block re-entry
- if needed, mention them in a short retirement note instead of keeping files

---

### C. `reports/` classification

Priority: high

`reports/` currently mixes useful OSS planning evidence with repo-noise risk.

Recommended split:
- keep: reports that explain repo authority, retirement strategy, or OSS migration state
- archive/remove: one-off maintainer execution notes that do not help external readers

Suggested keep candidates:
- `reports/open-source-remediation-progress.md`
- possibly one retirement inventory summary
- possibly one repo hygiene summary if it is curated

Suggested archive/remove candidates:
- repetitive one-off execution batch notes unless referenced by docs

---

### D. `src/` vs `packages/*` residual duplication

Priority: high

P0-P4 already clarified authority, but status still shows a large amount of mirrored surface churn.

Next cleanup action should be:
- audit only the still-user-facing duplicated seams
- do not broad-refactor again immediately
- add thin comments/readmes where needed to state shim-only intent

Goal:
- make it obvious to external contributors where new code belongs

---

### E. `apps/api-server/` new untracked tree

Priority: medium-high

Untracked app-side route/runtime files are visible:
- `apps/api-server/src/index-env.mjs`
- `apps/api-server/src/query-api/`
- `apps/api-server/src/route-registrar.mjs`
- `apps/api-server/src/routes/`
- `apps/api-server/src/team/`
- `apps/api-server/src/webhook-event-router.mjs`

Action:
- keep them only if they are part of the intended app-authority flip
- otherwise stop and reduce before commit

This should be reviewed before final public push because it changes perceived authority.

---

## 5. GitHub release-facing deliverables to prepare next

### A. Release note draft

Prepare a concise GitHub release / PR summary with 5 bullets:

1. AI Team Runtime public product framing
2. Agent Harness productized standalone baseline
3. dashboard public-contract convergence
4. third-party agent onboarding sample
5. repo hygiene + release gates

---

### B. Contributor-facing summary

Prepare a short section titled:
- `What changed for contributors?`

Should explain:
- where to start reading
- where to add runtime logic
- where to add harness logic
- where to add dashboard code
- what is optional / secondary

---

### C. Public release checklist snapshot

Before pushing GitHub-facing release branch:

- `git status` clean except intended files
- generated/runtime dirs not tracked
- smoke gates green
- docs links sane
- no maintainer-private URLs/secrets
- examples runnable from repo root

---

## 6. Suggested exact next execution order

1. curate `reports/` keep-vs-archive list
2. finalize commit split A-D
3. produce one release note draft
4. produce one contributor-facing migration note
5. do final `git status` / `git diff --stat` sanity check
6. then commit / push

---

## 7. Bottom line

The project does **not** currently need another large conceptual redesign.

The highest-value next move is:

> **package the completed P0-P4 work for GitHub publication, while clearing remaining generated/retired noise and locking contributor guidance.**

That is the shortest path from “internally improved” to “externally credible open-source repo”.
