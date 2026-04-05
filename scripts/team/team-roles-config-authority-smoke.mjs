import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const sourcePath = path.join(repoRoot, 'src', 'team', 'team-roles-config.mjs');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-roles-config-smoke-'));
const primaryPath = path.join(tmpDir, 'roles.primary.json');
const legacyPath = path.join(tmpDir, 'roles.legacy.json');
const modulePath = path.join(tmpDir, 'team-roles-config.sandbox.mjs');

function writeJson(targetPath, version, plannerNode) {
  fs.writeFileSync(targetPath, JSON.stringify({
    version,
    defaults: {},
    roles: {
      planner: {
        displayName: '规划师',
        preferredNode: plannerNode,
      },
    },
    routing: { mailboxKindToRole: { 'task.assign': 'planner' } },
    nodeMap: {},
  }, null, 2));
}

writeJson(primaryPath, 'primary', 'violet');
writeJson(legacyPath, 'legacy', 'laoda');

let source = fs.readFileSync(sourcePath, 'utf8');
source = source.replace(/const PRIMARY_CONFIG_PATH = .*;/, `const PRIMARY_CONFIG_PATH = ${JSON.stringify(primaryPath)};`);
source = source.replace(/const LEGACY_CONFIG_PATH = .*;/, `const LEGACY_CONFIG_PATH = ${JSON.stringify(legacyPath)};`);
fs.writeFileSync(modulePath, source);

const mod = await import(`${pathToFileURL(modulePath).href}?ts=${Date.now()}`);

async function captureWarn(fn) {
  const messages = [];
  const orig = console.warn;
  console.warn = (...args) => messages.push(args.join(' '));
  try {
    const result = await fn();
    return { result, messages };
  } finally {
    console.warn = orig;
  }
}

{
  const { result, messages } = await captureWarn(async () => mod.reloadTeamRolesConfig());
  assert.equal(result.version, 'primary');
  assert.equal(result.roles.planner.preferredNode, 'violet');
  assert.equal(messages.length, 0);
}

{
  const { result, messages } = await captureWarn(async () => mod.reloadTeamRolesConfig(legacyPath));
  assert.equal(result.version, 'legacy');
  assert.equal(result.roles.planner.preferredNode, 'laoda');
  assert.ok(messages.some((m) => m.includes('using explicit legacy compat config')));
}

fs.unlinkSync(primaryPath);

{
  const { result, messages } = await captureWarn(async () => mod.reloadTeamRolesConfig());
  assert.equal(result.version, 'legacy');
  assert.equal(result.roles.planner.preferredNode, 'laoda');
  assert.ok(messages.some((m) => m.includes('falling back to legacy compat config')));
}

{
  const missingCustomPath = path.join(tmpDir, 'missing.custom.json');
  const { result, messages } = await captureWarn(async () => mod.reloadTeamRolesConfig(missingCustomPath));
  assert.equal(result.version, '0.0.0');
  assert.deepEqual(result.roles, {});
  assert.ok(messages.some((m) => m.includes('config not found')));
  assert.ok(!messages.some((m) => m.includes('falling back to legacy compat config')));
}

console.log('team-roles-config-authority-smoke: ok');
