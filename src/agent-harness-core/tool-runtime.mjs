import fs from 'node:fs/promises';
import path from 'node:path';

export function createLocalToolRuntime({ sandbox, eventBus = null, outputDir = '', memoryProvider = null, commandRuntime = null, bridgeHost = null, lifecycleRuntime = null, productShell = null, capabilityGate = null, initialRuns = [] } = {}) {
  const runs = Array.isArray(initialRuns) ? [...initialRuns] : [];
  let counter = runs.length;

  async function record(tool = '', args = {}, result = {}, ok = true) {
    const entry = {
      runId: `toolrun:${++counter}`,
      tool,
      args,
      ok,
      result,
      ts: Date.now(),
    };
    runs.push(entry);
    if (eventBus?.emit) eventBus.emit({ type: 'tool.executed', tool, ok, runId: entry.runId });
    return entry;
  }

  function checkCapabilityAccess(tool = '', args = {}) {
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
      if (routeKey && allowedRoutes.length > 0 && !allowedRoutes.includes(routeKey)) {
        return { ok: false, reason: 'bridge_route_denied', role, tool: toolId, routeKey };
      }
    }
    return { ok: true, reason: 'allowed', role, tool: toolId, routeKey };
  }

  async function run(tool = '', args = {}) {
    try {
      const access = checkCapabilityAccess(tool, args);
      if (!access.ok) {
        const denied = { error: access.reason, access };
        await record(tool, args, denied, false);
        return { ok: false, tool, result: denied };
      }
      let result = null;
      if (tool === 'fs.write_text') {
        const resolved = await sandbox.writeText(args.path, args.content || '');
        result = { path: resolved, bytes: String(args.content || '').length };
      } else if (tool === 'fs.append_text') {
        const resolved = await sandbox.appendText(args.path, args.content || '');
        result = { path: resolved, bytes: String(args.content || '').length };
      } else if (tool === 'fs.read_text') {
        const text = await sandbox.readText(args.path);
        result = { path: sandbox.resolvePath(args.path), text, bytes: text.length };
      } else if (tool === 'fs.list') {
        const items = await sandbox.list(args.path || '.', { recursive: !!args.recursive });
        result = { items, count: items.length };
      } else if (tool === 'text.search') {
        const hits = await sandbox.searchText(args.path || '.', args.query || '');
        result = { hits, count: hits.length };
      } else if (tool === 'workspace.snapshot') {
        const items = await sandbox.list('.', { recursive: true });
        result = { items, count: items.length };
      } else if (tool === 'memory.retrieve') {
        if (!memoryProvider?.retrieve) throw new Error('memory_provider_unavailable');
        const hits = await memoryProvider.retrieve(args.query || '', { limit: Number(args.limit || 5) || 5 });
        result = { query: String(args.query || ''), hits, count: hits.length };
      } else if (tool === 'command.exec') {
        if (!commandRuntime?.execCommand) throw new Error('command_runtime_unavailable');
        const execResult = await commandRuntime.execCommand(args.command || '', Array.isArray(args.args) ? args.args : [], { cwd: args.cwd || sandbox.baseDir });
        result = execResult;
        if (!execResult.ok) throw new Error(execResult.timedOut ? 'command_timeout' : `command_failed:${execResult.exitCode}`);
      } else if (tool === 'bridge.route') {
        if (!bridgeHost?.routeMessage) throw new Error('bridge_host_unavailable');
        const routed = await bridgeHost.routeMessage({
          routeKey: args.routeKey || args.channel || '',
          channel: args.channel || '',
          text: args.text || '',
          kind: args.kind || 'route',
          messageId: args.messageId || '',
        });
        result = { routed };
      } else if (tool === 'lifecycle.snapshot') {
        result = { lifecycle: lifecycleRuntime?.paths || {}, available: !!lifecycleRuntime };
      } else if (tool === 'shell.inspect') {
        result = { shell: productShell?.paths || {}, available: !!productShell };
      } else {
        throw new Error(`tool_not_supported: ${tool}`);
      }
      await record(tool, args, result, true);
      return { ok: true, tool, result };
    } catch (err) {
      const result = { error: String(err?.message || err || 'tool_failed') };
      await record(tool, args, result, false);
      return { ok: false, tool, result };
    }
  }

  function appendRuns(items = []) {
    for (const item of Array.isArray(items) ? items : []) {
      runs.push(item);
      counter += 1;
    }
  }

  async function flush() {
    if (!outputDir) return { toolRunsPath: '' };
    await fs.mkdir(outputDir, { recursive: true });
    const toolRunsPath = path.join(outputDir, 'tool-runs.json');
    await fs.writeFile(toolRunsPath, JSON.stringify({ runs }, null, 2));
    return { toolRunsPath };
  }

  return {
    kind: 'tool_runtime',
    run,
    appendRuns,
    listRuns() {
      return [...runs];
    },
    async flush() {
      return flush();
    },
  };
}
