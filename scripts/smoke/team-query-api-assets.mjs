import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { TEAM_QUERY_API_CONTRACT, TEAM_QUERY_API_VERSION, TEAM_QUERY_ROUTE_CATALOG, buildStateQueryContracts } from '../../src/team/query-api/query-contract.mjs';
import { assertStableEnvelope } from '../../src/team/query-api/sdk.mjs';

const schemaPath = path.resolve('docs/api/team-governance-query-api/team-governance-query-api.schema.json');
const dtsPath = path.resolve('src/team/query-api/types.d.ts');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const dts = fs.readFileSync(dtsPath, 'utf8');

assert.equal(TEAM_QUERY_API_CONTRACT, 'team.governance.query.v1');
assert.equal(TEAM_QUERY_API_VERSION, 'v1');
assert.equal(String(schema?.properties?.api?.properties?.contract?.const || ''), TEAM_QUERY_API_CONTRACT);
assert.equal(String(schema?.properties?.api?.properties?.version?.const || ''), TEAM_QUERY_API_VERSION);
assert.equal(String(schema?.properties?.links?.properties?.contracts?.const || ''), '/state/team/contracts');
assert.ok(String(dts).includes('interface TeamQueryStableEnvelope'));
assert.ok(String(dts).includes('interface TeamQueryContractsRoute'));
assert.equal(String(TEAM_QUERY_ROUTE_CATALOG.outputInvestigate?.path || ''), '/state/team/output-investigate');
assert.equal(String(TEAM_QUERY_ROUTE_CATALOG.config?.path || ''), '/state/team/config');
const contracts = buildStateQueryContracts();
assert.equal(String(contracts?.routes?.nodes?.path || ''), '/state/team/nodes');
assert.equal(String(contracts?.routes?.observer?.path || ''), '/state/team/observer');
assert.equal(String(contracts?.routes?.control?.path || ''), '/state/team/control');
assert.equal(String(contracts?.routes?.config?.path || ''), '/state/team/config');

const sample = assertStableEnvelope({
  ok: true,
  api: {
    namespace: 'team.governance.query',
    contract: TEAM_QUERY_API_CONTRACT,
    version: TEAM_QUERY_API_VERSION,
    route: 'summary',
    resourceKind: 'task_summary',
    stable: true,
  },
  resource: { kind: 'task_summary', taskId: 'task:x' },
  query: { taskId: 'task:x' },
  links: { self: '/state/team/summary?taskId=task%3Ax', root: '/state/team', contracts: '/state/team/contracts' },
}, 'sample');

console.log(JSON.stringify({
  ok: true,
  summary: {
    contract: TEAM_QUERY_API_CONTRACT,
    version: TEAM_QUERY_API_VERSION,
    routeCount: Object.keys(TEAM_QUERY_ROUTE_CATALOG || {}).length,
    schemaPath,
    dtsPath,
    sampleRoute: sample.api.route,
  },
}, null, 2));
