import { loadMcpConfig, createMcpServer } from '../mcp/mcp-server.mjs';

function sendJson(res, code, body, extraHeaders = {}) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', ...extraHeaders });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

let mcpInstance = null;

async function ensureMcp(rootDir = process.cwd()) {
  if (mcpInstance) return mcpInstance;
  const config = await loadMcpConfig({ rootDir });
  mcpInstance = await createMcpServer({ rootDir, config });
  return mcpInstance;
}

/**
 * JSON-RPC over HTTP 路由 — 挂接 MCP Server 到主 server
 * 
 * 端点:
 *   POST /mcp        → JSON-RPC 请求 (鉴权 + allowlist 在 mcp-server.mjs 内部)
 *   GET  /mcp/health → MCP 健康检查 (轻量, 不调 createMcpServer)
 *   GET  /mcp/info   → MCP 服务信息
 * 
 * SSE transport 通过 mcp-server.mjs 独立 HTTP 端口提供 (见 mcp-server 内部 createHttpServer)。
 * 本路由专注 POST JSON-RPC + 健康检查。
 */
export async function tryHandleMcpRoute(req, res, ctx = {}) {
  const pathname = String(req.url || '').split('?')[0];

  if (pathname !== '/mcp' && pathname !== '/mcp/' &&
      pathname !== '/mcp/health' && pathname !== '/mcp/info') return false;

  // 轻量健康检查 — 不调 MCP 实例
  if (pathname === '/mcp/health' || pathname === '/mcp/health/') {
    if (!mcpInstance) {
      sendJson(res, 200, { ok: true, status: 'cold', message: 'MCP server not yet initialized' });
    } else {
      sendJson(res, 200, {
        ok: true,
        status: 'ready',
        name: mcpInstance.info?.name || 'unknown',
        sessions: mcpInstance.sessions?.size || 0,
      });
    }
    return true;
  }

  // 服务信息
  if (pathname === '/mcp/info' || pathname === '/mcp/info/') {
    try {
      const server = await ensureMcp(ctx.rootDir);
      sendJson(res, 200, {
        ok: true,
        server: server.info,
        sessions: server.sessions.size,
        transports: ['http', 'stdio', 'sse'],
      });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: String(e?.message || e) });
    }
    return true;
  }

  // POST /mcp — JSON-RPC 主入口
  if ((pathname === '/mcp' || pathname === '/mcp/') && req.method === 'POST') {
    try {
      const server = await ensureMcp(ctx.rootDir);
      const raw = await readBody(req);
      const response = await server.handleRpc(raw, {
        transport: 'http',
        sessionId: req.headers['x-mcp-session-id'] || '',
      });
      sendJson(res, 200, response);
    } catch (e) {
      sendJson(res, 500, { jsonrpc: '2.0', id: null, error: { code: -32000, message: String(e?.message || e) } });
    }
    return true;
  }

  // 非 POST → 405
  sendJson(res, 405, { ok: false, error: 'method_not_allowed', allowed: ['POST'] });
  return true;
}

export default tryHandleMcpRoute;
