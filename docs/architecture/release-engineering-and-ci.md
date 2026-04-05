# Release Engineering and CI

> P6 authority document for turning the repository from a merely runnable workspace into a **public-safe, release-checkable GitHub surface**.

---

## 1. Goal

P6 is the phase where open-source readiness stops being only a documentation claim and becomes a **repeatable validation pipeline**.

The purpose is to make it obvious:
- what GitHub CI can validate from the public repository alone
- what belongs to the public product promise
- what is still only a maintainer/workspace reality
- what release gates must stay green before calling the repository publishable

---

## 2. Public CI Layers

The GitHub-facing CI surface should validate **four public-safe layers**:

### A. Mainline product integrity
Canonical repo-wide smoke for the public product family.

Expected gate:
- `npm run smoke:team`

This covers the current mainline boundary stack, including governance, harness authority, public-contract gates, and maintainer/private boundary guards.

### B. Public contracts and schemas
Validate that published fixtures, derived fixtures, and dashboard-facing public payload schemas remain aligned.

Expected gates:
- `npm run fixtures:route-derived`
- `npm run smoke:public-schemas`
- `npm run smoke:dashboard-public-contract`

### C. OSS minimal runnable baseline
Validate the standalone harness baseline as a runnable public sample.

Expected gates:
- `npm run smoke:oss-minimal`
- `npm run demo:oss-minimal`
- `npm run status:oss-minimal`
- `npm run doctor:oss-minimal`
- `npm run validate:agent-package`

### D. Third-party onboarding template
Validate the productized independent-agent onboarding path.

Expected gates:
- `npm run validate:third-party-agent`
- `npm run smoke:third-party-agent`

---

## 3. Dashboard Build Authority

The repository now exposes dashboard as a **repo-local application surface**:

### Repo-local dashboard application
- `dashboard/src/`
- `dashboard/public/`
- `dashboard/scripts/`
- `dashboard/package.json`
- `dashboard/package-lock.json`

This is now both:
- the **contract-facing dashboard source surface** used by public contract/read-model guards
- the **repo-local app shell** used for real GitHub CI builds

### P7 rule
Dashboard is no longer a sibling-workspace exception.
Public GitHub CI now validates both:
- dashboard contract alignment
- repo-local dashboard build authority

In other words:
- `team-dashboard-public-contract-smoke.mjs` guards the dashboard read-model/contract surface
- `dashboard-build` is the GitHub CI lane for actual repo-local app buildability
- `npm run dashboard:build` is now a repo-local build authority entrypoint

---

## 4. Release Checklist

A GitHub-facing release should keep the following green:

### Required public-safe gates
- `npm run smoke:team`
- `npm run fixtures:route-derived`
- `npm run smoke:public-schemas`
- `npm run smoke:dashboard-public-contract`
- `npm run dashboard:build`
- `npm run dashboard:check-bundle`
- `npm run release:stage-artifacts`
- `npm run release:notes`
- `npm run smoke:oss-minimal`
- `npm run demo:oss-minimal`
- `npm run validate:agent-package`
- `npm run validate:third-party-agent`
- `npm run smoke:third-party-agent`

### Required authority docs
- `README.md`
- `GETTING-STARTED.md`
- `ARCHITECTURE.md`
- `docs/architecture/release-surface-allowlist.md`
- `docs/architecture/maintainer-private-ops-boundary.md`
- `docs/architecture/release-engineering-and-ci.md`

### Required boundary truths
- public CI must not depend on private hosts or live infra
- public CI must not depend on `scripts/ops/`
- public CI must not pretend `config/team/` is the default public example surface
- public CI must not treat optional integrations as the main product story
- dashboard repo-scoped contract validation and workspace-only app build reality must stay clearly separated

---

## 5. What P6 Completes

P6 is complete when:

1. GitHub Actions is split into layered public-safe jobs
2. release engineering expectations are documented as authority, not tribal memory
3. mainline smoke contains a guard that prevents CI/release drift
4. the dashboard build boundary is described honestly

---

## 6. What P6 Does Not Yet Complete

P6 does **not** yet mean:
- the full dashboard app shell has been moved into the repository
- every maintainer acceptance path has been publicized
- release artifacts are packaged/published automatically
- a marketplace/distribution story is finished

Those are later phases.

---

## 7. One-line Rule

**Public CI should validate exactly what the public repository really promises — no less, and definitely no more.**
