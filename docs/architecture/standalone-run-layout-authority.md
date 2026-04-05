# Standalone Run Layout Authority

> P2 authority document for the **productized standalone harness run directory layout**.
> This answers: when someone runs the standalone harness, **what files should exist, where, and why**.

---

## 1. Canonical Run Root

A standalone run lives under:

```text
examples/oss-minimal/.runs/<run-id>/
```

Within that run root, the canonical layout is:

```text
<run-id>/
  run-report.json
  runtime/
  workspace/
  .shared/
```

Meaning:
- `run-report.json` = top-level execution summary and product-facing evidence index
- `runtime/` = operational/runtime state and logs
- `workspace/` = user-facing deliverables, memory, desk state
- `.shared/` = authority / recovery / shared-state scaffolding

---

## 2. Top-Level Product Evidence

### `run-report.json`
This is the main product-facing summary for a completed or resumable run.

It should capture:
- harness SDK / contract summary
- host contract summary
- agent package summary
- bridge / lifecycle / shell / capability gate state
- decision / results / replan summary
- runtime evidence counts
- path inventory for critical files

Rule:
- if a human asks “what happened in this run?”, `run-report.json` is the first file to inspect.

---

## 3. `runtime/` Layout

`runtime/` is the operational state directory.

Common files:
- `run-state.json`
- `event-log.json`
- `stream-log.json`
- `transport-log.json`
- `queue-state.json`
- `tool-runs.json`
- `backend.sqlite`
- `backend-meta.json`
- `shell-state.json`
- `lifecycle-state.json`
- `authority-state.json`
- `host-layer-state.json`
- `host-scheduler.json`
- `host-session-bus.json`
- `host-inbox.json`
- `host-outbox.json`
- `host-dispatch.json`

Subdirectories:
- `runtime/bridge/`
- `runtime/plugins/`
- `runtime/transport/`

Interpretation:
- `run-state.json` = resumable execution state
- `event-log.json` = canonical runtime event history
- `stream-log.json` = streamed chunk/event evidence
- `transport-log.json` = broker/transport/control activity
- `queue-state.json` = queued/leased work visibility
- `tool-runs.json` = evidence of tool/runtime execution
- `shell-state.json` = doctor / onboarding / activation checklist state

---

## 4. `workspace/` Layout

`workspace/` is the human-facing working area.

Canonical layout:

```text
workspace/
  artifacts/
  memory/
  desk/
```

### `workspace/artifacts/`
Expected product outputs such as:
- `PLAN.md`
- `DELIVERABLE.md`
- `REVIEW.md`
- `RETRIEVAL-ADDENDUM.md`
- `REVIEW-REPLAN.md`
- `DECISION.md`

### `workspace/memory/`
Expected durable/shared memory files such as:
- `blackboard.json`
- `durable-memory.json`
- `persona-state.json`

### `workspace/desk/`
Expected agent desk state:
- `inbox/`
- `outbox/`
- `notes/`

Rule:
- if a human asks “what was delivered?”, inspect `workspace/artifacts/`
- if a human asks “what was remembered?”, inspect `workspace/memory/`
- if a human asks “what async collaboration state existed?”, inspect `workspace/desk/`

---

## 5. `runtime/transport/` Layout

This area contains multi-broker and scheduler state.

Common files:
- `scheduler-state.json`
- `scheduler.sqlite`
- `cluster/cluster-registry.json`
- `cluster/cluster-placements.jsonl`
- `cluster/cluster-summary.json`

This is the core evidence for:
- multi-broker readiness
- scheduling / dispatch
- failover / retry / recovery scaffolding
- cluster placement visibility

---

## 6. `.shared/` Layout

`.shared/` is the authority/recovery scaffold.

Common files:
- `run-index.json`
- `recovery-state.json`

This area exists so the standalone harness can demonstrate:
- shared authority mode
- recovery source-first behavior
- resumable run indexing

---

## 7. Product Entry Commands

The productized standalone harness should now be reachable through these commands:

```bash
npm run demo:oss-minimal
npm run status:oss-minimal
npm run doctor:oss-minimal
npm run validate:agent-package
```

Interpretation:
- `demo:oss-minimal` = create a fresh standalone run and emit a full run report
- `status:oss-minimal` = inspect the latest run status
- `doctor:oss-minimal` = inspect the latest run onboarding/doctor state
- `validate:agent-package` = validate the standalone agent package contract surface

---

## 8. P2 Boundary Rule

The standalone harness is productized when a new contributor can do all of the following without understanding internal implementation details first:
- run a demo
- inspect latest status
- run doctor
- validate the package contract
- navigate the run directory using a documented layout

That is the authority target for P2.
