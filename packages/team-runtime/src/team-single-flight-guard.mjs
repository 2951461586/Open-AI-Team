/**
 * team-single-flight-guard.mjs
 *
 * Scope-level single-flight guard for TL runtime.
 * Reuses the latest active root task in the same scope within a bounded
 * time window, turning duplicate task ingress into task follow-up.
 */

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeStateSet(value, fallback = []) {
  const out = new Set();
  for (const item of ensureArray(value)) {
    const normalized = String(item || '').trim().toLowerCase();
    if (normalized) out.add(normalized);
  }
  if (out.size === 0) {
    for (const item of fallback) out.add(String(item || '').trim().toLowerCase());
  }
  return out;
}

export function getSingleFlightConfig(governanceRuntime) {
  const raw = governanceRuntime?.getConfig?.()?.singleFlight || {};
  const followUpEventKinds = ensureArray(raw.followUpEventKinds)
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  return {
    enabled: raw.enabled !== false,
    scopeWindowMs: Math.max(0, Number(raw.scopeWindowMs || 20 * 60 * 1000)),
    maxScopeTeamsToScan: Math.max(1, Number(raw.maxScopeTeamsToScan || 10)),
    blockTerminalStates: normalizeStateSet(raw.blockTerminalStates, ['done', 'cancelled']),
    reuseActiveOnly: raw.reuseActiveOnly !== false,
    followUpEventKinds: followUpEventKinds.length > 0
      ? followUpEventKinds
      : ['single_flight.hit', 'single_flight.follow_up'],
  };
}

export function isReusableScopeTask(task = {}, config = {}, nowMs = Date.now()) {
  if (!task || typeof task !== 'object') return false;
  if (String(task.parentTaskId || '').trim()) return false;

  const state = String(task.state || '').trim().toLowerCase();
  const terminalStates = config.blockTerminalStates instanceof Set
    ? config.blockTerminalStates
    : normalizeStateSet(config.blockTerminalStates, ['done', 'cancelled']);
  if (terminalStates.has(state)) return false;
  if (config.reuseActiveOnly && !state) return false;

  const meta = task.metadata && typeof task.metadata === 'object' ? task.metadata : {};
  if (meta.singleFlightDisabled === true) return false;

  const updatedAt = Number(task.updatedAt || task.createdAt || 0);
  if (!updatedAt) return false;
  if (Number(config.scopeWindowMs || 0) > 0 && (nowMs - updatedAt) > Number(config.scopeWindowMs || 0)) return false;

  return true;
}

export function findSingleFlightCandidate({ teamStore, scopeKey = '', nowMs = Date.now(), config = {} } = {}) {
  if (!teamStore?.listTeamsByScope || !teamStore?.listTasksByTeam) return null;
  const normalizedScope = String(scopeKey || '').trim();
  if (!normalizedScope) return null;

  const teams = ensureArray(teamStore.listTeamsByScope(normalizedScope)).slice(0, Number(config.maxScopeTeamsToScan || 10));
  const candidates = [];

  for (const team of teams) {
    const tasks = ensureArray(teamStore.listTasksByTeam(String(team?.teamId || '')));
    for (const task of tasks) {
      if (!isReusableScopeTask(task, config, nowMs)) continue;
      candidates.push({
        task,
        team,
        updatedAt: Number(task.updatedAt || task.createdAt || 0),
      });
    }
  }

  candidates.sort((a, b) => b.updatedAt - a.updatedAt);
  return candidates[0] || null;
}
