#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reportDir = path.join(root, 'reports');
if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });

function sh(command) {
  try {
    return execSync(command, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    return String(error?.stdout || error?.message || '').trim();
  }
}

const sections = [
  {
    title: 'Runtime/generated directories',
    command: `find . -maxdepth 4 \
      \\( -path '*/node_modules' -o -path '*/logs' -o -path '*/tmp' -o -path '*/run' -o -path '*/artifacts' -o -path '*/reports' -o -path '*/data' -o -path '*/state' \\) \
      | sort`,
  },
  {
    title: 'Potential authority ambiguity',
    command: `printf 'dashboard dirs\\n'; find . -maxdepth 3 -type d \\( -path './dashboard' -o -path './apps/dashboard' \\) | sort; \
      printf '\\nsource dirs\\n'; find . -maxdepth 3 -type d \\( -path './src' -o -path './packages' \\) | sort`,
  },
  {
    title: 'Archive / legacy-looking docs',
    command: `find docs -maxdepth 3 -type f \\( -path 'docs/archive/*' -o -iname '*legacy*' -o -iname '*retirement*' -o -iname '*migration*' -o -iname '*deprecation*' -o -iname '*compat*' \\) | sort`,
  },
  {
    title: 'Environment / secret-like files',
    command: `find . -maxdepth 3 -type f \\( -name '.env' -o -name '.env.*' -o -iname '*secret*' -o -iname '*token*' -o -iname '*credential*' -o -iname '*key*' \\) | sort`,
  },
  {
    title: 'Git ignored status snapshot',
    command: `git status --short --ignored`,
  },
  {
    title: 'Top-level repo shape',
    command: `find . -maxdepth 1 -mindepth 1 | sort`,
  },
];

let out = '# Repo Hygiene Audit\n\n';
out += `Generated at: ${new Date().toISOString()}\n\n`;
out += '> Purpose: identify open-source blockers, retired surfaces, runtime/generated directories, and authority ambiguity before public release.\n\n';

for (const section of sections) {
  out += `## ${section.title}\n\n`;
  const result = sh(section.command);
  out += '```text\n' + (result || '(empty)') + '\n```\n\n';
}

const reportPath = path.join(reportDir, 'repo-hygiene-audit.md');
writeFileSync(reportPath, out, 'utf8');
console.log(`Wrote ${path.relative(root, reportPath)}`);
