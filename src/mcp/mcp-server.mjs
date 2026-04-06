import http from 'node:http';
import path from 'node:path';
import readline from 'node:readline';
import { randomUUID } from 'node:crypto';
import { createMcpToolRegistry } from './mcp-tools.mjs';
import { createMcpResources } from './mcp-resources.mjs';
import { createMcpPrompts } from './mcp-prompts.mjs';
import { createMcpClient, discoverRemoteMcpTools } from './mcp-client.mjs';
import { loadJson } from '../tools/tool-common.mjs';

function nowIso() { return new Date().toISOString(); }
function normalizeText(value = '') { return String(value || '').trim(); }
function asArray(value) { return Array.isArray(value) ? value : []; }
function asObject(value, fallback = {}) { return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback; }
function safeParseJson(raw) { try { return JSON.parse(raw); } catch { return null; } }
function jsonrpc(id, result) { return { jsonrpc: '2.0', id, result }; }
function jsonrpcError(id, code, message, data = null) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data === null ? {} : { data }) } };
}
function writeJsonLine(stream, payload) { stream.write(`${JSON.stringify(payload)}\n`); }
function normalizeAllowlist(values) {
  return Array.isArray(values) ? values.map((value) => normalizeText(value)).filter(Boolean) : [];
}
function isWildcardAllowlist(values = []) { return normalizeAllowlist(values).includes('*'); }
function filterByAllowlist(items = [], allowlist = [], key = 'name') {
  const allowed = normalizeAllowlist(allowlist);
  if (!allowed.length || allowed.includes('*')) return items;
  const allowedSet = new Set(allowed);
  return (Array.isArray(items) ? items : []).filter((item) => allowedSet.has(normalizeText(item?.[key])));
}
function matchAllowedResource(resource = '', allowlist = []) {
  const target = normalizeText(resource);
  const allowed = normalizeAllowlist(allowlist);
  if (!allowed.length || allowed.includes('*')) return true;
  return allowed.some((candidate) => {
    if (candidate === target) return true;
    if (candidate.includes('{scope}')) {
      const pattern = new RegExp(`^${candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\{scope\\}', '[^/]+')}$`);
      return pattern.test(target);
    }
    return false;
  });
}
function getBearerTokenFromHeader(headerValue = '') {
  const auth = normalizeText(headerValue);
  return auth.startsWith('Bearer ') ? normalizeText(auth.slice(7)) : '';
}
function getConfiguredBearerToken(config = {}) {
  return normalizeText(config?.auth?.bearerToken || config?.server?.token || config?.token);
}
function isHttpAuthorized(req, config = {}) {
  const configuredToken = getConfiguredBearerToken(config);
  const allowLocalhost = config?.auth?.allowLocalhostWithoutAuth === true;
  const remoteAddress = normalizeText(req?.socket?.remoteAddress || '');
  if (!configuredToken) return true;
  if (allowLocalhost && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddress)) return true;
  return getBearerTokenFromHeader(req?.headers?.authorization || '') === configuredToken;
}
function writeUnauthorized(res) {
  res.writeHead(401, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
}
function buildDefaultConfig() {
  return {
    version: 1,
    name: 'AI Team Harness MCP',
    serverVersion: '1.0.0',
    transport: 'both',
    host: '127.0.0.1',
    port: 7331,
    auth: { enabled: false, bearerToken: '', allowLocalhostWithoutAuth: true },
    allowlist: { tools: ['*'], resources: ['*'], prompts: ['*'] },
    expose: { tools: ['*'], resources: ['*'], prompts: ['*'], resourceTemplates: ['*'] },
    session: { idleTtlMs: 3600000, persist: false },
    clients: [],
  };
}
function normalizeConfig(config = {}) {
  const base = buildDefaultConfig();
  const merged = {
    ...base,
    ...asObject(config),
    auth: { ...base.auth, ...asObject(config?.auth), ...(config?.server?.token ? { bearerToken: config.server.token } : {}) },
    allowlist: {
      tools: normalizeAllowlist(config?.allowlist?.tools || config?.server?.allowedTools || base.allowlist.tools),
      resources: normalizeAllowlist(config?.allowlist?.resources || config?.server?.allowedResources || base.allowlist.resources),
      prompts: normalizeAllowlist(config?.allowlist?.prompts || base.allowlist.prompts),
    },
    expose: {
      tools: normalizeAllowlist(config?.expose?.tools || config?.server?.allowedTools || base.expose.tools),
      resources: normalizeAllowlist(config?.expose?.resources || config?.server?.allowedResources || base.expose.resources),
      prompts: normalizeAllowlist(config?.expose?.prompts || base.expose.prompts),
      resourceTemplates: normalizeAllowlist(config?.expose?.resourceTemplates || config?.server?.allowedResources || base.expose.resourceTemplates),
    },
    clients: asArray(config?.clients),
  };
  merged.port = Number(config?.port || config?.server?.port || base.port);
  merged.host = normalizeText(config?.host || config?.server?.host || base.host);
  return merged;
}

export async function loadMcpConfig({ rootDir = process.cwd(), configPath } = {}) {
  const candidates = [
    path.resolve(rootDir, configPath || 'config/team/mcp.json'),
    path.resolve(rootDir, 'config/mcp.json'),
  ];
  for (const candidate of candidates) {
    const config = await loadJson(candidate, null);
    if (config) return normalizeConfig(config);
  }
  return normalizeConfig(buildDefaultConfig());
}

export async function createMcpServer({ rootDir = process.cwd(), config = {}, fetchImpl = globalThis.fetch } = {}) {
  const finalConfig = normalizeConfig(config);
  const sessions = new Map();
  const sseClients = new Map();
  const toolRegistry = await createMcpToolRegistry({ rootDir, config: finalConfig });
  const resources = createMcpResources({ rootDir, config: finalConfig });
  const prompts = createMcpPrompts();
  const remoteClients = [];
  const allowlist = finalConfig.allowlist;
  const expose = finalConfig.expose;
  const serverInfo = {
    name: finalConfig.name || 'ai-team-harness-mcp',
    version: finalConfig.serverVersion || '1.0.0',
    protocolVersion: '2024-11-05',
  };

  function ensureSession(sessionId = '') {
    const id = normalizeText(sessionId) || `mcp-session:${randomUUID()}`;
    if (!sessions.has(id)) {
      sessions.set(id, {
        id,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        requests: 0,
        initialized: false,
        clientInfo: null,
        protocolVersion: '',
        transport: 'unknown',
      });
    }
    const session = sessions.get(id);
    session.updatedAt = nowIso();
    return session;
  }

  function publish(event, data = {}) {
    const payload = `event: ${event}\ndata: ${JSON.stringify({ ts: nowIso(), ...data })}\n\n`;
    for (const res of sseClients.values()) res.write(payload);
  }

  function listExposedTools() {
    return filterByAllowlist(toolRegistry.listTools(), expose.tools.length ? expose.tools : allowlist.tools, 'name');
  }

  function listExposedResources() {
    return filterByAllowlist(resources.listResources(), expose.resources.length ? expose.resources : allowlist.resources, 'uri');
  }

  function listExposedResourceTemplates() {
    const allowed = expose.resourceTemplates.length ? expose.resourceTemplates : allowlist.resources;
    if (!allowed.length || allowed.includes('*')) return asArray(resources.resourceTemplates);
    return asArray(resources.resourceTemplates).filter((item) => allowed.includes(normalizeText(item?.uriTemplate)) || matchAllowedResource(item?.uriTemplate, allowed));
  }

  function listExposedPrompts() {
    return filterByAllowlist(prompts.listPrompts(), expose.prompts.length ? expose.prompts : allowlist.prompts, 'name');
  }

  async function connectRemote(url, token = '', name = 'remote') {
    const client = createMcpClient({ name, url, token, fetchImpl });
    await client.connect(url, token);
    const tools = await client.discoverTools();
    for (const tool of tools) toolRegistry.registerRemoteTool(tool, client);
    remoteClients.push(client);
    return { client, tools };
  }

  async function bootstrapRemoteClients() {
    const discovered = await discoverRemoteMcpTools({ rootDir, config: finalConfig, toolRegistry, fetchImpl });
    for (const entry of discovered) if (entry.ok && entry.client) remoteClients.push(entry.client);
    return discovered;
  }

  function assertToolAllowed(name = '') {
    const toolName = normalizeText(name);
    if (!toolName) throw Object.assign(new Error('tool_name_required'), { code: -32602 });
    if (!toolRegistry.hasTool(toolName)) throw Object.assign(new Error(`tool_not_found:${toolName}`), { code: -32601 });
    if (!matchAllowedResource(toolName, allowlist.tools) && !isWildcardAllowlist(allowlist.tools)) {
      throw Object.assign(new Error(`tool_not_allowed:${toolName}`), { code: -32001 });
    }
    return toolName;
  }

  function assertResourceAllowed(uri = '') {
    const target = normalizeText(uri);
    if (!target) throw Object.assign(new Error('resource_uri_required'), { code: -32602 });
    if (!matchAllowedResource(target, allowlist.resources)) {
      throw Object.assign(new Error(`resource_not_allowed:${target}`), { code: -32002 });
    }
    return target;
  }

  function assertPromptAllowed(name = '') {
    const promptName = normalizeText(name);
    if (!promptName) throw Object.assign(new Error('prompt_name_required'), { code: -32602 });
    const allowed = normalizeAllowlist(allowlist.prompts);
    if (allowed.length && !allowed.includes('*') && !allowed.includes(promptName)) {
      throw Object.assign(new Error(`prompt_not_allowed:${promptName}`), { code: -32003 });
    }
    return promptName;
  }

  async function dispatch(method, params = {}, meta = {}) {
    const session = ensureSession(meta.sessionId || params.sessionId || '');
    session.requests += 1;
    session.transport = normalizeText(meta.transport || session.transport || 'unknown');

    switch (method) {
      case 'initialize': {
        session.initialized = true;
        session.protocolVersion = normalizeText(params?.protocolVersion || serverInfo.protocolVersion);
        session.clientInfo = asObject(params?.clientInfo, null);
        publish('session_initialized', { sessionId: session.id, clientInfo: session.clientInfo });
        return {
          protocolVersion: serverInfo.protocolVersion,
          serverInfo: { name: serverInfo.name, version: serverInfo.version },
          capabilities: {
            tools: { listChanged: true },
            resources: { subscribe: false, listChanged: false },
            prompts: { listChanged: false },
          },
          instructions: 'Use initialize once per session, then tools/resources/prompts APIs over JSON-RPC 2.0.',
          sessionId: session.id,
        };
      }
      case 'initialized':
        session.initialized = true;
        return { ok: true, sessionId: session.id };
      case 'ping':
        return { ok: true, now: nowIso(), sessionId: session.id };
      case 'tools/list':
        return { tools: listExposedTools() };
      case 'tools/call': {
        const toolName = assertToolAllowed(params?.name);
        const result = await toolRegistry.callTool(toolName, params?.arguments || {}, {
          sessionId: session.id,
          source: meta.transport || 'unknown',
          actor: { id: session.id, role: 'mcp', type: 'mcp-client' },
        });
        publish('tool_called', { sessionId: session.id, tool: toolName });
        return result;
      }
      case 'resources/list':
        return { resources: listExposedResources(), resourceTemplates: listExposedResourceTemplates() };
      case 'resources/read': {
        const uri = assertResourceAllowed(params?.uri);
        return await resources.readResource(uri);
      }
      case 'prompts/list':
        return { prompts: listExposedPrompts() };
      case 'prompts/get': {
        const promptName = assertPromptAllowed(params?.name);
        return prompts.getPrompt(promptName, params?.arguments || {});
      }
      case 'sessions/list':
        return { sessions: [...sessions.values()] };
      default:
        throw Object.assign(new Error(`method_not_found:${method}`), { code: -32601 });
    }
  }

  async function handleRpc(body, meta = {}) {
    const req = typeof body === 'string' ? safeParseJson(body) : body;
    if (!req || typeof req !== 'object') return jsonrpcError(null, -32700, 'Parse error');
    const { id = null, method = '', params = {} } = req;
    if (!method) return jsonrpcError(id, -32600, 'Invalid Request');
    try {
      const result = await dispatch(method, params, meta);
      return jsonrpc(id, result);
    } catch (error) {
      return jsonrpcError(id, error?.code || -32000, error?.message || 'Internal error', error?.data || null);
    }
  }

  function createHttpServer() {
    return http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
      if (url.pathname === '/health') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, name: serverInfo.name, sessions: sessions.size, remotes: remoteClients.length }));
        return;
      }
      if ((url.pathname === '/sse' || (url.pathname === '/mcp' && req.method === 'POST')) && !isHttpAuthorized(req, finalConfig)) {
        writeUnauthorized(res);
        return;
      }
      if (url.pathname === '/sse') {
        const clientId = randomUUID();
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        });
        res.write(`event: ready\ndata: ${JSON.stringify({ clientId, server: serverInfo.name })}\n\n`);
        sseClients.set(clientId, res);
        req.on('close', () => sseClients.delete(clientId));
        return;
      }
      if (url.pathname === '/mcp' && req.method === 'POST') {
        let raw = '';
        req.on('data', (chunk) => { raw += String(chunk || ''); });
        req.on('end', async () => {
          const response = await handleRpc(raw, {
            transport: 'http',
            sessionId: req.headers['x-mcp-session-id'] || '',
          });
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(response));
        });
        return;
      }
      res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'not_found' }));
    });
  }

  async function startStdio() {
    const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
    rl.on('line', async (line) => {
      const trimmed = normalizeText(line);
      if (!trimmed) return;
      const response = await handleRpc(trimmed, { transport: 'stdio' });
      writeJsonLine(process.stdout, response);
    });
  }

  const remoteBootstrap = await bootstrapRemoteClients();

  return {
    info: serverInfo,
    config: finalConfig,
    sessions,
    toolRegistry,
    resources,
    prompts,
    remoteClients,
    remoteBootstrap,
    connectRemote,
    handleRpc,
    createHttpServer,
    async start({ stdio = false, http: useHttp = false, port = Number(finalConfig.port || 7331), host = finalConfig.host || '127.0.0.1' } = {}) {
      let httpServer = null;
      if (stdio) await startStdio();
      if (useHttp) {
        httpServer = createHttpServer();
        await new Promise((resolve) => httpServer.listen(port, host, resolve));
      }
      return {
        stdio,
        http: !!httpServer,
        port,
        host,
        close: async () => {
          if (httpServer) await new Promise((resolve, reject) => httpServer.close((err) => (err ? reject(err) : resolve())));
        },
      };
    },
  };
}
