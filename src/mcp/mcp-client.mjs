import fs from 'node:fs/promises';
import path from 'node:path';

function nowIso() { return new Date().toISOString(); }
function normalizeText(value = '') { return String(value || '').trim(); }
function asArray(value) { return Array.isArray(value) ? value : []; }
function jsonrpc(id, method, params = {}) { return { jsonrpc: '2.0', id, method, params }; }
function buildHeaders(token = '', extra = {}) {
  const headers = { 'content-type': 'application/json', ...extra };
  if (normalizeText(token)) headers.authorization = `Bearer ${normalizeText(token)}`;
  return headers;
}
function toRemoteToolName(clientName = '', toolName = '') {
  const remoteName = normalizeText(toolName);
  if (!remoteName) return '';
  const prefix = normalizeText(clientName);
  return prefix ? `remote.${prefix}.${remoteName}` : `remote.${remoteName}`;
}
function fromRemoteToolName(clientName = '', toolName = '') {
  const normalized = normalizeText(toolName);
  const prefix = normalizeText(clientName);
  const prefixed = prefix ? `remote.${prefix}.` : 'remote.';
  if (normalized.startsWith(prefixed)) return normalized.slice(prefixed.length);
  if (normalized.startsWith('remote.')) return normalized.slice('remote.'.length);
  return normalized;
}
async function readJsonIfExists(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

export async function loadConfiguredMcpClients({ rootDir = process.cwd(), config = {} } = {}) {
  const defaultConfigPath = path.resolve(rootDir, 'config/mcp-servers.json');
  const fileConfig = await readJsonIfExists(defaultConfigPath, null);
  const fromMainConfig = asArray(config?.clients);
  const fromServersFile = asArray(fileConfig?.clients || fileConfig);
  return [...fromMainConfig, ...fromServersFile]
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => ({
      name: normalizeText(item.name || `remote-${index + 1}`),
      url: normalizeText(item.url),
      token: normalizeText(item.token),
      enabled: item.enabled !== false,
      metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : {},
    }))
    .filter((item) => item.enabled && item.url);
}

export function createMcpClient({ name = '', url = '', token = '', fetchImpl = globalThis.fetch } = {}) {
  const state = {
    name: normalizeText(name || 'remote'),
    url: normalizeText(url),
    token: normalizeText(token),
    sessionId: '',
    initialized: false,
    protocolVersion: '',
    serverInfo: null,
    connectedAt: '',
    lastSeenAt: '',
    fetchImpl,
  };
  let rpcId = 0;

  async function request(method, params = {}, extra = {}) {
    if (typeof state.fetchImpl !== 'function') throw new Error('fetch_not_available');
    if (!state.url) throw new Error('mcp_client_url_missing');
    rpcId += 1;
    const target = `${state.url.replace(/\/$/, '')}/mcp`;
    const response = await state.fetchImpl(target, {
      method: 'POST',
      headers: buildHeaders(state.token, state.sessionId ? { 'x-mcp-session-id': state.sessionId } : {}),
      body: JSON.stringify(jsonrpc(rpcId, method, params)),
      ...extra,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`mcp_http_error:${response.status}`);
    if (!body || body.jsonrpc !== '2.0') throw new Error('mcp_invalid_response');
    if (body.error) {
      const err = new Error(body.error.message || `mcp_error:${method}`);
      err.code = body.error.code;
      err.data = body.error.data;
      throw err;
    }
    state.lastSeenAt = nowIso();
    return body.result;
  }

  async function connect(connectUrl = state.url, connectToken = state.token) {
    state.url = normalizeText(connectUrl || state.url);
    state.token = normalizeText(connectToken || state.token);
    const result = await request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {}, resources: {}, prompts: {} },
      clientInfo: { name: `mcp-client:${state.name}`, version: '1.0.0' },
    });
    state.sessionId = normalizeText(result?.sessionId);
    state.protocolVersion = normalizeText(result?.protocolVersion || '2024-11-05');
    state.serverInfo = result?.serverInfo || null;
    state.connectedAt = nowIso();
    state.initialized = true;
    try { await request('initialized', {}); } catch {}
    return { ok: true, name: state.name, url: state.url, sessionId: state.sessionId, protocolVersion: state.protocolVersion, serverInfo: state.serverInfo };
  }

  async function discoverTools() {
    if (!state.initialized) await connect();
    const result = await request('tools/list', {});
    const tools = asArray(result?.tools).map((tool) => ({
      ...tool,
      remoteName: normalizeText(tool?.name),
      name: toRemoteToolName(state.name, tool?.name),
      title: normalizeText(tool?.title || tool?.name),
      description: normalizeText(tool?.description || tool?.title || tool?.name),
      inputSchema: tool?.inputSchema && typeof tool.inputSchema === 'object' ? tool.inputSchema : { type: 'object', additionalProperties: true },
      source: {
        type: 'remote-mcp',
        name: state.name,
        url: state.url,
        remoteName: normalizeText(tool?.name),
      },
      'x-remote-mcp': {
        client: state.name,
        url: state.url,
        tool: normalizeText(tool?.name),
      },
    }));
    return tools;
  }

  async function callRemoteTool(toolName, args = {}) {
    if (!state.initialized) await connect();
    const remoteName = fromRemoteToolName(state.name, toolName);
    return await request('tools/call', { name: remoteName, arguments: args || {} });
  }

  return {
    get state() { return { ...state }; },
    connect,
    discoverTools,
    callRemoteTool,
  };
}

export async function discoverRemoteMcpTools({ rootDir = process.cwd(), config = {}, toolRegistry = null, fetchImpl = globalThis.fetch } = {}) {
  const clients = await loadConfiguredMcpClients({ rootDir, config });
  const remotes = [];

  for (const clientConfig of clients) {
    const client = createMcpClient({ ...clientConfig, fetchImpl });
    try {
      await client.connect(clientConfig.url, clientConfig.token);
      const tools = await client.discoverTools();
      if (toolRegistry?.registerRemoteTool) {
        for (const tool of tools) toolRegistry.registerRemoteTool(tool, client);
      }
      remotes.push({
        name: clientConfig.name,
        url: clientConfig.url,
        ok: true,
        toolCount: tools.length,
        tools: tools.map((tool) => tool.name),
        client,
      });
    } catch (error) {
      remotes.push({
        name: clientConfig.name,
        url: clientConfig.url,
        ok: false,
        error: String(error?.message || error),
        client,
      });
    }
  }

  return remotes;
}

export { toRemoteToolName, fromRemoteToolName };
