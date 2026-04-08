import fs from 'node:fs/promises';
import path from 'node:path';

async function ensureDir(dir = '') {
  if (!dir) return;
  await fs.mkdir(dir, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function uniqueById(items = []) {
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(items) ? items : []) {
    const id = String(item?.id || item?.name || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

function defaultContributesFor(ref = {}) {
  const kind = String(ref?.kind || 'generic');
  if (kind === 'bridge') {
    return {
      tools: [{ id: 'bridge.route', kind: 'tool', note: 'route message via bridge adapter' }],
      skills: [{ id: 'bridge.channel-routing', kind: 'skill' }],
      bridgeRoutes: ['local-thread', 'telegram-scaffold', 'feishu-scaffold'],
      shellCommands: ['routes'],
    };
  }
  if (kind === 'lifecycle') {
    return {
      tools: [{ id: 'lifecycle.snapshot', kind: 'tool', note: 'inspect lifecycle runtime state' }],
      skills: [{ id: 'lifecycle.heartbeat', kind: 'skill' }, { id: 'lifecycle.cron', kind: 'skill' }],
      bridgeRoutes: [],
      shellCommands: [],
    };
  }
  if (kind === 'shell') {
    return {
      tools: [{ id: 'shell.inspect', kind: 'tool', note: 'inspect shell runtime state' }],
      skills: [{ id: 'shell.observability', kind: 'skill' }],
      bridgeRoutes: [],
      shellCommands: ['capabilities'],
    };
  }
  return { tools: [], skills: [], bridgeRoutes: [], shellCommands: [] };
}

function normalizeContributes(ref = {}) {
  const defaults = defaultContributesFor(ref);
  const contributes = ref?.contributes && typeof ref.contributes === 'object' ? ref.contributes : {};
  return {
    tools: uniqueById((Array.isArray(contributes.tools) ? contributes.tools : defaults.tools).map((item) => ({
      ...item,
      id: String(item?.id || ''),
      kind: 'tool',
      sourcePluginId: String(ref?.pluginId || ''),
    }))),
    skills: uniqueById((Array.isArray(contributes.skills) ? contributes.skills : defaults.skills).map((item) => ({
      ...item,
      id: String(item?.id || ''),
      kind: 'skill',
      sourcePluginId: String(ref?.pluginId || ''),
    }))),
    bridgeRoutes: Array.isArray(contributes.bridgeRoutes) ? contributes.bridgeRoutes.map((item) => String(item || '')).filter(Boolean) : defaults.bridgeRoutes,
    shellCommands: Array.isArray(contributes.shellCommands) ? contributes.shellCommands.map((item) => String(item || '')).filter(Boolean) : defaults.shellCommands,
  };
}

function normalizeRefs(pluginRefs = []) {
  return (Array.isArray(pluginRefs) ? pluginRefs : []).map((ref, index) => ({
    pluginId: String(ref?.pluginId || `plugin:${index + 1}`),
    kind: String(ref?.kind || 'generic'),
    enabled: ref?.enabled !== false,
    hooks: Array.isArray(ref?.hooks) && ref.hooks.length > 0
      ? ref.hooks.map((item) => String(item || '')).filter(Boolean)
      : ['run.created', 'resume.started', 'member.completed', 'run.completed'],
    contributes: normalizeContributes(ref),
  }));
}

export function createLocalPluginSystem({ registryPath = '', eventsPath = '', pluginRefs = [], eventBus = null } = {}) {
  const refs = normalizeRefs(pluginRefs);
  const events = [];
  let hookInvocationCount = 0;

  function getInjectedCapabilities() {
    const tools = [];
    const skills = [];
    const bridgeRoutes = [];
    const shellCommands = [];
    for (const ref of refs) {
      if (ref.enabled === false) continue;
      tools.push(...(ref.contributes?.tools || []));
      skills.push(...(ref.contributes?.skills || []));
      bridgeRoutes.push(...(ref.contributes?.bridgeRoutes || []));
      shellCommands.push(...(ref.contributes?.shellCommands || []));
    }
    return {
      tools: uniqueById(tools),
      skills: uniqueById(skills),
      bridgeRoutes: [...new Set(bridgeRoutes.map((item) => String(item || '').trim()).filter(Boolean))],
      shellCommands: [...new Set(shellCommands.map((item) => String(item || '').trim()).filter(Boolean))],
    };
  }

  async function persist() {
    await ensureDir(path.dirname(registryPath));
    await ensureDir(path.dirname(eventsPath));
    await fs.writeFile(registryPath, JSON.stringify({
      contractVersion: 'agent-harness-plugins.v1',
      generatedAt: nowIso(),
      pluginCount: refs.length,
      hookInvocationCount,
      injectedCapabilities: getInjectedCapabilities(),
      plugins: refs,
    }, null, 2));
    await fs.writeFile(eventsPath, JSON.stringify({
      contractVersion: 'agent-harness-plugin-events.v1',
      generatedAt: nowIso(),
      hookInvocationCount,
      events,
    }, null, 2));
  }

  async function init() {
    events.push({ type: 'plugins.initialized', pluginCount: refs.length, at: nowIso() });
    eventBus?.emit?.({ type: 'plugins.initialized', pluginCount: refs.length });
    await persist();
    return { registryPath, eventsPath, pluginCount: refs.length, hookInvocationCount };
  }

  function list() {
    return [...refs];
  }

  async function emit(type = '', payload = {}) {
    events.push({ type: String(type || 'plugin.event'), payload, at: nowIso() });
    eventBus?.emit?.({ type: `plugin.${String(type || 'event')}`, payload });
    await persist();
  }

  async function runHook(hook = '', payload = {}) {
    const hookName = String(hook || '').trim();
    if (!hookName) return [];
    const matched = refs.filter((ref) => ref.enabled !== false && Array.isArray(ref.hooks) && ref.hooks.includes(hookName));
    const records = matched.map((ref) => ({
      type: 'plugin.hook',
      hook: hookName,
      pluginId: ref.pluginId,
      kind: ref.kind,
      payload,
      at: nowIso(),
    }));
    hookInvocationCount += records.length;
    events.push(...records);
    for (const record of records) {
      eventBus?.emit?.({ type: 'plugin.hook.executed', hook: record.hook, pluginId: record.pluginId, kind: record.kind });
    }
    await persist();
    return records;
  }

  return {
    kind: 'plugin_system',
    contractVersion: 'agent-harness-plugins.v1',
    init,
    list,
    emit,
    runHook,
    getInjectedCapabilities,
    getStats() {
      const injected = getInjectedCapabilities();
      return {
        pluginCount: refs.length,
        hookInvocationCount,
        injectedToolCount: injected.tools.length,
        injectedSkillCount: injected.skills.length,
        bridgeRouteCount: injected.bridgeRoutes.length,
        shellCommandCount: injected.shellCommands.length,
      };
    },
    paths: { registryPath, eventsPath },
  };
}
