import { spawn } from 'node:child_process';
import path from 'node:path';

function normalizeAllowlist(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => String(item || '').trim()).filter(Boolean);
}

export function createCommandRuntime({ workspaceDir = '', policy = {} } = {}) {
  const cwd = path.resolve(String(workspaceDir || '.'));
  const allowedCommands = normalizeAllowlist(policy.allowedCommands || ['pwd', 'ls', 'cat', 'wc', 'head', 'tail', 'grep']);
  const maxStdoutBytes = Math.max(1024, Number(policy.maxStdoutBytes || 65536));
  const maxStderrBytes = Math.max(1024, Number(policy.maxStderrBytes || 32768));
  const timeoutMs = Math.max(200, Number(policy.timeoutMs || 5000));

  async function execCommand(command = '', args = [], opts = {}) {
    const bin = String(command || '').trim();
    const argv = Array.isArray(args) ? args.map((item) => String(item || '')) : [];
    if (!allowedCommands.includes(bin)) {
      throw new Error(`command_not_allowed: ${bin}`);
    }

    return new Promise((resolve, reject) => {
      const child = spawn(bin, argv, {
        cwd: String(opts.cwd || cwd),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let killed = false;
      const timer = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 500).unref();
      }, timeoutMs);

      child.stdout.on('data', (chunk) => {
        if (stdout.length < maxStdoutBytes) stdout += String(chunk || '');
      });
      child.stderr.on('data', (chunk) => {
        if (stderr.length < maxStderrBytes) stderr += String(chunk || '');
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on('close', (code, signal) => {
        clearTimeout(timer);
        resolve({
          ok: !killed && Number(code || 0) === 0,
          command: bin,
          args: argv,
          cwd: String(opts.cwd || cwd),
          exitCode: Number(code || 0),
          signal: signal || '',
          timedOut: killed,
          stdout: stdout.slice(0, maxStdoutBytes),
          stderr: stderr.slice(0, maxStderrBytes),
        });
      });
    });
  }

  return {
    kind: 'command_runtime',
    policy: {
      allowedCommands,
      maxStdoutBytes,
      maxStderrBytes,
      timeoutMs,
    },
    execCommand,
  };
}
