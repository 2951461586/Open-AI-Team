# Team Governance Query API

> Stable machine-facing query contract for AI Team Runtime.

## Contract

- **Contract name**：`team.governance.query.v1`
- **Version**：`v1`
- **Stable envelope**：`api` / `resource` / `query` / `links`

All stable public query routes return JSON with at least:

```json
{
  "ok": true,
  "api": {
    "namespace": "team.governance.query",
    "contract": "team.governance.query.v1",
    "version": "v1",
    "route": "summary",
    "resourceKind": "task_summary",
    "stable": true
  },
  "resource": {},
  "query": {},
  "links": {}
}
```

## Route catalog

Use `GET /state/team/contracts` as the canonical catalog.

It publishes:

- `contracts`：planner / critic / judge role contracts
- `queryContracts`：stable query API catalog
- `queryContracts.featuredRouteKeys`：featured published route keys
- `queryContracts.featuredRoutes`：featured published route entries

Featured published routes worth surfacing first in clients:

- `summary`
- `workbenchPayload`
- `pipeline`
- `control`
- `residents`
- `dashboard`

### Example: `queryContracts.featuredRoutes`

```json
{
  "featuredRouteKeys": [
    "summary",
    "workbenchPayload",
    "pipeline",
    "control",
    "residents",
    "dashboard"
  ],
  "featuredRoutes": {
    "summary": {
      "path": "/state/team/summary",
      "resourceKind": "task_summary",
      "requiredTopLevel": ["api", "resource", "query", "links", "currentMemberKey", "protocol"]
    },
    "workbenchPayload": {
      "path": "/state/team/workbench",
      "resourceKind": "task_workbench",
      "requiredTopLevel": ["api", "resource", "query", "links", "board", "summary"]
    },
    "pipeline": {
      "path": "/state/team/pipeline",
      "resourceKind": "task_pipeline",
      "requiredTopLevel": ["api", "resource", "query", "links", "pipeline", "roles"]
    },
    "control": {
      "path": "/state/team/control",
      "resourceKind": "task_control",
      "requiredTopLevel": ["api", "resource", "query", "links", "manualActions"]
    },
    "residents": {
      "path": "/state/team/residents",
      "resourceKind": "resident_registry",
      "requiredTopLevel": ["api", "resource", "query", "links", "residents", "counts"]
    },
    "dashboard": {
      "path": "/state/team/dashboard",
      "resourceKind": "task_dashboard",
      "requiredTopLevel": ["api", "resource", "query", "links", "dashboard"]
    }
  }
}
```

## Stable public routes

### Team / governance surfaces

- `/state/team`
- `/state/team/contracts`
- `/state/team/summary?taskId=...`
- `/state/team/workbench?taskId=...`
- `/state/team/governance?taskId=...`
- `/state/team/pipeline?taskId=...`
- `/state/team/board`
- `/state/team/dashboard`
- `/state/team/queue`
- `/state/team/archive`

### Troubleshooting / evidence chain

- `/state/team/tasks?teamId=...`
- `/state/team/mailbox?teamId=...&taskId=...`
- `/state/team/blackboard?taskId=...`
- `/state/team/artifacts?taskId=...`
- `/state/team/evidence?taskId=...`
- `/state/team/ingress?limit=...&originNode=...&deliveryTarget=...&recipientId=...&recipientType=...`

### Operational surfaces

- `/state/team/control?taskId=...`
- `/state/team/residents`
- `/state/team/nodes`
- `/state/team/observer?node=node-b`
- `/state/team/output-investigate?traceId=...`
- `/state/team/output-investigate?commandId=...`

## Compatibility rule

- Old route-specific fields are still preserved for backward compatibility.
- New consumers should anchor on the stable envelope first.
- Treat route-specific payloads as the second layer.

## How to consume

### Step 1：verify the envelope

Check:

- `ok === true`
- `api.contract === "team.governance.query.v1"`
- `api.version === "v1"`
- `api.stable === true`
- `resource` exists
- `query` exists
- `links` exists

### Step 2：branch by `api.route` or `api.resourceKind`

