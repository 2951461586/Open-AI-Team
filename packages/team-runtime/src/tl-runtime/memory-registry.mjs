import path from 'node:path';
import { createMemoryCore, sanitizeScope } from './memory-core.mjs';
import { loadMemorySettings, resolveMemoryScope } from '../memory-settings.mjs';
import { loadTeamRolesConfig } from '../team-roles-config.mjs';

export function createMemoryRegistry({ settings = null, configPath = null, rolesConfig = null, workspaceRoot = process.cwd() } = {}) {
  const effectiveSettings = settings || loadMemorySettings(configPath ? { configPath } : {});
  const effectiveRoles = rolesConfig || loadTeamRolesConfig();
  const registry = new Map();

  function resolveScopeForRole(role = '') {
    return sanitizeScope(resolveMemoryScope(role, { roles: effectiveRoles.roles, settings: effectiveSettings }));
  }

  function get(scope = '') {
    const resolvedScope = sanitizeScope(scope || 'team/runtime');
    if (!registry.has(resolvedScope)) {
      registry.set(resolvedScope, createMemoryCore({
        scope: resolvedScope,
        baseDir: path.resolve(workspaceRoot, effectiveSettings.persistence.baseDir),
        settings: effectiveSettings,
      }));
    }
    return registry.get(resolvedScope);
  }

  function forRole(role = '') {
    return get(resolveScopeForRole(role));
  }

  function writeForRole(role = '', entry = {}) {
    return forRole(role).write({ ...entry, scope: resolveScopeForRole(role), agentId: entry.agentId || role || 'runtime' });
  }

  function recallForRole(role = '', query = '', opts = {}) {
    return forRole(role).recall(query, opts);
  }

  function sweepAll() {
    const targets = new Set(['team/runtime']);
    for (const role of Object.keys(effectiveRoles.roles || {})) targets.add(resolveScopeForRole(role));
    const results = [];
    for (const scope of targets) results.push(get(scope).sweep());
    return results;
  }

  function buildProvider(role = '') {
    const core = forRole(role);
    return {
      kind: 'memory_provider',
      scope: core.scope,
      retrieve(query = '', { limit = effectiveSettings.retrieval.defaultLimit } = {}) {
        return core.recall(query, { limit }).hits.map((item) => ({
          scope: core.scope,
          id: item.id,
          title: item.category || 'memory',
          score: item.score,
          snippet: String(item.text || '').slice(0, 240),
          category: item.category,
          tags: item.tags || [],
        }));
      },
      write(entry = {}) {
        return core.write({ ...entry, agentId: entry.agentId || role || 'runtime' });
      },
      flush() {
        return { ok: true, scope: core.scope, paths: core.paths };
      },
    };
  }

  return {
    kind: 'team_memory_registry',
    settings: effectiveSettings,
    roles: effectiveRoles,
    resolveScopeForRole,
    get,
    forRole,
    writeForRole,
    recallForRole,
    sweepAll,
    buildProvider,
    listScopes() {
      return [...new Set(['team/runtime', ...Object.keys(effectiveRoles.roles || {}).map((role) => resolveScopeForRole(role)), ...registry.keys()])];
    },
  };
}
