import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();

async function readJson(filePath = '') {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function exists(filePath = '') {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function check(label, ok, details = '') {
  return { label, ok: !!ok, details };
}

async function resolveManifestPath(packagePath, agentPackage) {
  const explicit = String(agentPackage?.manifestPath || '').trim();
  const packageDir = path.dirname(packagePath);
  const packageBase = path.basename(packagePath);
  const candidates = [
    explicit ? path.resolve(packageDir, explicit) : '',
    path.join(packageDir, packageBase.replace('package', 'manifest')),
    path.join(packageDir, 'agent-manifest.json'),
    path.join(packageDir, 'oss-agent-manifest.json'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  return '';
}

async function main() {
  const packageArg = String(process.argv[2] || 'examples/oss-minimal/agent-package.json');
  const packagePath = path.resolve(repoRoot, packageArg);
  const checks = [];

  if (!(await exists(packagePath))) {
    console.log(JSON.stringify({ ok: false, error: 'package_not_found', packagePath }, null, 2));
    process.exit(1);
  }

  const agentPackage = await readJson(packagePath);
  const manifestPath = await resolveManifestPath(packagePath, agentPackage);
  const manifest = manifestPath ? await readJson(manifestPath) : null;
  const shellCommands = Array.isArray(agentPackage?.productShell?.commands) ? agentPackage.productShell.commands : [];
  const requiredShellCommands = ['status', 'package', 'plugins', 'onboarding', 'routes', 'capabilities', 'doctor'];

  checks.push(check('package contractVersion is agent-package.v2', agentPackage?.contractVersion === 'agent-package.v2', String(agentPackage?.contractVersion || '')));
  checks.push(check('identity.agentId exists', !!agentPackage?.identity?.agentId, String(agentPackage?.identity?.agentId || '')));
  checks.push(check('identity.displayName exists', !!agentPackage?.identity?.displayName, String(agentPackage?.identity?.displayName || '')));
  checks.push(check('workflowPackId exists', !!agentPackage?.workflowPackId, String(agentPackage?.workflowPackId || '')));
  checks.push(check('policyPackId exists', !!agentPackage?.policyPackId, String(agentPackage?.policyPackId || '')));
  checks.push(check('pluginRefs is array', Array.isArray(agentPackage?.pluginRefs), String(Array.isArray(agentPackage?.pluginRefs) ? agentPackage.pluginRefs.length : 0)));
  checks.push(check('sessionContract exists', !!agentPackage?.sessionContract, 'sessionContract'));
  checks.push(check('deskContract exists', !!agentPackage?.deskContract, 'deskContract'));
  checks.push(check('bridgePolicy exists', !!agentPackage?.bridgePolicy, 'bridgePolicy'));
  checks.push(check('runtimeCapabilityPolicy exists', !!agentPackage?.runtimeCapabilityPolicy, 'runtimeCapabilityPolicy'));
  checks.push(check('lifecyclePolicy exists', !!agentPackage?.lifecyclePolicy, 'lifecyclePolicy'));
  checks.push(check('productShell exists', !!agentPackage?.productShell, 'productShell'));
  checks.push(check('productShell commands include required surface', requiredShellCommands.every((cmd) => shellCommands.includes(cmd)), shellCommands.join(', ')));
  checks.push(check('activationChecklist exists', Array.isArray(agentPackage?.productShell?.activationChecklist), String(Array.isArray(agentPackage?.productShell?.activationChecklist) ? agentPackage.productShell.activationChecklist.length : 0)));
  checks.push(check('manifest file resolved', !!manifestPath, manifestPath || ''));
  checks.push(check('manifest contractVersion exists', !!manifest?.contractVersion, String(manifest?.contractVersion || '')));
  checks.push(check('manifest agentId matches package identity', !manifest || manifest?.identity?.agentId === agentPackage?.identity?.agentId, `${manifest?.identity?.agentId || ''} :: ${agentPackage?.identity?.agentId || ''}`));

  const passed = checks.filter((item) => item.ok).length;
  const total = checks.length;
  const ok = passed === total;

  console.log(JSON.stringify({
    ok,
    packagePath,
    manifestPath,
    summary: {
      passed,
      total,
      productized: ok,
    },
    package: {
      contractVersion: agentPackage?.contractVersion || '',
      agentId: agentPackage?.identity?.agentId || '',
      displayName: agentPackage?.identity?.displayName || '',
      pluginCount: Array.isArray(agentPackage?.pluginRefs) ? agentPackage.pluginRefs.length : 0,
      shellCommands,
    },
    checks,
  }, null, 2));

  if (!ok) process.exit(1);
}

await main();
