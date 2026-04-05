# Execution State and Read-Model Authority

> P0 authority document for deciding **what counts as execution truth**, **which state is allowed to drive product surfaces**, and **where UI read-models are allowed to derive from**.

---

## 1. Goal

P0 requires the repository to behave like a **strong execution harness**, not a collection of loosely related status views.

The main rule is:

- execution truth must come from a small, explicit contract surface
- product read-models may summarize that truth
- UI surfaces must not invent authority by guessing missing meaning

---

## 2. Canonical execution objects

The current primary execution objects are:

- `task`
- `plan`
- `review`
- `decision`
- `artifact`
- `evidence`
- `childTask`
- `interventionStatus`
- `deliveryStatus`

These are the minimum execution facts allowed to drive workbench / summary / pipeline / dashboard views.

---

## 3. Authority chain

### A. Durable execution authority
Primary durable authority lives in task snapshot inputs and their derived route helpers:

- task store state
- plan / review / decision records
- artifacts / evidence
- child-task execution-surface metadata

### B. Read-model authority
Primary read-model derivation lives in:

- `src/routes/team-state/task-observability-shared.mjs`
- `src/routes/team-state/summary.mjs`
- `src/routes/team-state/workbench.mjs`
- `src/routes/team-state/pipeline.mjs`

### C. Public contract authority
Public contract/schema authority lives in:

- `schemas/dashboard-summary-payload.schema.json`
- `schemas/dashboard-workbench-payload.schema.json`
- `schemas/dashboard-pipeline-payload.schema.json`
- related dashboard contract schemas

---

## 4. Locked derivation rules

### Rule 1 — UI does not invent state authority
Dashboard / workbench / timeline / mission-control surfaces must not invent execution truth that is not present in:

- durable execution records, or
- route-level shared derivation helpers

### Rule 2 — shared derivation happens before UI
If a field such as:

- `deliveryStatus`
- `interventionStatus`
- `currentDriver`
- `nextBestAction`
- `executiveSummary`
- `memoryLayers`

is needed across more than one product surface, it must be derived in shared route logic first.

### Rule 3 — compatibility fields do not regain authority
Legacy or compatibility terms such as:

- fallback-specific host wording
- gateway-specific product wording
- UI-only narrative placeholders

may exist only as compatibility views or labels.
They must not become the primary execution authority again.

### Rule 4 — mailbox is evidence/context, not primary execution truth
Mailbox entries may remain visible as context, but must not replace the canonical execution objects above when deciding:

- current phase
- delivery readiness
- intervention need
- final next-best action

---

## 5. Product surfaces that must obey this rule

The following surfaces are explicitly bound to this authority:

- `summary`
- `workbench`
- `pipeline`
- dashboard task cards
- mission control / workbench delivery panels
- future timeline stage narration

---

## 6. P0 completion bar

P0 execution-state authority is complete when:

1. bootstrap is host-neutral by default
2. OpenClaw remains an explicit optional integration path
3. route-level execution derivation is the shared authority for product views
4. dashboard contracts name derived execution fields explicitly
5. smoke tests guard the authority path

---

## 7. One-line rule

**Execution truth comes from durable task facts plus shared route derivation — not from UI guesswork, fallback narration, or host-specific runtime assumptions.**
