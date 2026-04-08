# Repository Authority Map

Status: current canonical authority map for the open-source AI Team Runtime line.

This repository is no longer well-described by a single “`src/` is authority” rule.
Authority is now split by **product surface** and by **completed package/app flips**.

---

## 1. Public product family

The repository should be understood through four top-level surfaces:

1. **AI Team Runtime** — primary runtime/orchestration product
2. **Dashboard** — primary operator/workbench UI
3. **Agent Harness** — reusable forkable execution substrate
4. **Optional Integrations** — host/channel/deployment-specific surfaces

This framing is the default public reading order.

---

## 2. Current canonical authority by surface

### Team Runtime product
- `packages/team-runtime/` — canonical package authority for the packaged team-runtime export surface
- `src/team/` — mixed surface: covered files are compatibility shims where migration completed; remaining non-packaged team areas still live here
- `src/team-runtime-adapters/` — runtime/control-plane/session adapter authority
- `src/routes/` and `apps/api-server/` — server/route/app entry authority split by completed app flip

### Agent Harness substrate
- `packages/agent-harness/` — canonical package authority for the standalone harness substrate
- `src/agent-harness-core/` — compatibility shim / compatibility asset surface only

### Platform-neutral core
- `packages/team-core/` — canonical package authority for platform-neutral contracts/domain layer
- `src/team-core/` — compatibility shim surface only

### Tool/provider surface
- `packages/tools/` — canonical package authority for public tool providers and helpers
- `src/tools/` — compatibility shim surface only

### Dashboard
- `dashboard/` — current primary dashboard product authority
- `apps/dashboard/` — app packaging / transition surface, not the current product authority

### Optional integrations
- `src/integrations/` — optional host/platform integration authority
- `plugins/` — optional plugin ecosystem, not mainline runtime authority
- `services/` — optional/companion service surface, not mainline runtime authority
- `electron/` — secondary desktop shell, not mainline runtime authority
- `projects/` — related/experimental side projects, not mainline runtime authority
- `shared/` — low-authority shared/output area, not mainline runtime authority

---

## 3. Compatibility and duplicate-surface rule

Where both legacy `src/` paths and package/app-owned paths exist:

- the completed package/app flip wins for the covered surface
- legacy `src/` files should behave as thin compatibility shims only
- new logic should land in the owning package/app, not back in the covered legacy path

This repo therefore has a **mixed but intentional** authority map, not a blanket `src/`-first rule.

---

## 4. App/server authority

`apps/api-server/` is the current app authority for the server entry-adjacent surface, including:
- server bootstrap/env entry files
- route registrar / webhook router
- app-local route seams already flipped into the app tree

This does **not** mean every deeper runtime/domain module has moved under the app.
Deeper shared runtime internals may still live outside the app tree.

---

## 5. Dashboard authority

Current product authority remains:
- `dashboard/`

`apps/dashboard/` exists as an app packaging / future migration surface and should not be presented as the primary dashboard implementation authority yet.

---

## 6. Optional integration rule

Optional integrations are allowed in-tree but must remain secondary in the public repo story.

That means:
- they are not the default first-read product story
- they must not redefine runtime authority
- they should be described as optional wiring around the mainline runtime/harness surfaces
- plugin/service/desktop/side-project/shared-output areas must not be presented as primary product authority unless a specific flip is documented

---

## 7. Migration/flip rule

A package/app authority flip should be treated as complete for a surface only when:

1. the target package/app owns the real implementation for that surface,
2. old entrypoints become thin re-exports/shims or are removed,
3. product docs and repo-authority docs are updated in the same change,
4. examples/smokes/docs do not continue teaching the old authority path as primary.

---

## 8. What to read next

- `../../README.md`
- `../../GETTING-STARTED.md`
- `../../ARCHITECTURE.md`
- `../architecture/product-surface-and-repo-map.md`
- `what-is-ai-team-runtime.md`
- `open-source-release-engineering.md`
