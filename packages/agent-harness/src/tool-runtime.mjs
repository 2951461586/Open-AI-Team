import fs from 'node:fs/promises';
import path from 'node:path';
import { createToolAuditLog } from './tool-audit.mjs';
import { createToolExecutionEnvelope } from './execution-envelope.mjs';
import { createToolValidator } from './tool-providers.mjs';

function normalizeText(value = '') {
  return String(value || '').trim();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];
}

function cloneJson(value) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

function normalizeRole(value = '') {
  return normalizeText(value).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

async function ensureDir(dir = '') {
  if (!dir) return;
  await fs.mkdir(dir, { recursive: true });
}

function defaultActor(context = {}) {
  return {
    id: normalizeText(context?.actor?.id || context?.agentId || context?.role || 'unknown'),
    role: normalizeRole(context?.actor?.role || context?.role || 'unknown'),
    type: normalizeText(context?.actor?.type || 'agent'),
  };
}

function buildLegacyToolRegistry() {
  return [
    {
      id: 'fs.write_text',
      title: 'Write text file',
      description: 'Write a text file through the sandbox.',
      permissions: { public: true, allowRoles: ['*'] },
      inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path'], additionalProperties: true },
      outputSchema: { type: 'object', properties: { path: { type: 'string' }, bytes: { type: 'integer' } }, required: ['path', 'bytes'], additionalProperties: true },
      execute: async ({ sandbox, args }) => {
        const resolved = await sandbox.writeText(args.path, args.content || '');
        return { path: resolved, bytes: String(args.content || '').length };
      },
    },
    {
      id: 'fs.append_text',
      title: 'Append text file',
      description: 'Append text to a file through the sandbox.',
      permissions: { public: true, allowRoles: ['*'] },
      inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path'], additionalProperties: true },
      outputSchema: { type: 'object', properties: { path: { type: 'string' }, bytes: { type: 'integer' } }, required: ['path', 'bytes'], additionalProperties: true },
      execute: async ({ sandbox, args }) => {
        const resolved = await sandbox.appendText(args.path, args.content || '');
        return { path: resolved, bytes: String(args.content || '').length };
      },
    },
    {
      id: 'fs.read_text',
      title: 'Read text file',
      description: 'Read a text file through the sandbox.',
      permissions: { public: true, allowRoles: ['*'] },
      inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: true },
      outputSchema: { type: 'object', properties: { path: { type: 'string' }, text: { type: 'string' }, bytes: { type: 'integer' } }, required: ['path', 'text', 'bytes'], additionalProperties: true },
      execute: async ({ sandbox, args }) => {
        const text = await sandbox.readText(args.path);
        return { path: sandbox.resolvePath(args.path), text, bytes: text.length };
      },
    },
    {
      id: 'fs.list',
      title: 'List workspace',
      description: 'List files through the sandbox.',
      permissions: { public: true, allowRoles: ['*'] },
      inputSchema: { type: 'object', properties: { path: { type: 'string' }, recursive: { type: 'boolean' } }, additionalProperties: true },
      outputSchema: { type: 'object', properties: { items: { type: 'array' }, count: { type: 'integer' } }, required: ['items', 'count'], additionalProperties: true },
      execute: async ({ sandbox, args }) => {
        const items = await sandbox.list(args.path || '.', { recursive: !!args.recursive });
        return { items, count: items.length };
      },
    },
    {
      id: 'text.search',
      title: 'Search text',
      description: 'Search text through the sandbox.',
      permissions: { public: true, allowRoles: ['*'] },
      inputSchema: { type: 'object', properties: { path: { type: 'string' }, query: { type: 'string' } }, additionalProperties: true },
      outputSchema: { type: 'object', properties: { hits: { type: 'array' }, count: { type: 'integer' } }, required: ['hits', 'count'], additionalProperties: true },
      execute: async ({ sandbox, args }) => {
        const hits = await sandbox.searchText(args.path || '.', args.query || '');
        return { hits, count: hits.length };
      },
    },
    {
      id: 'workspace.snapshot',
      title: 'Workspace snapshot',
      description: 'Snapshot workspace files.',
      permissions: { public: true, allowRoles: ['*'] },
      inputSchema: { type: 'object', properties: {}, additionalProperties: true },
      outputSchema: { type: 'object', properties: { items: { type: 'array' }, count: { type: 'integer' } }, required: ['items', 'count'], additionalProperties: true },
      execute: async ({ sandbox }) => {
        const items = await sandbox.list('.', { recursive: true });
        return { items, count: items.length };
      },
    },
    {
      id: 'memory.retrieve',
      title: 'Retrieve memory',
      description: 'Retrieve from memory provider.',
      permissions: { public: true, allowRoles: ['*'] },
      inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer' } }, additionalProperties: true },
      outputSchema: { type: 'object', properties: { query: { type: 'string' }, hits: { type: 'array' }, count: { type: 'integer' } }, required: ['query', 'hits', 'count'], additionalProperties: true },
      execute: async ({ memoryProvider, args }) => {
        if (!memoryProvider?.retrieve) throw new Error('memory_provider_unavailable');
        const hits = await memoryProvider.retrieve(args.query || '', { limit: Number(args.limit || 5) || 5 });
        return { query: String(args.query || ''), hits, count: hits.length };
      },
    },
    {
      id: 'command.exec',
      title: 'Execute command',
      description: 'Run a command through command runtime.',
      permissions: { public: true, allowRoles: ['*'] },
      inputSchema: { type: 'object', properties: { command: { type: 'string' }, args: { type: 'array' }, cwd: { type: 'string' } }, required: ['command'], additionalProperties: true },
      outputSchema: { type: 'object', additionalProperties: true },
      execute: async ({ commandRuntime, sandbox, args }) => {
        if (!commandRuntime?.execCommand) throw new Error('command_runtime_unavailable');
        const result = await commandRuntime.execCommand(args.command || '', Array.isArray(args.args) ? args.args : [], { cwd: args.cwd || sandbox.baseDir });
        if (!result.ok) throw new Error(result.timedOut ? 'command_timeout' : `command_failed:${result.exitCode}`);
        return result;
      },
    },
    {
      id: 'bridge.route',
      title: 'Bridge route',
      description: 'Route outbound message through bridge host.',
      permissions: { public: true, allowRoles: ['*'] },
      inputSchema: { type: 'object', properties: { routeKey: { type: 'string' }, channel: { type: 'string' }, text: { type: 'string' }, kind: { type: 'string' }, messageId: { type: 'string' } }, additionalProperties: true },
      outputSchema: { type: 'object', properties: { routed: {} }, required: ['routed'], additionalProperties: true },
      execute: async ({ bridgeHost, args }) => {
        if (!bridgeHost?.routeMessage) throw new Error('bridge_host_unavailable');
        const routed = await bridgeHost.routeMessage({ routeKey: args.routeKey || args.channel || '', channel: args.channel || '', text: args.text || '', kind: args.kind || 'route', messageId: args.messageId || '' });
        return { routed };
      },
    },
    {
      id: 'lifecycle.snapshot',
      title: 'Lifecycle snapshot',
      description: 'Read lifecycle runtime state.',
      permissions: { public: true, allowRoles: ['*'] },
      inputSchema: { type: 'object', properties: {}, additionalProperties: true },
      outputSchema: { type: 'object', properties: { lifecycle: {}, available: { type: 'boolean' } }, required: ['lifecycle', 'available'], additionalProperties: true },
      execute: async ({ lifecycleRuntime }) => ({ lifecycle: lifecycleRuntime?.paths || {}, available: !!lifecycleRuntime }),
    },
    {
      id: 'shell.inspect',
      title: 'Shell inspect',
      description: 'Read product shell state.',
      permissions: { public: true, allowRoles: ['*'] },
      inputSchema: { type: 'object', properties: {}, additionalProperties: true },
      outputSchema: { type: 'object', properties: { shell: {}, available: { type: 'boolean' } }, required: ['shell', 'available'], additionalProperties: true },
      execute: async ({ productShell }) => ({ shell: productShell?.paths || {}, available: !!productShell }),
    },
  ];
}