Recommended dispatch keys:

- `api.route`
- `api.resourceKind`

Example:

- `summary` → read `currentMemberKey`, `protocol`, `counters`
- `workbench` → read `summary`, `board`, `governance`
- `governance` → read `timeline`, `events`, `artifacts`, `counters`
- `pipeline` → read `pipeline`, `roles`, `issues`, `revisions`
- `mailbox` / `blackboard` / `artifacts` / `evidence` → read `items`

## Example responses

### Example：`/state/team/summary?taskId=...`

```json
{
  "ok": true,
  "api": {
    "namespace": "team.governance.query",
    "contract": "team.governance.query.v1",
    "version": "v1",
    "route": "summary",
    "resourceKind": "task_summary",
    "stable": true
  },
  "resource": {
    "kind": "task_summary",
    "taskId": "task:123",
    "teamId": "team:abc",
    "state": "approved",
    "batchId": "batch:xyz"
  },
  "query": {
    "taskId": "task:123"
  },
  "links": {
    "self": "/state/team/summary?taskId=task%3A123",
    "root": "/state/team",
    "contracts": "/state/team/contracts",
    "summary": "/state/team/summary?taskId=task%3A123",
    "workbench": "/state/team/workbench?taskId=task%3A123",
    "governance": "/state/team/governance?taskId=task%3A123",
    "pipeline": "/state/team/pipeline?taskId=task%3A123",
    "control": "/state/team/control?taskId=task%3A123"
  },
  "currentMemberKey": "judge.node-a",
  "protocolSource": "decision"
}
```

### Example：`/state/team/mailbox?...`

```json
{
  "ok": true,
  "api": {
    "route": "mailbox",
    "resourceKind": "mailbox_list"
  },
  "resource": {
    "kind": "mailbox_list",
    "taskId": "task:123",
    "teamId": "team:abc",
    "count": 12
  },
  "query": {
    "teamId": "team:abc",
    "taskId": "task:123"
  },
  "links": {
    "contracts": "/state/team/contracts"
  },
  "items": []
}
```

## Minimal client flow

1. `GET /state/team/contracts`
2. Read `queryContracts.featuredRouteKeys` and `queryContracts.featuredRoutes`
3. Fall back to `queryContracts.routes` for the full catalog
4. Fetch target route
5. Validate stable envelope
6. Dispatch by `api.route`
7. Read route-specific payload

## Contract assets

- `docs/api/team-governance-query-api/team-governance-query-api.schema.json`
- `src/team/query-api/types.d.ts`
- `src/team/query-api/query-contract.mjs`
- `src/team/query-api/sdk.mjs`

## Reference client

See:

- `scripts/team/team-query-api-client-example.mjs`
- `scripts/team/team-query-route-catalog-example.mjs`

### Recommended smoke

- `node scripts/team/team-query-api-client-example.mjs`

The live smoke will:

1. Fetch `/state/team/contracts`
2. Fetch `/state/team?view=all&activeOnly=false`
3. Auto-discover one live task from `governance.activeBatchOverview[0]` when no CLI taskId is provided
4. Run end-to-end validation for:
   - `/state/team/summary`
   - `/state/team/workbench`
   - `/state/team/governance`
   - `/state/team/pipeline`
   - `/state/team/control`
5. Highlight featured published surfaces from route catalog:
   - `workbenchPayload`
   - `residents`
   - `control`

## Published samples

Fuller real-run published fixtures live under:

- `fixtures/public-contracts/real-run/bridge-state.real-run.fixture.json`
- `fixtures/public-contracts/real-run/event-log.real-run.fixture.json`
- `fixtures/public-contracts/real-run/run-state.real-run.fixture.json`
- `fixtures/public-contracts/real-run/fixture-provenance.json`

The provenance manifest records:

- source run id / source run dir
- path sanitization rule
- truncation / sampling policy
- observed counts in each published sample

## Notes

- For human inspection, HTML views still exist for board / dashboard / output investigate.
- For machine consumption, prefer JSON routes only.
- If a task-scoped route is used, `links` will usually include sibling task routes.
