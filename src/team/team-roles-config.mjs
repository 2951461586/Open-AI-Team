import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_NODE_ID, canonicalNodeId, normalizeNodeMap, resolveNodeReachable } from './team-node-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// team-roles-config.mjs lives in src/team/, config lives in config/ (sibling of src/)
const PRIMARY_CONFIG_PATH = path.resolve(__dirname, '..', '..', 'config', 'team', 'roles.json');
const LEGACY_CONFIG_PATH = path.resolve(__dirname, '..', '..', 'config', 'team-roles.json');
const DEFAULT_CONFIG_PATH = PRIMARY_CONFIG_PATH;

let _cachedConfig = null;
let _cachedMtime = 0;
let _cachedPath = '';
let _lastResolutionWarning = '';
let _lastResolution = null;

/**
 * 加载声明式角色配置。
 * 支持热重载：文件修改后自动刷新（基于 mtime）。
 */
export function loadTeamRolesConfig(configPath = DEFAULT_CONFIG_PATH) {
  const requested = path.resolve(configPath);
  const resolved = resolveConfigPath(configPath, {
    allowLegacyFallback: requested === PRIMARY_CONFIG_PATH,
  });
  const abs = resolved.path;
  _lastResolution = {
    requestedPath: requested,
    resolvedPath: abs || '',
    resolution: resolved.resolution || 'missing',
    usedLegacy: resolved.usedLegacy === true,
    allowLegacyFallback: requested === PRIMARY_CONFIG_PATH,
    warning: resolved.warning || '',
    exists: {
      primary: fs.existsSync(PRIMARY_CONFIG_PATH),
      legacy: fs.existsSync(LEGACY_CONFIG_PATH),
      resolved: !!abs,
    },
  };
  if (resolved.warning && resolved.warning !== _lastResolutionWarning) {
    console.warn(resolved.warning);
    _lastResolutionWarning = resolved.warning;
  }
  if (!abs) {
    console.warn(`[team-roles-config] config not found: ${requested}, using empty defaults`);
    return buildEmptyConfig();
  }

  const stat = fs.statSync(abs);
  const mtime = stat.mtimeMs || 0;

  if (_cachedConfig && abs === _cachedPath && mtime === _cachedMtime) {
    return _cachedConfig;
  }

  const raw = fs.readFileSync(abs, 'utf8');
  const parsed = JSON.parse(raw);
  _cachedConfig = normalizeConfig(parsed);
  _cachedMtime = mtime;
  _cachedPath = abs;
  console.log(`[team-roles-config] loaded ${Object.keys(_cachedConfig.roles).length} roles from ${abs}`);
  return _cachedConfig;
}

/**
 * 强制重新加载配置（忽略 mtime 缓存）。
 */
export function reloadTeamRolesConfig(configPath = DEFAULT_CONFIG_PATH) {
  _cachedConfig = null;
  _cachedMtime = 0;
  _cachedPath = '';
  _lastResolutionWarning = '';
  _lastResolution = null;
  return loadTeamRolesConfig(configPath);
}

function resolveConfigPath(configPath = DEFAULT_CONFIG_PATH, opts = {}) {
  const requested = path.resolve(configPath);
  const allowLegacyFallback = opts.allowLegacyFallback === true;

  if (fs.existsSync(requested)) {
    const explicitLegacy = requested === LEGACY_CONFIG_PATH;
    return {
      path: requested,
      resolution: explicitLegacy ? 'legacy_explicit' : requested === PRIMARY_CONFIG_PATH ? 'primary' : 'custom_explicit',
      usedLegacy: explicitLegacy,
      warning: explicitLegacy
        ? `[team-roles-config] using explicit legacy compat config: ${LEGACY_CONFIG_PATH}; prefer ${PRIMARY_CONFIG_PATH}`
        : '',
    };
  }

  if (requested === PRIMARY_CONFIG_PATH && allowLegacyFallback && fs.existsSync(LEGACY_CONFIG_PATH)) {
    return {
      path: LEGACY_CONFIG_PATH,
      resolution: 'legacy_fallback',
      usedLegacy: true,
      warning: `[team-roles-config] primary config missing at ${PRIMARY_CONFIG_PATH}; falling back to legacy compat config ${LEGACY_CONFIG_PATH}`,
    };
  }

  return { path: '', resolution: 'missing', usedLegacy: false, warning: '' };
}

function buildEmptyConfig() {
  return {
    version: '0.0.0',
    defaults: {},
    roles: {},
    routing: { mailboxKindToRole: {} },
    nodeMap: {},
  };
}