function checkCapabilityAccess(tool = '', args = {}, capabilityGate = null) {
  if (!capabilityGate || !String(tool || '').includes('.')) return { ok: true, reason: 'not_gated' };
  const role = String(args?.role || '').trim();
  const routeKey = String(args?.routeKey || args?.channel || '').trim();
  const toolId = String(tool || '').trim();
  const injectedTools = new Set(['bridge.route', 'lifecycle.snapshot', 'shell.inspect']);
  if (!injectedTools.has(toolId)) return { ok: true, reason: 'base_tool' };
  const rolePolicy = capabilityGate?.roles?.[role] || null;
  const allowedTools = Array.isArray(rolePolicy?.allowInjectedTools) ? rolePolicy.allowInjectedTools : [];
  if (!allowedTools.includes(toolId)) return { ok: false, reason: 'injected_tool_denied', role, tool: toolId };
  if (toolId === 'bridge.route') {
    const allowedRoutes = Array.isArray(rolePolicy?.allowBridgeRoutes) ? rolePolicy.allowBridgeRoutes : [];
    if (routeKey && allowedRoutes.length > 0 && !allowedRoutes.includes(routeKey)) return { ok: false, reason: 'bridge_route_denied', role, tool: toolId, routeKey };
  }
  return { ok: true, reason: 'allowed', role, tool: toolId, routeKey };
}

