# Session Capability & Follow-up Fallback

> Current authority for AI Team session-capability semantics and follow-up fallback behavior.
> Use this doc when you need the **real product behavior**, not an aspirational persistent-session story.

---

## 1. Product Reality

AI Team uses a **capability-first session model**:

- if the platform supports `thread=true + mode=session`, member work can upgrade into a **persistent session**;
- if the platform does not support persistent member sessions, member execution automatically degrades to **run mode**;
- when follow-up targets a non-persistent member session, or a persistent member cannot continue safely, **TL takes over directly** instead of returning an empty or fake-success reply.

This is the current product truth.
It is more important than any older host-specific or demo-specific wording.

---

## 2. Canonical Session Capability Fields

The current query/state surface must expose:

- `sessionMode`
- `sessionPersistent`
- `sessionFallbackReason`

Current route coverage:

- `/state/team/summary`
- `/state/team/workbench`
- `/state/team/board`
- `/state/team/dashboard`

These fields are part of the active product contract for understanding whether a member task is running as:

- persistent session
- one-shot run-mode execution
- fallback / degraded execution surface

---

## 3. Follow-up Routing Semantics

### 3.1 When persistent session is supported

If the runtime can actually create `thread=true + mode=session` member sessions:

- member sessions become persistent
- follow-up can continue in the same member session
- the visible state should show the task as a persistent session path

### 3.2 Current environment reality

In the current environment, member `subagent mode=session` can return:

```text
thread=true is unavailable because no channel plugin registered subagent_spawning hooks.
```

That means the real behavior is:

- member execution still works
- multi-role routing still works
- member session capability degrades to `run` mode
- member follow-up continuity is not guaranteed by the child session itself
- TL must own the safe fallback path

### 3.3 TL direct fallback rules

If follow-up hits a run-mode member session:

- do **not** return an empty reply
- do **not** pretend the member still has a persistent session
- TL should answer directly with natural language

If follow-up hits a persistent member session but continuation fails with signals like:

- `empty_member_reply`
- session not visible / not resumable
- member follow-up unavailable

then the system should:

- attempt the member continuation once
- stop retrying the same member follow-up path
- immediately fall back to **TL direct reply**

The key product promise is:

**AI Team must not report fake success with an empty reply.**

---

## 4. Task State Writeback Contract

Follow-up outcomes must be written back into the task state surface.

Required metadata fields:

- `followupRoute`
- `lastFollowupFallbackReason`
- `lastFollowupTargetRole`
- `lastFollowupAssignmentId`
- `lastFollowupChildTaskId`

These fields are the authoritative way to explain:

- where the follow-up was routed
- why fallback happened
- which member / assignment / child task was targeted

---

## 5. Runtime & UI Interpretation

### Task / board / dashboard surfaces

The current product surface should make it clear whether the task is:

- `持久会话`
- `一次性会话`
- `旧桥兜底`
- `TL 直答兜底`

### Workbench / detail surfaces

Workbench and related detail views should make visible:

- current route
- session capability state
- whether the task is persistent
- degraded reason / fallback reason
- execution node context when available

The product goal is **visibility of real capability boundaries**, not hiding them.

---

## 6. Acceptance & Gates

The current acceptance/gate stack for this area includes:

- `scripts/team/team-followup-fallback-mainline-smoke.mjs`
- `scripts/acceptance/canonical/team-dashboard-rightpanel-deeplink-smoke.mjs`
- `scripts/smoke/team-mainline.mjs`

What these guards prove:

1. follow-up on run-mode member sessions falls back to TL direct reply
2. persistent-session continuation failures fall back after a single member attempt
3. state/query routes expose session capability fields consistently
4. dashboard/detail entry surfaces remain navigable and inspectable

---

## 7. One-Sentence Product Truth

**AI Team prefers persistent member sessions when the platform truly supports them; otherwise it degrades to one-shot member execution and lets TL take over follow-up, so the system never hides capability limits behind empty-success behavior.**

---

## 8. Related Authority

- `../../README.md`
- `../../ARCHITECTURE.md`
- `current-team-runtime-architecture.md`
- `standalone-harness-baseline-release.md`
- `../ops/p7-p8-session-capability-and-followup-fallback-2026-03-30.md` (historical implementation / acceptance note)

<!-- Last reviewed: 2026-04-03 UTC -->