function normalizeConfig(raw = {}) {
  const defaults = raw.defaults || {};
  const roles = {};
  const rawRoles = raw.roles || {};

  for (const [key, role] of Object.entries(rawRoles)) {
    roles[key] = {
      role: key,
      displayName: String(role.displayName || key),
      description: String(role.description || ''),
      capabilities: Array.isArray(role.capabilities) ? role.capabilities : [],
      preferredNode: canonicalNodeId(role.preferredNode || defaults.preferredNode || DEFAULT_NODE_ID),
      fallbackNode: canonicalNodeId(role.fallbackNode || defaults.fallbackNode || DEFAULT_NODE_ID),
      outwardIdentity: String(role.outwardIdentity || defaults.outwardIdentity || 'authority'),
      workspace: String(role.workspace || `team-agents/${key}`),
      memoryScope: String(role.memoryScope || `team/${key}`),
      model: role.model || defaults.model || null,
      runtime: String(role.runtime || defaults.runtime || ''),
      baseUrl: String(role.baseUrl || defaults.baseUrl || ''),
      apiKey: String(role.apiKey || defaults.apiKey || ''),
      timeoutMs: Number(role.timeoutMs || defaults.timeoutMs || role.sessionTimeout || defaults.sessionTimeout || 120000),
      maxConcurrentTasks: Number(role.maxConcurrentTasks || defaults.maxConcurrentTasks || 1),
      sessionTimeout: Number(role.sessionTimeout || defaults.sessionTimeout || 120000),
      contract: role.contract || null,
      prompt: role.prompt || null,
      personality: role.personality && typeof role.personality === 'object' ? role.personality : null,
      activePersonality: String(role.activePersonality || role.personality?.active || ''),
      scenarios: role.scenarios && typeof role.scenarios === 'object' ? role.scenarios : null,
    };
  }

  return {
    version: String(raw.version || '0.0.0'),
    defaults,
    roles,
    routing: {
      mailboxKindToRole: raw.routing?.mailboxKindToRole || {
        'task.assign': 'planner',
        'review.request': 'critic',
        'decision.request': 'judge',
        'output.request': 'output',
      },
    },
    nodeMap: normalizeNodeMap(raw.nodeMap || {}),
  };
}

/**
 * 获取指定角色的完整配置。
 */
export function getRoleConfig(role = '', configPath) {
  const config = loadTeamRolesConfig(configPath);
  return config.roles[String(role || '').trim()] || null;
}

/**
 * 列出所有角色。
 */
export function listRoles(configPath) {
  const config = loadTeamRolesConfig(configPath);
  return Object.values(config.roles);
}

/**
 * 按 mailbox kind 解析角色。
 */
export function resolveRoleByMailboxKind(kind = '', configPath) {
  const config = loadTeamRolesConfig(configPath);
  const role = config.routing.mailboxKindToRole[String(kind || '').trim()] || '';
  return role ? config.roles[role] || null : null;
}

/**
 * 解析角色部署信息（含 fallback）。
 */
export function resolveRoleDeployment(role = '', opts = {}, configPath) {
  const roleConfig = getRoleConfig(role, configPath);
  if (!roleConfig) return null;

  const config = loadTeamRolesConfig(configPath);
  const preferred = canonicalNodeId(roleConfig.preferredNode || DEFAULT_NODE_ID);
  const fallback = canonicalNodeId(roleConfig.fallbackNode || preferred || DEFAULT_NODE_ID);
  const nodeInfo = config.nodeMap[preferred] || {};
  const preferredReachable = resolveNodeReachable(opts, preferred);

  const selectedNode = (!preferredReachable && fallback)
    ? fallback
    : preferred;

  const workspaceRoot = String(opts.workspaceRoot || process.env.TEAM_WORKSPACE_ROOT || process.env.WORKSPACE_ROOT || process.cwd());

  return {
    ...roleConfig,
    selectedNode,
    degraded: selectedNode !== preferred,
    workspaceFull: path.resolve(workspaceRoot, roleConfig.workspace),
    nodeInfo: config.nodeMap[selectedNode] || {},
  };
}

/**
 * 获取角色的 contract 配置（兼容旧 team-role-contracts.mjs）。
 */
export function getRoleContractFromConfig(role = '', configPath) {
  const roleConfig = getRoleConfig(role, configPath);
  return roleConfig?.contract || null;
}

/**
 * 获取节点信息。
 */
export function getNodeConfig(nodeId = '', configPath) {
  const config = loadTeamRolesConfig(configPath);
  return config.nodeMap[String(nodeId || '').trim()] || null;
}

export function getTeamRolesConfigStatus() {
  return {
    primaryPath: PRIMARY_CONFIG_PATH,
    legacyPath: LEGACY_CONFIG_PATH,
    defaultPath: DEFAULT_CONFIG_PATH,
    cachedPath: _cachedPath,
    resolution: _lastResolution || {
      requestedPath: DEFAULT_CONFIG_PATH,
      resolvedPath: '',
      resolution: 'unknown',
      usedLegacy: false,
      allowLegacyFallback: true,
      warning: '',
      exists: {
        primary: fs.existsSync(PRIMARY_CONFIG_PATH),
        legacy: fs.existsSync(LEGACY_CONFIG_PATH),
        resolved: false,
      },
    },
  };
}