export function createLocalToolRuntime({ sandbox, eventBus = null, outputDir = '', memoryProvider = null, commandRuntime = null, bridgeHost = null, lifecycleRuntime = null, productShell = null, capabilityGate = null, initialRuns = [], toolRegistry = [], providers = [], audit = null, roles = {}, schemaPath = '', runtimeId = 'local-tool-runtime' } = {}) {
  const runs = Array.isArray(initialRuns) ? [...initialRuns] : [];
  const registry = new Map();
  let counter = runs.length;
  const rolePolicyMap = roles && typeof roles === 'object' ? roles : {};
  const auditPath = outputDir ? path.join(outputDir, 'tool-audit.jsonl') : '';
  const auditLog = audit || createToolAuditLog({ filePath: auditPath, eventBus });

  async function recordRun(tool = '', args = {}, result = {}, ok = true, metadata = {}) {
    const entry = {
      runId: `toolrun:${++counter}`,
      tool,
      args: cloneJson(args),
      ok,
      result: cloneJson(result),
      ts: Date.now(),
      startedAt: metadata.startedAt || null,
      finishedAt: metadata.finishedAt || null,
      durationMs: Number(metadata.durationMs || 0),
      actor: cloneJson(metadata.actor || null),
      auditId: normalizeText(metadata.auditId || ''),
      source: normalizeText(metadata.source || ''),
      execution: cloneJson(metadata.execution || null),
    };
    runs.push(entry);
    eventBus?.emit?.({ type: 'tool.executed', tool, ok, runId: entry.runId });
    return entry;
  }

  function normalizeRegistration(definition = {}, handler = null) {
    const toolId = normalizeText(definition?.id || definition?.name || '');
    if (!toolId) throw new Error('tool_id_required');
    const execute = typeof handler === 'function' ? handler : typeof definition?.execute === 'function' ? definition.execute : null;
    if (!execute) throw new Error(`tool_execute_required:${toolId}`);
    const registration = {
      id: toolId,
      title: normalizeText(definition?.title || definition?.summary || toolId),
      description: normalizeText(definition?.description || definition?.summary || toolId),
      summary: normalizeText(definition?.summary || ''),
      version: normalizeText(definition?.version || '1.0.0'),
      source: definition?.source && typeof definition.source === 'object' ? cloneJson(definition.source) : { type: 'custom', name: runtimeId },
      tags: normalizeArray(definition?.tags || []),
      permissions: {
        public: definition?.permissions?.public !== false,
        allowRoles: normalizeArray(definition?.permissions?.allowRoles || definition?.permissions?.roles || []),
        denyRoles: normalizeArray(definition?.permissions?.denyRoles || []),
        capabilities: normalizeArray(definition?.permissions?.capabilities || []),
        requiresConfirmation: definition?.permissions?.requiresConfirmation === true,
      },
      inputSchema: definition?.inputSchema && typeof definition.inputSchema === 'object' ? cloneJson(definition.inputSchema) : { type: 'object', additionalProperties: true },
      outputSchema: definition?.outputSchema && typeof definition.outputSchema === 'object' ? cloneJson(definition.outputSchema) : { type: 'object', additionalProperties: true },
      examples: Array.isArray(definition?.examples) ? cloneJson(definition.examples) : [],
      'x-runtime': definition?.['x-runtime'] && typeof definition['x-runtime'] === 'object' ? cloneJson(definition['x-runtime']) : {},
      execute,
      validateInput: createToolValidator(definition?.inputSchema && typeof definition.inputSchema === 'object' ? definition.inputSchema : { type: 'object', additionalProperties: true }),
      validateOutput: createToolValidator(definition?.outputSchema && typeof definition.outputSchema === 'object' ? definition.outputSchema : { type: 'object', additionalProperties: true }),
    };
    return registration;
  }

  function registerTool(definition = {}, handler = null) {
    const registration = normalizeRegistration(definition, handler);
    registry.set(registration.id, registration);
    eventBus?.emit?.({ type: 'tool.registered', tool: registration.id, source: registration.source?.name || registration.source?.type || 'custom' });
    return publicToolView(registration);
  }

  function registerTools(items = []) {
    return (Array.isArray(items) ? items : []).map((item) => registerTool(item));
  }

  function publicToolView(tool = {}) {
    const { execute, validateInput, validateOutput, ...view } = tool;
    return cloneJson(view);
  }

  function resolveTool(toolName = '') {
    return registry.get(normalizeText(toolName)) || null;
  }

  function canAccessTool(tool = {}, context = {}) {
    const actor = defaultActor(context);
    const permissions = tool?.permissions || {};
    const allowRoles = normalizeArray(permissions.allowRoles || []);
    const denyRoles = new Set(normalizeArray(permissions.denyRoles || []));
    const role = actor.role || 'unknown';

    if (denyRoles.has(role)) return { ok: false, reason: 'tool_role_denied', role, tool: tool.id };
    if (allowRoles.length > 0 && !allowRoles.includes('*') && !allowRoles.includes(role)) {
      return { ok: false, reason: 'tool_role_not_allowed', role, tool: tool.id, allowRoles };
    }

    const rolePolicy = rolePolicyMap?.[role] || null;
    const allowedTools = normalizeArray(rolePolicy?.allowTools || []);
    const deniedTools = new Set(normalizeArray(rolePolicy?.denyTools || []));
    if (deniedTools.has(tool.id)) return { ok: false, reason: 'runtime_role_tool_denied', role, tool: tool.id };
    if (allowedTools.length > 0 && !allowedTools.includes('*') && !allowedTools.includes(tool.id)) {
      return { ok: false, reason: 'runtime_role_tool_not_allowed', role, tool: tool.id, allowTools: allowedTools };
    }

    return { ok: true, reason: 'allowed', role, tool: tool.id };
  }

  function listTools({ role = '', includePrivate = false, sourceSkill = '', context = {} } = {}) {
    const effectiveContext = { ...context, role: role || context?.role || '' };
    return [...registry.values()]
      .filter((tool) => {
        if (!includePrivate && tool?.source?.private === true) return false;
        if (sourceSkill && normalizeText(tool?.source?.skillId || '') !== normalizeText(sourceSkill)) return false;
        return canAccessTool(tool, effectiveContext).ok;
      })
      .map((tool) => publicToolView(tool));
  }

  async function callTool(toolName = '', args = {}, context = {}) {
    const startedAt = nowIso();
    const actor = defaultActor(context);
    const tool = resolveTool(toolName);
    if (!tool) {
      const finishedAt = nowIso();
      const result = { error: `tool_not_supported: ${toolName}` };
      const execution = createToolExecutionEnvelope({
        tool: toolName,
        args,
        result,
        actor,
        source: 'missing',
        startedAt,
        finishedAt,
        ok: false,
        error: result.error,
      });
      await recordRun(toolName, args, result, false, { startedAt, finishedAt, durationMs: 0, actor, source: 'missing', execution });
      return { ok: false, tool: toolName, result, execution };
    }

    const roleCheck = canAccessTool(tool, context);
    if (!roleCheck.ok) {
      const finishedAt = nowIso();
      const result = { error: roleCheck.reason, access: roleCheck };
      const auditEntry = await auditLog.append({ ts: startedAt, tool: tool.id, ok: false, actor, args, result, reason: roleCheck.reason, source: tool.source });
      const execution = createToolExecutionEnvelope({
        tool: tool.id,
        args,
        result,
        actor,
        source: tool.source?.name || tool.source?.type || '',
        auditId: auditEntry.auditId,
        startedAt,
        finishedAt,
        ok: false,
        error: roleCheck.reason,
        metadata: { reason: roleCheck.reason },
      });
      await recordRun(tool.id, args, result, false, { startedAt, finishedAt, durationMs: 0, actor, auditId: auditEntry.auditId, source: tool.source?.name || tool.source?.type || '', execution });
      return { ok: false, tool: tool.id, result, execution };
    }

    const capability = checkCapabilityAccess(tool.id, { ...args, role: actor.role }, capabilityGate);
    if (!capability.ok) {
      const finishedAt = nowIso();
      const result = { error: capability.reason, access: capability };
      const auditEntry = await auditLog.append({ ts: startedAt, tool: tool.id, ok: false, actor, args, result, reason: capability.reason, source: tool.source });
      const execution = createToolExecutionEnvelope({
        tool: tool.id,
        args,
        result,
        actor,
        source: tool.source?.name || tool.source?.type || '',
        auditId: auditEntry.auditId,
        startedAt,
        finishedAt,
        ok: false,
        error: capability.reason,
        metadata: { reason: capability.reason },
      });
      await recordRun(tool.id, args, result, false, { startedAt, finishedAt, durationMs: 0, actor, auditId: auditEntry.auditId, source: tool.source?.name || tool.source?.type || '', execution });
      return { ok: false, tool: tool.id, result, execution };
    }

    const validatedInput = tool.validateInput(args || {});
    if (!validatedInput.ok) {
      const finishedAt = nowIso();
      const result = { error: 'tool_input_validation_failed', errors: validatedInput.errors };
      const auditEntry = await auditLog.append({ ts: startedAt, tool: tool.id, ok: false, actor, args, result, reason: 'tool_input_validation_failed', source: tool.source });
      const execution = createToolExecutionEnvelope({
        tool: tool.id,
        args,
        result,
        actor,
        source: tool.source?.name || tool.source?.type || '',
        auditId: auditEntry.auditId,
        startedAt,
        finishedAt,
        ok: false,
        error: 'tool_input_validation_failed',
      });
      await recordRun(tool.id, args, result, false, { startedAt, finishedAt, durationMs: 0, actor, auditId: auditEntry.auditId, source: tool.source?.name || tool.source?.type || '', execution });
      return { ok: false, tool: tool.id, result, execution };
    }

    try {
      const result = await tool.execute({
        args: args || {},
        context,
        actor,
        sandbox,
        memoryProvider,
        commandRuntime,
        bridgeHost,
        lifecycleRuntime,
        productShell,
        runtime: api,
      });
      const validatedOutput = tool.validateOutput(result);
      if (!validatedOutput.ok) {
        throw Object.assign(new Error('tool_output_validation_failed'), { details: validatedOutput.errors });
      }
      const finishedAt = nowIso();
      const durationMs = Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt));
      const auditEntry = await auditLog.append({ ts: startedAt, finishedAt, durationMs, tool: tool.id, ok: true, actor, args, result, source: tool.source });
      const execution = createToolExecutionEnvelope({
        tool: tool.id,
        args,
        result,
        actor,
        source: tool.source?.name || tool.source?.type || '',
        auditId: auditEntry.auditId,
        startedAt,
        finishedAt,
        ok: true,
      });
      await recordRun(tool.id, args, result, true, { startedAt, finishedAt, durationMs, actor, auditId: auditEntry.auditId, source: tool.source?.name || tool.source?.type || '', execution });
      return { ok: true, tool: tool.id, result, execution };
    } catch (error) {
      const finishedAt = nowIso();
      const durationMs = Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt));
      const result = {
        error: normalizeText(error?.message || error || 'tool_failed'),
        details: cloneJson(error?.details || null),
      };
      const auditEntry = await auditLog.append({ ts: startedAt, finishedAt, durationMs, tool: tool.id, ok: false, actor, args, result, source: tool.source });
      const execution = createToolExecutionEnvelope({
        tool: tool.id,
        args,
        result,
        actor,
        source: tool.source?.name || tool.source?.type || '',
        auditId: auditEntry.auditId,
        startedAt,
        finishedAt,
        ok: false,
        error,
      });
      await recordRun(tool.id, args, result, false, { startedAt, finishedAt, durationMs, actor, auditId: auditEntry.auditId, source: tool.source?.name || tool.source?.type || '', execution });
      return { ok: false, tool: tool.id, result, execution };
    }
  }

  async function run(tool = '', args = {}) {
    return callTool(tool, args, { role: args?.role || '', actor: { id: args?.agentId || args?.role || 'legacy', role: args?.role || 'legacy', type: 'agent' } });
  }

  function appendRuns(items = []) {
    for (const item of Array.isArray(items) ? items : []) {
      runs.push(item);
      counter += 1;
    }
  }

  async function flush() {
    if (!outputDir) return { toolRunsPath: '', toolAuditPath: auditLog.path || '' };
    await ensureDir(outputDir);
    const toolRunsPath = path.join(outputDir, 'tool-runs.json');
    await fs.writeFile(toolRunsPath, JSON.stringify({ runs }, null, 2), 'utf8');
    return { toolRunsPath, toolAuditPath: auditLog.path || '' };
  }

  const api = {
    kind: 'tool_runtime',
    contractVersion: 'tool-runtime.v2',
    runtimeId,
    registerTool,
    registerTools,
    resolveTool,
    listTools,
    callTool,
    run,
    appendRuns,
    listRuns() {
      return [...runs];
    },
    getAuditLog() {
      return auditLog;
    },
    async flush() {
      return flush();
    },
  };

  for (const tool of [...buildLegacyToolRegistry(), ...(Array.isArray(toolRegistry) ? toolRegistry : []), ...(Array.isArray(providers) ? providers : [])]) {
    registerTool(tool);
  }

  return api;
}
