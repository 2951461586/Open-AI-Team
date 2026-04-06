import path from 'node:path';
import { buildToolDefinition, execCommand, getProviderConfig, isProviderEnabled, loadToolsConfig } from './tool-common.mjs';

function trimLines(text = '', limit = 200) {
  return String(text || '').split('\n').slice(0, limit).join('\n').trim();
}

export async function createGitProvider({ rootDir = process.cwd(), configPath = 'config/team/tools.json', ...overrides } = {}) {
  const config = await loadToolsConfig({ rootDir, configPath });
  if (!isProviderEnabled(config, 'git', overrides)) return [];
  const providerConfig = getProviderConfig(config, 'git', overrides);
  const source = { type: 'provider', name: 'git-provider' };
  const resolveRepo = (repoPath = providerConfig.defaultRepo || '.') => path.resolve(rootDir, repoPath || '.');

  async function runGit(repoPath, args) {
    return execCommand('git', args, { cwd: resolveRepo(repoPath), timeout: Number(providerConfig.timeoutMs || 15000) });
  }

  return [
    buildToolDefinition({ id: 'git.status', title: 'Git status', description: 'Run git status --short --branch.', source, permissions: { public: true, capabilities: ['git.read'] }, inputSchema: { type: 'object', properties: { repoPath: { type: 'string' } }, additionalProperties: false }, outputSchema: { type: 'object', properties: { repoPath: { type: 'string' }, stdout: { type: 'string' } }, required: ['repoPath', 'stdout'], additionalProperties: true } }, async ({ repoPath = '' } = {}) => {
      const result = await runGit(repoPath, ['status', '--short', '--branch']);
      return { repoPath: resolveRepo(repoPath), stdout: trimLines(result.stdout) };
    }),
    buildToolDefinition({ id: 'git.log', title: 'Git log', description: 'Run formatted git log.', source, permissions: { public: true, capabilities: ['git.read'] }, inputSchema: { type: 'object', properties: { repoPath: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 100 } }, additionalProperties: false }, outputSchema: { type: 'object', properties: { repoPath: { type: 'string' }, stdout: { type: 'string' } }, required: ['repoPath', 'stdout'], additionalProperties: true } }, async ({ repoPath = '', limit = 10 } = {}) => {
      const result = await runGit(repoPath, ['log', `-${Math.max(1, Math.min(100, Number(limit || 10)))}`, '--oneline', '--decorate']);
      return { repoPath: resolveRepo(repoPath), stdout: trimLines(result.stdout) };
    }),
    buildToolDefinition({ id: 'git.diff', title: 'Git diff', description: 'Run git diff.', source, permissions: { public: true, capabilities: ['git.read'] }, inputSchema: { type: 'object', properties: { repoPath: { type: 'string' }, target: { type: 'string' }, staged: { type: 'boolean' } }, additionalProperties: false }, outputSchema: { type: 'object', properties: { repoPath: { type: 'string' }, stdout: { type: 'string' } }, required: ['repoPath', 'stdout'], additionalProperties: true } }, async ({ repoPath = '', target = '', staged = false } = {}) => {
      const args = ['diff'];
      if (staged) args.push('--staged');
      if (target) args.push(target);
      const result = await runGit(repoPath, args);
      return { repoPath: resolveRepo(repoPath), stdout: trimLines(result.stdout, 400) };
    }),
    buildToolDefinition({ id: 'git.create_branch', title: 'Create git branch', description: 'Create and checkout a branch.', source, permissions: { public: true, capabilities: ['git.write'] }, inputSchema: { type: 'object', properties: { repoPath: { type: 'string' }, branch: { type: 'string', minLength: 1 }, fromRef: { type: 'string' } }, required: ['branch'], additionalProperties: false }, outputSchema: { type: 'object', properties: { repoPath: { type: 'string' }, branch: { type: 'string' }, created: { type: 'boolean' } }, required: ['repoPath', 'branch', 'created'], additionalProperties: false } }, async ({ repoPath = '', branch = '', fromRef = '' } = {}) => {
      if (fromRef) await runGit(repoPath, ['checkout', fromRef]);
      await runGit(repoPath, ['checkout', '-b', branch]);
      return { repoPath: resolveRepo(repoPath), branch, created: true };
    }),
    buildToolDefinition({ id: 'git.commit', title: 'Git commit', description: 'Stage all changes and create a commit.', source, permissions: { public: true, capabilities: ['git.write'] }, inputSchema: { type: 'object', properties: { repoPath: { type: 'string' }, message: { type: 'string', minLength: 1 } }, required: ['message'], additionalProperties: false }, outputSchema: { type: 'object', properties: { repoPath: { type: 'string' }, committed: { type: 'boolean' }, stdout: { type: 'string' } }, required: ['repoPath', 'committed', 'stdout'], additionalProperties: true } }, async ({ repoPath = '', message = '' } = {}) => {
      if (providerConfig.allowCommit === false) throw new Error('git_commit_disabled');
      await runGit(repoPath, ['add', '-A']);
      const result = await runGit(repoPath, ['commit', '-m', message]);
      return { repoPath: resolveRepo(repoPath), committed: true, stdout: trimLines(result.stdout || result.stderr) };
    }),
    buildToolDefinition({ id: 'git.push', title: 'Git push', description: 'Push current branch to remote.', source, permissions: { public: true, capabilities: ['git.write', 'network.egress'] }, inputSchema: { type: 'object', properties: { repoPath: { type: 'string' }, remote: { type: 'string' }, branch: { type: 'string' } }, additionalProperties: false }, outputSchema: { type: 'object', properties: { repoPath: { type: 'string' }, pushed: { type: 'boolean' }, stdout: { type: 'string' } }, required: ['repoPath', 'pushed', 'stdout'], additionalProperties: true } }, async ({ repoPath = '', remote = 'origin', branch = '' } = {}) => {
      if (providerConfig.allowPush === false) throw new Error('git_push_disabled');
      const args = branch ? ['push', remote, branch] : ['push', remote];
      const result = await runGit(repoPath, args);
      return { repoPath: resolveRepo(repoPath), pushed: true, stdout: trimLines(result.stdout || result.stderr) };
    }),
  ];
}
