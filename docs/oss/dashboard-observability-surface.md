# Dashboard Observability Surface

The dashboard should be understood as the **execution visibility front-end** for AI Team Runtime.

It is not only a chat UI. Its product role is to make the runtime observable.

---

## What the dashboard should expose

### 1. Task/workbench flow
- active tasks
- task stages
- workbench structure
- operator follow-up points

### 2. Runtime visibility
- node/runtime status
- member execution activity
- orchestration progress
- session-level state where publicly appropriate

### 3. Delivery visibility
- artifacts
- evidence
- deliverables
- acceptance/review state
- timeline of production and closure

### 4. Communication context
- task-scoped chat/context
- operator follow-up
- summary state
- action surfaces tied to execution, not just messaging

---

## Why this matters

Without observability, a team runtime feels opaque.
The dashboard is what makes the system feel like an operational product rather than a hidden orchestration engine.

---

## Current relevant code surfaces

Primary UI authority:
- `dashboard/`

Relevant current component areas include:
- `dashboard/src/components/panels/`
- `dashboard/src/components/views/`
- `dashboard/src/components/TaskCard.tsx`
- `dashboard/src/components/NodesView.tsx`
- `dashboard/src/components/StageTimeline.tsx`
- `dashboard/src/lib/types.ts`

---

## Public product rule

When describing the dashboard in public docs, prefer language like:
- execution visibility
- task/workbench observability
- artifact/evidence/review surface
- runtime status and follow-up surface

Avoid reducing it to “just the chat UI”.

---

## Relationship to runtime docs

Read with:
- `what-is-ai-team-runtime.md`
- `dashboard-observability-checklist.md`
- `../architecture/current-team-runtime-architecture.md`
- `../architecture/execution-state-and-read-model-authority.md`
