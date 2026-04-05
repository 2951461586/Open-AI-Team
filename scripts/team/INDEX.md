# AI Team Script Index

> Current index for active, authoritative validation surfaces.
> Historical experiments and retired validation flows belong in archive docs or Git history.

---

## 1. Mainline validation

### Canonical smoke / regression
- `../smoke/team-mainline.mjs` — mainline product smoke
- `../smoke/team-batch.mjs` — batch smoke for the current stack
- `team-control-plane-smoke.mjs` — control-plane minimum smoke
- `team-workbench-smoke.mjs` — artifact / evidence / workbench smoke
- `team-single-flight-mainline-smoke.mjs` — single-flight mainline smoke
- `team-dag-fail-fast-smoke.mjs` — DAG fail-fast smoke
- `team-followup-fallback-mainline-smoke.mjs` — follow-up fallback smoke
- `team-session-capability-doc-boundary-smoke.mjs` — session capability docs / discoverability gate
- `team-session-completion-event-smoke.mjs` — completion-event smoke

### Contracts / execution / memory / harness
- `team-governance-wiring-smoke.mjs` — governance wiring smoke
- `team-role-capability-contract-smoke.mjs` — role capability contract smoke
- `team-execution-surface-contract-smoke.mjs` — execution-surface contract smoke
- `team-memory-three-layer-smoke.mjs` — three-layer memory smoke
- `team-harness-authority-smoke.mjs` — harness authority / execution-chain guard smoke
- `team-p0-execution-authority-smoke.mjs` — P0 execution-state / read-model authority gate
- `team-p1-product-surface-delivery-closure-smoke.mjs` — P1 product-surface / delivery-closure gate
- `team-independent-agent-onboarding-smoke.mjs` — independent-agent onboarding gate
- `team-third-party-agent-template-smoke.mjs` — third-party productized template gate
- `team-dashboard-public-contract-smoke.mjs` — dashboard public-contract gate
- `team-dashboard-single-repo-build-smoke.mjs` — dashboard single-repo build gate
- `team-oss-release-baseline-smoke.mjs` — OSS baseline release gate
- `team-maintainer-private-ops-boundary-smoke.mjs` — maintainer/private-ops boundary gate
- `team-release-engineering-ci-smoke.mjs` — release-engineering / CI gate
- `team-release-artifact-publish-smoke.mjs` — release-artifact / publish pipeline gate
- `team-release-notes-provenance-version-smoke.mjs` — release-notes / provenance / version-story gate
- `team-compat-boundary-smoke.mjs` — compat-boundary guard smoke
- `team-wave2-host-config-split-smoke.mjs` — Wave 2 host-config split gate
- `team-wave2-full-boundary-smoke.mjs` — Wave 2 full closure gate
- `team-search-evidence-safety-smoke.mjs` — evidence-search safety smoke
- `team-roles-config-authority-smoke.mjs` — roles config authority smoke
- `team-contract-boundary-matrix-smoke.mjs` — contract boundary matrix smoke
- `team-role-contracts-smoke.mjs` — role contract smoke
- `_team-governance.mjs` — shared governance helper module

### Live acceptance / canonical
- `../acceptance/canonical/team-three-node-live.mjs` — three-node live acceptance
- `../acceptance/canonical/team-dashboard-rightpanel-deeplink-smoke.mjs` — dashboard deep-link smoke
- `../acceptance/canonical/team-planner-violet-live.mjs` — planner live acceptance
- `../acceptance/canonical/team-executor-violet-live.mjs` — executor live acceptance
- `../acceptance/canonical/team-role-routing-matrix-live.mjs` — role-routing live acceptance
- `../acceptance/canonical/team-three-node-async-ingress-live.mjs` — three-node async-ingress live acceptance
- `../acceptance/canonical/team-visible-delivery-dryrun-live.mjs` — visible-delivery dry-run acceptance
- `../acceptance/canonical/team-async-ingress-smoke.mjs` — async-ingress smoke
- `../acceptance/canonical/team-async-ingress-missing-delivery-mode-smoke.mjs` — ingress-normalize smoke

---

## 2. Internal helpers

- `_planner-payloads.mjs`
- `_critic-payloads.mjs`
- `team-output-replay-undelivered.mjs` — replay/diagnostic helper, not a canonical smoke entrypoint

---

## 3. Suggested reading order

### Prove the mainline is alive
1. `../smoke/team-mainline.mjs`
2. `../smoke/team-batch.mjs`
3. `team-control-plane-smoke.mjs`
4. `team-workbench-smoke.mjs`

### Understand active boundaries and contracts
1. `team-governance-wiring-smoke.mjs`
2. `team-role-capability-contract-smoke.mjs`
3. `team-execution-surface-contract-smoke.mjs`
4. `team-memory-three-layer-smoke.mjs`

### Understand live / cross-node behavior
1. `../acceptance/canonical/team-three-node-live.mjs`
2. `../acceptance/canonical/team-role-routing-matrix-live.mjs`
3. `../acceptance/canonical/team-dashboard-rightpanel-deeplink-smoke.mjs`

---

## 4. Index rule

If a script is current and important, it should be discoverable from here or from the canonical smoke entrypoints.
If it is historical, experimental, or retired, it should not remain in the active index.
