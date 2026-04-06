#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { createMcpServer, loadMcpConfig } from '../src/mcp/mcp-server.mjs';

function hasFlag(flag) { return process.argv.includes(flag); }
function readValue(flag, fallback = '') {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? (process.argv[idx + 1] || fallback) : fallback;
}

const rootDir = process.cwd();
const configPath = readValue('--config', 'config/team/mcp.json');
const config = await loadMcpConfig({ rootDir, configPath });
const stdio = hasFlag('--stdio') || (!hasFlag('--http') && String(config.transport) !== 'http');
const useHttp = hasFlag('--http') || (!hasFlag('--stdio') && String(config.transport) !== 'stdio');
const port = Number(readValue('--port', config.port || 7331));
const host = readValue('--host', config.host || '127.0.0.1');

const server = await createMcpServer({ rootDir, config });
const started = await server.start({ stdio, http: useHttp, port, host });

if (useHttp) {
  console.error(`[mcp] HTTP server listening on http://${host}:${port} (SSE: /sse, RPC: /mcp)`);
}
if (stdio) {
  console.error('[mcp] stdio transport active');
}

if (!stdio && !useHttp) {
  console.error('[mcp] no transport enabled');
  process.exit(1);
}

process.on('SIGINT', async () => { try { await started.close?.(); } finally { process.exit(0); } });
process.on('SIGTERM', async () => { try { await started.close?.(); } finally { process.exit(0); } });
