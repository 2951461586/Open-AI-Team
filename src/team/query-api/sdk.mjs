import { TEAM_QUERY_API_CONTRACT, TEAM_QUERY_API_VERSION } from './query-contract.mjs';
import { loadIndexConfig } from '../index-env.mjs';
import { loadLiveEnvToken } from '../index-host-config.mjs';

function loadEnvToken(name) {
  return loadLiveEnvToken(name, loadIndexConfig());
}

function queryHeaders() {
  const dashboardToken = loadEnvToken('DASHBOARD_TOKEN');
  if (!dashboardToken) return {};
  return {
    'x-dashboard-token': dashboardToken,
    Authorization: `Bearer ${dashboardToken}`,
  };
}

export function assertStableEnvelope(payload, label = 'response') {
  if (!payload || typeof payload !== 'object') throw new Error(`${label}: payload_not_object`);
  if (payload.ok !== true) throw new Error(`${label}: ok_not_true`);
  if (String(payload?.api?.contract || '') !== TEAM_QUERY_API_CONTRACT) throw new Error(`${label}: unexpected_contract`);
  if (String(payload?.api?.version || '') !== TEAM_QUERY_API_VERSION) throw new Error(`${label}: unexpected_version`);
  if (payload?.api?.stable !== true) throw new Error(`${label}: stable_not_true`);
  if (!payload.resource || typeof payload.resource !== 'object') throw new Error(`${label}: resource_missing`);
  if (!payload.query || typeof payload.query !== 'object') throw new Error(`${label}: query_missing`);
  if (!payload.links || typeof payload.links !== 'object') throw new Error(`${label}: links_missing`);
  return payload;
}

export async function getJson(base, routePath) {
  const res = await fetch(`${String(base || '').replace(/\/$/, '')}${routePath}`, { headers: queryHeaders() });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`non_json_response: ${routePath}`);
  }
  if (!res.ok) {
    throw new Error(`http_${res.status}: ${routePath}: ${JSON.stringify(data)}`);
  }
  return data;
}

export function buildTaskRoute(pathname, taskId, extra = {}) {
  const q = new URLSearchParams({ taskId: String(taskId || ''), ...Object.fromEntries(Object.entries(extra || {}).filter(([, v]) => v != null && v !== '')) });
  return `${pathname}?${q.toString()}`;
}

export async function fetchStable(base, routePath, label = 'response') {
  return assertStableEnvelope(await getJson(base, routePath), label);
}

export async function fetchContracts(base) {
  return fetchStable(base, '/state/team/contracts', 'contracts');
}

export function selectPublishedRouteCatalog(contractsPayload) {
  const featured = contractsPayload?.queryContracts?.featuredRoutes;
  if (featured && typeof featured === 'object') return featured;
  const routes = contractsPayload?.queryContracts?.routes || {};
  return {
    workbenchPayload: routes.workbenchPayload || null,
    residents: routes.residents || null,
    control: routes.control || null,
    summary: routes.summary || null,
    pipeline: routes.pipeline || null,
    dashboard: routes.dashboard || null,
  };
}

export async function fetchRoot(base) {
  return fetchStable(base, '/state/team?view=all&activeOnly=false', 'root');
}

export function discoverLiveTaskId(rootPayload) {
  const active = ((rootPayload?.governance || {}).activeBatchOverview || []);
  const first = active.find((item) => item?.taskId);
  if (!first?.taskId) throw new Error('no_live_task_found');
  return String(first.taskId);
}

export async function fetchTaskBundle(base, taskId) {
  const safeTaskId = String(taskId || '').trim();
  if (!safeTaskId) throw new Error('task_id_required');
  const [summary, workbench, governance, pipeline, control] = await Promise.all([
    fetchStable(base, buildTaskRoute('/state/team/summary', safeTaskId), 'summary'),
    fetchStable(base, buildTaskRoute('/state/team/workbench', safeTaskId), 'workbench'),
    fetchStable(base, buildTaskRoute('/state/team/governance', safeTaskId, { limit: 20 }), 'governance'),
    fetchStable(base, buildTaskRoute('/state/team/pipeline', safeTaskId), 'pipeline'),
    fetchStable(base, buildTaskRoute('/state/team/control', safeTaskId), 'control'),
  ]);
  return { summary, workbench, governance, pipeline, control };
}

export async function fetchPublishedTaskReadModels(base, taskId) {
  const { summary, workbench, governance, pipeline, control } = await fetchTaskBundle(base, taskId);
  return { summary, workbench, governance, pipeline, control };
}

export async function fetchResidents(base) {
  return fetchStable(base, '/state/team/residents', 'residents');
}
