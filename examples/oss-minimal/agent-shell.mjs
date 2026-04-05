import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shellEntry = path.resolve(__dirname, '../../src/agent-harness-core/agent-shell.mjs');
const env = {
  ...process.env,
  AGENT_PACKAGE_PATH: path.join(__dirname, 'agent-package.json'),
  AGENT_RUNS_ROOT: path.join(__dirname, '.runs'),
};

const child = spawn(process.execPath, [shellEntry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(Number(code || 0));
});
