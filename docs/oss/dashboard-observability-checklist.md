# Dashboard Observability Component Checklist

This document maps the current dashboard component surface to the intended observability story.

Use it as a **product/UI alignment checklist**, not as final product truth.

---

## 1. Mission / workbench / summary surface

Current likely component surfaces:
- `dashboard/src/components/panels/MissionControlPanel.tsx`
- `dashboard/src/components/panels/SummaryHeroSection.tsx`
- `dashboard/src/components/panels/WorkbenchPanel.tsx`
- `dashboard/src/components/panels/WorkbenchStructureSections.tsx`
- `dashboard/src/components/panels/WorkbenchActionSection.tsx`
- `dashboard/src/components/panels/WorkbenchDeliveryOverviewSection.tsx`

Observability questions:
- Does the UI clearly expose current mission/task scope?
- Can an operator see active stage, owner, and next action?
- Is workbench structure legible without reading chat history?

---

## 2. Timeline / execution progression surface

Current likely component surfaces:
- `dashboard/src/components/panels/TimelinePanel.tsx`
- `dashboard/src/components/panels/DeliveryTimeline.tsx`
- `dashboard/src/components/StageTimeline.tsx`

Observability questions:
- Is execution progress visible as state transitions rather than only message flow?
- Are retries, review loops, and closure states legible?
- Can an operator distinguish running / blocked / completed / failed states?

---

## 3. Artifact / file / delivery surface

Current likely component surfaces:
- `dashboard/src/components/panels/ArtifactsPanel.tsx`
- `dashboard/src/components/panels/ArtifactPreview.tsx`
- `dashboard/src/components/panels/TaskFilesPanel.tsx`

Observability questions:
- Are artifacts and evidence first-class, not buried behind chat?
- Is there a clear distinction between working files, final deliverables, and evidence?
- Can an operator understand what was produced and what remains missing?

---

## 4. Chat / console / operator follow-up surface

Current likely component surfaces:
- `dashboard/src/components/panels/TaskChatPanel.tsx`
- `dashboard/src/components/panels/TeamConsolePanel.tsx`
- `dashboard/src/components/ChatPanel.tsx`
- `dashboard/src/components/RightPanel.tsx`

Observability questions:
- Is chat task-scoped and secondary to execution state when appropriate?
- Can the operator see follow-up context, not just raw messages?
- Is console noise separated from meaningful runtime signals?

---

## 5. Node / agent / runtime visibility surface

Current likely component surfaces:
- `dashboard/src/components/NodesView.tsx`
- `dashboard/src/components/views/AgentsView.tsx`
- `dashboard/src/components/TaskCard.tsx`

Observability questions:
- Can an operator see which member/node is active?
- Is runtime health visible?
- Is ownership/delegation visible at the task/card level?

---

## 6. Cross-cutting read-model alignment

Supporting code surfaces:
- `dashboard/src/lib/types.ts`
- `dashboard/src/lib/store.ts`
- `dashboard/src/lib/api.ts`
- `dashboard/src/hooks/useWebSocket.ts`

Checklist:
- read models should favor execution state, artifacts, evidence, and follow-up visibility
- avoid collapsing everything into generic chat/thread abstractions
- keep UI contracts aligned with runtime/read-model docs

---

## Read together with

- `dashboard-observability-surface.md`
- `../architecture/execution-state-and-read-model-authority.md`
- `../architecture/deliverables-evidence-acceptance-authority.md`
