# OSS Comparison: DeerFlow / OpenHanako / AI Team Harness

## Purpose

This document turns the previous discussion into a formal open-source cleanup checklist.

The point is not to imitate DeerFlow or OpenHanako mechanically.
The point is to clarify where AI Team Harness still needs product and OSS cleanup before it feels coherent to external users.

## Comparison snapshot

| Area | DeerFlow | OpenHanako | AI Team Harness current gap | Cleanup direction |
|---|---|---|---|---|
| Execution substrate | Strong "super agent harness" positioning, runtime-first narrative | More independent agent-facing integration feel | Runtime story exists but authority and boundaries still drift | Freeze one runtime / deploy / contract authority |
| Agent integration | Strong harness-centered orchestration | Independent agent access / UI-facing integration ideas | Historical platform-bound traces and compatibility surfaces remain | Push runtime adapter + plugin boundary harder |
| Event model | Harness/event language is prominent and legible | UI/product framing is clearer to outside readers | Dashboard/workbench/history still risks mixed interpretation layers | Unify event/read-model semantics |
| OSS entry | Strong top-level public story | Friendly surface for agent/product ideas | Root README / deploy path / deprecation story were under-documented | Add bilingual entry + public doc map |
| Platform coupling | Less tied to one private operator surface in public framing | Product-facing UI ideas easier to detach | OpenClaw-specific assumptions still leak into wording and operations | Move host-specific assumptions behind adapters |

## What AI Team should keep

Do not throw away the project's differentiators:

- planner / executor / critic / judge execution chain
- workbench-style deliverable closure
- evidence / artifact / review / decision loop
- release contract discipline (`PROVENANCE.json`, `VERSION-STORY.json`, release notes)

Those are strengths.
The cleanup work is mainly about **boundary clarity**.

## Large-grain OSS cleanup checklist

### P0 — one authority only

- [ ] one deployment authority
- [ ] one dashboard source authority
- [ ] one public runtime contract surface
- [ ] one README entry path for new OSS users

### P1 — remove old fallback surfaces

- [ ] deprecate `dashboard-static-export` as a deployment entry
- [ ] stop teaching artifact-first deployment
- [ ] stop relying on stale local mirrors as authority
- [ ] mark generated bundles as outputs, not product truth

### P2 — reduce OpenClaw-specific binding

- [ ] separate host/runtime adapter language from product language
- [ ] move OpenClaw-specific operational assumptions behind adapters
- [ ] stop leaking maintainer-only environment paths into public docs
- [ ] keep public docs free from private node / override / host topology assumptions

### P3 — runtime and event model cleanup

- [ ] unify dashboard/workbench/timeline semantics around one public read model
- [ ] reduce front-end guesswork and compatibility inference
- [ ] keep task / review / decision / evidence states legible to external readers
- [ ] document what is public contract vs internal convenience mapping

### P4 — product shell clarity

- [ ] keep the OSS minimal example genuinely minimal
- [ ] make onboarding / doctor / routes / capabilities feel productized
- [ ] keep plugin contribution surfaces explicit and inspectable
- [ ] ensure sample agents demonstrate real runtime boundaries, not brand-specific hacks

### P5 — public documentation quality

- [ ] bilingual root navigation
- [ ] clear quick-start path
- [ ] clear deploy path
- [ ] clear deprecation path
- [ ] clear comparison / positioning doc

## Specific cleanup targets already visible in this repo

### 1. Deployment story drift

Problem:
- stale static exports can be deployed even when the current source tree differs

Required change:
- deploy only from the full dashboard source tree after a fresh build

### 2. Historical fallback mindset

Problem:
- generated artifacts are too easily treated as valid fallback entry points

Required change:
- downgrade them to inspection/migration/provenance status only

### 3. Public docs were not yet telling one clean story

Problem:
- new external readers could not quickly tell where to start, how to deploy, and what is deprecated

Required change:
- root bilingual README + explicit deploy authority + deprecation note + OSS comparison doc

### 4. OpenClaw coupling still needs continued cleanup

Problem:
- the project can still inherit maintainer-host assumptions in wording and operations

Required change:
- keep host-layer details behind adapters and keep the OSS story host-neutral

## Practical target state

A clean GitHub-facing OSS state should read like this:

1. start at root README
2. choose English or Chinese
3. understand what the harness is
4. build the dashboard from source
5. deploy only freshly built artifacts
6. understand which surfaces are deprecated
7. see a clear path for adapters and third-party integrations

## Bottom line

Compared with DeerFlow and OpenHanako, AI Team Harness does not mainly need “more features”.
It mainly needs:

- fewer conflicting truths
- less hidden platform coupling
- sharper runtime boundaries
- cleaner OSS-facing entry and deployment discipline
