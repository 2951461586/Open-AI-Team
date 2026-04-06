#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../../');
const args = process.argv.slice(2);
const command = args[0] || 'help';
const scriptMap = new Map([['test-runner','scripts/test-runner.mjs'],['start-mcp','scripts/start-mcp.mjs'],['smoke:team','scripts/smoke/team-mainline.mjs'],['smoke:batch','scripts/smoke/team-batch.mjs']]);
if (command === 'help' || command === '--help' || command === '-h') {
  console.log(['ai-team-cli <command> [args...]','','Commands:','  test-runner   Run scripts/test-runner.mjs','  start-mcp     Run scripts/start-mcp.mjs','  smoke:team    Run scripts/smoke/team-mainline.mjs','  smoke:batch   Run scripts/smoke/team-batch.mjs'].join('\n'));
  process.exit(0);
}
const script = scriptMap.get(command);
if (!script) {
  console.error('Unknown command: ' + command);
  process.exit(1);
}
const child = spawn(process.execPath, [path.join(root, script), ...args.slice(1)], { stdio: 'inherit' });
child.on('exit', (code, signal) => { if (signal) process.kill(process.pid, signal); else process.exit(code ?? 0); });
