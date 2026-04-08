# src Authority Migration Inventory (Open-Source View)

> Status: active working inventory
> Purpose: translate the mixed `src/` reality into an open-source-friendly migration view.

---

## Why this file exists

The repository is no longer accurately described by a blanket “`src/` is authority” rule.
However, `src/` still contains a mix of:
- active shared runtime logic
- server/app seam logic
- compatibility shims
- optional integration surfaces
- migration-sensitive code

This file exists to help contributors answer a simple question:

> If I touch something in `src/`, should it stay there, move to a package, move to an app, or be treated as compatibility-only?

---

## High-level split

### 1. Compatibility-first surfaces in `src/`
These should trend toward shim-only status and should not attract new product logic unless there is a documented migration reason.

Examples:
- `src/agent-harness-core/*` when corresponding package-owned harness surfaces exist
- `src/team-core/*` when corresponding package-owned core surfaces exist
- `src/tools/*` when corresponding package-owned tool surfaces exist
- packaged TL/runtime helper areas already marked as shim in existing authority docs

### 2. Shared runtime surfaces still legitimately active in `src/`
These are still part of the live runtime and cannot be blindly moved into an app.

Examples from current inventory:
- `src/team/team-policy.mjs`
- `src/team/team-store.mjs`
- `src/team/team-role-contracts.mjs`
- `src/team/team-agent-lifecycle.mjs`
- `src/team/team-resident-runtime.mjs`
- `src/team/team-governance-runtime.mjs`
- `src/team/team-native-chat.mjs`
- `src/team/team-task-dispatcher.mjs`
- `src/team/team-tl-runtime.mjs`
- `src/team/session-bus.mjs`
- `src/team/event-bus.mjs`
- `src/team/im-channel-router.mjs`

### 3. App-seam candidates
These are closer to API/server entry concerns and should generally trend toward app ownership.

Examples from current inventory:
- `src/team/desk-api.mjs`
- `src/team/team-output-receipt-host.mjs`
- `src/team/team-delivery-target.mjs`
- query-api app seam modules already flipped to `apps/api-server`

### 4. Optional integrations
These should remain explicitly secondary in the open-source story.

Examples:
- `src/integrations/*`
- host/bootstrap-specific routing
- host/runtime-specific selectors

---

## Working rules for contributors

### Put code into `packages/*` when
- it is reusable across apps
- it represents public/runtime substrate behavior
- it belongs to harness/runtime/core/tool contracts
- it should be tested and documented as a product surface

### Put code into `apps/*` when
- it is server entry specific
- it is route/app bootstrap logic
- it is deployment/app-shell wiring
- it should not be imported as a reusable runtime contract

### Leave code in `src/` temporarily when
- it is a still-live shared runtime area without a finished package/app landing zone
- moving it would create more ambiguity than clarity right now
- it is an intentional compatibility seam already documented as such

### Avoid doing
- adding new major logic to legacy/shim paths without updating authority docs
- using `src/` as a catch-all because the target package/app boundary is inconvenient
- teaching external contributors that all `src/` paths are equivalent in authority

---

## Immediate next migration targets

### P0 documentation targets
- keep `docs/oss/repo-authority.md` aligned with reality
- keep `README.md` / `GETTING-STARTED.md` aligned with surface ownership
- add per-surface authority notes where ambiguity is recurring

### P1 engineering targets
- continue moving reusable runtime substrate toward `packages/agent-harness/`
- continue moving packaged team-runtime semantics toward `packages/team-runtime/`
- keep `apps/api-server/` focused on app/server seams rather than absorbing shared runtime indiscriminately

---

## Source backlinks

For the more detailed `src/team/*` classification, see:
- `../architecture/src-team-authority-inventory.md`
- `repo-authority.md`
- `../architecture/product-surface-and-repo-map.md`
