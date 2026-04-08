# @ai-team/api-server

Current application authority for the Team Harness server entry surface.

## Current status

`apps/api-server/` is now the **server entry-adjacent authority**.

The app owns:

- server entry exports (`createServer`, `startServer`, auth/body helpers)
- direct-run entrypoint behavior
- app-local env loading (`index-env.mjs`)
- app-local bootstrap assembly (`index-bootstrap.mjs`)
- app-local webhook event router entry (`webhook-event-router.mjs`)
- app-local route registrar / entry wiring (`route-registrar.mjs`)
- app-local route implementation files (`routes/index-routes-*.mjs`)
- app-local deeper route helpers (`routes/team-state/*`, `routes/team-route-*`)
- app-local desk HTTP seam (`team/desk-api.mjs`)
- app-local delivery / receipt seams (`team/team-delivery-target.mjs`, `team/team-output-receipt-host.mjs`)
- app-local query SDK seam (`query-api/sdk.mjs`)
- the canonical app-facing public server surface

## Current boundary

`apps/api-server/` is the server entry authority.

It may still call runtime/domain modules that live outside the app tree, but new server-entry behavior, route assembly, and app-local seams should land here first.

## Compatibility rule

- `src/index.mjs`, `src/index-env.mjs`, `src/index-bootstrap.mjs`, `src/webhook-event-router.mjs`, `src/routes/index-routes-*.mjs`, and related app-entry compatibility files are shim surfaces only
- new entry-adjacent behavior must land in `apps/api-server/src/`
- runtime/domain logic that already has a package owner should move behind that package boundary rather than growing back under legacy paths
