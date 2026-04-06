/**
 * team-role-deployment.mjs — 声明式配置驱动版
 *
 * 兼容旧接口 get(role) / list() / resolve(role, opts)
 * 数据源从硬编码切换为 config/team/roles.json（保留对旧 config/team-roles.json 的兼容回退）
 */
import { loadTeamRolesConfig } from './team-roles-config.mjs';
import { DEFAULT_NODE_ID, OBSERVER_NODE_ID, canonicalNodeId, resolveNodeReachable } from './team-node-ids.mjs';

export function loadTeamRoleDeployment(env = {}) {
  const root = String(env.TEAM_WORKSPACE_ROOT || env.WORKSPACE_ROOT || process.cwd());
  const defaultAuthority = canonicalNodeId(String(env.TEAM_AUTHORITY_NODE || DEFAULT_NODE_ID).trim() || DEFAULT_NODE_ID);

  function getConfig() {
    return loadTeamRolesConfig();
  }

  function buildDeploymentItem(roleConfig) {
    if (!roleConfig) return null;
    return {
      role: roleConfig.role,
      displayName: roleConfig.displayName || roleConfig.role,
      preferredNode: canonicalNodeId(roleConfig.preferredNode || DEFAULT_NODE_ID),
      fallbackNode: canonicalNodeId(roleConfig.fallbackNode || DEFAULT_NODE_ID),
      workspace: `${root}/${roleConfig.workspace || `team-agents/${roleConfig.role}`}`,
      memoryScope: roleConfig.memoryScope || `team/${roleConfig.role}`,
      outwardIdentity: roleConfig.outwardIdentity || 'authority',
      capabilities: roleConfig.capabilities || [],
      model: roleConfig.model || null,
      runtime: roleConfig.runtime || '',
      baseUrl: roleConfig.baseUrl || '',
      apiKey: roleConfig.apiKey || '',
      timeoutMs: roleConfig.timeoutMs || roleConfig.sessionTimeout || 120000,
      maxConcurrentTasks: roleConfig.maxConcurrentTasks || 1,
      sessionTimeout: roleConfig.sessionTimeout || 120000,
      contract: roleConfig.contract || null,
      prompt: roleConfig.prompt || null,
      personality: roleConfig.personality || null,
      activePersonality: roleConfig.activePersonality || '',
      scenarios: roleConfig.scenarios || null,
    };
  }

  const authority = {
    node: defaultAuthority,
    outwardIdentity: 'authority',
    outputNode: defaultAuthority,
  };

  function get(role = '') {
    const config = getConfig();
    const key = String(role || '').trim();
    const roleConfig = config.roles[key];
    if (!roleConfig) return null;
    return buildDeploymentItem(roleConfig);
  }

  function list() {
    const config = getConfig();
    const result = {};
    for (const [key, roleConfig] of Object.entries(config.roles)) {
      result[key] = buildDeploymentItem(roleConfig);
    }
    result.authority = authority;
    return result;
  }

  function resolve(role = '', opts = {}) {
    const item = get(role);
    if (!item) return null;
    const preferredReachable = resolveNodeReachable(opts, item.preferredNode || OBSERVER_NODE_ID);
    const selectedNode = (!preferredReachable)
      ? canonicalNodeId(item.fallbackNode || defaultAuthority)
      : canonicalNodeId(item.preferredNode || defaultAuthority);
    return {
      ...item,
      selectedNode,
      degraded: selectedNode !== item.preferredNode,
    };
  }

  return {
    authority,
    get,
    list,
    resolve,
  };
}
