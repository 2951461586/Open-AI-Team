export const MCP_TRANSPORTS = {
  HTTP: 'http',
  SSE: 'sse',
  STDIO: 'stdio',
};

export const MCP_CAPABILITIES = {
  TOOLS: 'tools',
  RESOURCES: 'resources',
  PROMPTS: 'prompts',
  LOGGING: 'logging',
};

export function createMcpServerAdapter({
  name = 'mcp-server',
  url = 'http://localhost:8080',
  token = '',
  transport = MCP_TRANSPORTS.HTTP,
  capabilities = [MCP_CAPABILITIES.TOOLS],
  timeoutMs = 30000,
} = {}) {
  const state = {
    name,
    url,
    token,
    transport,
    capabilities,
    timeoutMs,
    connected: false,
    lastHealthCheck: null,
  };

  async function connect() {
    if (state.connected) return { ok: true, alreadyConnected: true };

    try {
      const healthUrl = state.transport === MCP_TRANSPORTS.STDIO ? null : `${state.url}/health`;
      if (healthUrl) {
        const response = await fetch(healthUrl, {
          method: 'GET',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: AbortSignal.timeout(state.timeoutMs),
        });
        if (!response.ok) {
          return { ok: false, error: `health check failed: ${response.status}` };
        }
      }
      state.connected = true;
      state.lastHealthCheck = new Date().toISOString();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async function disconnect() {
    state.connected = false;
    return { ok: true };
  }

  async function listTools() {
    if (!state.connected) {
      await connect();
    }

    try {
      const response = await fetch(`${state.url}/tools/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(state.timeoutMs),
      });

      if (!response.ok) {
        return { ok: false, error: `list tools failed: ${response.status}` };
      }

      const data = await response.json();
      return {
        ok: true,
        tools: data.tools || [],
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async function callTool(toolName = '', args = {}) {
    if (!state.connected) {
      await connect();
    }

    try {
      const response = await fetch(`${state.url}/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: toolName,
          arguments: args,
        }),
        signal: AbortSignal.timeout(state.timeoutMs),
      });

      if (!response.ok) {
        return { ok: false, error: `call tool failed: ${response.status}` };
      }

      const data = await response.json();
      return {
        ok: true,
        result: data,
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async function listResources() {
    if (!state.connected) {
      await connect();
    }

    if (!state.capabilities.includes(MCP_CAPABILITIES.RESOURCES)) {
      return { ok: true, resources: [] };
    }

    try {
      const response = await fetch(`${state.url}/resources/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(state.timeoutMs),
      });

      if (!response.ok) {
        return { ok: false, error: `list resources failed: ${response.status}` };
      }

      const data = await response.json();
      return {
        ok: true,
        resources: data.resources || [],
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async function readResource(uri = '') {
    if (!state.connected) {
      await connect();
    }

    try {
      const response = await fetch(`${state.url}/resources/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ uri }),
        signal: AbortSignal.timeout(state.timeoutMs),
      });

      if (!response.ok) {
        return { ok: false, error: `read resource failed: ${response.status}` };
      }

      const data = await response.json();
      return {
        ok: true,
        content: data.contents || [],
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  function getStatus() {
    return {
      name: state.name,
      url: state.url,
      transport: state.transport,
      capabilities: state.capabilities,
      connected: state.connected,
      lastHealthCheck: state.lastHealthCheck,
    };
  }

  return {
    name: state.name,
    connect,
    disconnect,
    listTools,
    callTool,
    listResources,
    readResource,
    getStatus,
  };
}

export function createMcpToolWrapper(mcpAdapter = {}) {
  async function toTool(toolDef = {}) {
    const { name, description, inputSchema } = toolDef;

    return {
      id: `mcp_${mcpAdapter.name}_${name}`,
      name: `mcp_${name}`,
      description: description || `MCP tool: ${name}`,
      schema: inputSchema || { type: 'object', properties: {} },

      async execute(args = {}) {
        const result = await mcpAdapter.callTool(name, args);
        return result;
      },
    };
  }

  async function wrapTools(mcpTools = []) {
    const wrapped = [];
    for (const tool of mcpTools) {
      const wrappedTool = await toTool(tool);
      wrapped.push(wrappedTool);
    }
    return wrapped;
  }

  return {
    toTool,
    wrapTools,
  };
}

export default {
  MCP_TRANSPORTS,
  MCP_CAPABILITIES,
  createMcpServerAdapter,
  createMcpToolWrapper,
};
