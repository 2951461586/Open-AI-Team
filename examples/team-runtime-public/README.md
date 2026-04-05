# Team Runtime Public Example

This example track is the public-safe entrypoint for the **primary AI Team Runtime product**.

It is intentionally lighter than a full deployment, but heavier than a toy config snippet.

## What it demonstrates

- Team Runtime as the primary product surface
- public-safe role/governance config authority
- dashboard/query/control/read-model contract consumption
- smoke-friendly local startup path

## Start here

1. Read:
   - `../../GETTING-STARTED.md`
   - `../../README.md`
   - `../../dashboard/README.md`
   - `../../docs/api/team-governance-query-api/README.md`
2. Copy public-safe config references from:
   - `../../config/examples/roles.public-example.json`
   - `../../config/examples/governance.public-example.json`
   - `../../config/examples/network-ports.public-example.json`

## Suggested validation path

```bash
npm install
npm run smoke:team
npm run smoke:public-schemas
node scripts/team/team-query-route-catalog-example.mjs
node scripts/team/team-uat-observability-neutralization-smoke.mjs
```

## What this track is not

- not the standalone harness baseline (`../oss-minimal/`)
- not the third-party package onboarding template (`../third-party-agent-sample/`)

Use this track when you want the DeerFlow-style team product story first.
