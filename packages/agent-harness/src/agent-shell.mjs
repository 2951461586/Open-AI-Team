import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagePath = process.env.AGENT_PACKAGE_PATH
  ? path.resolve(String(process.env.AGENT_PACKAGE_PATH))
  : path.join(__dirname, 'oss-agent-package.json');
const explicitRunsRoot = process.env.AGENT_RUNS_ROOT ? path.resolve(String(process.env.AGENT_RUNS_ROOT)) : '';

async function readJson(filePath = '', fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

async function pathExists(filePath = '') {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findLatestRunDir() {
  const candidateRoots = [
    explicitRunsRoot,
    path.join(path.dirname(packagePath), '.runs'),
    path.resolve(__dirname, '../../examples/oss-minimal/.runs'),
  ].filter(Boolean);

  for (const root of candidateRoots) {
    try {
      const entries = await fs.readdir(root, { withFileTypes: true });
      const dirs = entries
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('run-'))
        .map((entry) => path.join(root, entry.name))
        .sort();
      if (dirs.length > 0) return dirs[dirs.length - 1];
    } catch {
      // ignore missing roots
    }
  }

  return '';
}

async function resolveRunDir(input = '') {
  const trimmed = String(input || '').trim();
  if (trimmed && trimmed !== 'latest') return path.resolve(trimmed);
  return findLatestRunDir();
}

function usage() {
  console.log('usage: node agent-shell.mjs <status|package|plugins|onboarding|routes|capabilities|doctor> [runDir|latest]');
}

async function loadRunContext(runDir = '') {
  const resolvedRunDir = await resolveRunDir(runDir);
  if (!resolvedRunDir) {
    return {
      ok: false,
      error: 'run_dir_required',
      hint: 'provide [runDir] or ensure a latest run exists under .runs/',
    };
  }

  return {
    ok: true,
    runDir: resolvedRunDir,
    shellState: await readJson(path.join(resolvedRunDir, 'runtime', 'shell-state.json'), null),
    runReport: await readJson(path.join(resolvedRunDir, 'run-report.json'), null),
    bridgeState: await readJson(path.join(resolvedRunDir, 'runtime', 'bridge', 'bridge-state.json'), null),
  };
}

async function main() {
  const cmd = String(process.argv[2] || 'status');
  const runDirArg = String(process.argv[3] || '');
  const agentPackage = await readJson(packagePath, null);

  if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
    usage();
    return;
  }

  if (cmd === 'package') {
    console.log(JSON.stringify({
      ok: !!agentPackage,
      contractVersion: agentPackage?.contractVersion || '',
      agentId: agentPackage?.identity?.agentId || '',
      displayName: agentPackage?.identity?.displayName || '',
      pluginCount: Array.isArray(agentPackage?.pluginRefs) ? agentPackage.pluginRefs.length : 0,
      packagePath,
    }, null, 2));
    return;
  }

  if (cmd === 'plugins') {
    const plugins = Array.isArray(agentPackage?.pluginRefs) ? agentPackage.pluginRefs : [];
    console.log(JSON.stringify({
      ok: true,
      pluginCount: plugins.length,
      plugins,
      contributedToolCount: plugins.reduce((sum, item) => sum + (Array.isArray(item?.contributes?.tools) ? item.contributes.tools.length : 0), 0),
      contributedSkillCount: plugins.reduce((sum, item) => sum + (Array.isArray(item?.contributes?.skills) ? item.contributes.skills.length : 0), 0),
    }, null, 2));
    return;
  }

  if (cmd === 'onboarding') {
    const commands = Array.isArray(agentPackage?.productShell?.commands) ? agentPackage.productShell.commands : [];
    console.log(JSON.stringify({
      ok: true,
      onboardingReady: agentPackage?.productShell?.onboardingReady !== false,
      onboardingMode: String(agentPackage?.productShell?.onboardingMode || 'productized'),
      commands,
      activationChecklist: [
        { step: 'inspect package', command: 'package', ready: true },
        { step: 'inspect shell status', command: 'status', ready: true },
        { step: 'inspect plugins', command: 'plugins', ready: true },
        { step: 'inspect onboarding', command: 'onboarding', ready: true },
        { step: 'inspect bridge routes', command: 'routes', ready: true },
        { step: 'inspect capability gate', command: 'capabilities', ready: true },
        { step: 'run onboarding doctor', command: 'doctor', ready: true },
      ],
      recommendedSteps: ['package', 'status', 'plugins', 'onboarding', 'routes', 'capabilities', 'doctor'],
    }, null, 2));
    return;
  }

  const context = await loadRunContext(runDirArg);
  if (!context.ok) {
    console.log(JSON.stringify(context, null, 2));
    process.exit(1);
  }

  if (cmd === 'doctor') {
    console.log(JSON.stringify({
      ok: !!context.shellState,
      runDir: context.runDir,
      contractVersion: context.shellState?.contractVersion || 'agent-shell.v1',
      onboardingReady: context.shellState?.onboardingReady === true,
      onboardingMode: context.shellState?.onboardingMode || 'productized',
      doctor: context.shellState?.doctor || { status: 'missing', passed: 0, total: 0, checks: [] },
      activationChecklist: Array.isArray(context.shellState?.activationChecklist) ? context.shellState.activationChecklist : [],
    }, null, 2));
    return;
  }

  if (cmd === 'routes') {
    console.log(JSON.stringify({
      ok: !!context.bridgeState,
      runDir: context.runDir,
      routes: Array.isArray(context.bridgeState?.routes) ? context.bridgeState.routes : [],
      defaultChannel: context.bridgeState?.defaultChannel || '',
      ingressCount: context.bridgeState?.counts?.ingress || 0,
      egressCount: context.bridgeState?.counts?.egress || 0,
    }, null, 2));
    return;
  }

  if (cmd === 'capabilities') {
    console.log(JSON.stringify({
      ok: !!context.runReport,
      runDir: context.runDir,
      injectedCapabilities: context.runReport?.injectedCapabilities || { tools: [], skills: [], bridgeRoutes: [], shellCommands: [] },
      capabilityGate: context.runReport?.capabilityGate || null,
      bridgeRouteContracts: context.runReport?.bridge?.routeContracts || context.runReport?.bridge?.state?.routeContracts || [],
      toolCount: Array.isArray(context.runReport?.toolRegistry) ? context.runReport.toolRegistry.length : 0,
      skillCount: Array.isArray(context.runReport?.skillRegistry) ? context.runReport.skillRegistry.length : 0,
    }, null, 2));
    return;
  }

  if (cmd === 'status') {
    console.log(JSON.stringify({
      ok: !!context.shellState && !!context.runReport,
      runDir: context.runDir,
      shellState: context.shellState,
      runStatus: context.runReport?.status || '',
      runId: context.runReport?.runId || '',
      pluginCount: context.runReport?.runtimeEvidence?.pluginCount || 0,
      injectedToolCount: context.runReport?.runtimeEvidence?.pluginInjectedToolCount || 0,
      injectedSkillCount: context.runReport?.runtimeEvidence?.pluginInjectedSkillCount || 0,
      bridgeReady: context.runReport?.runtimeEvidence?.bridgeReady === true,
      bridgeRouteCount: context.runReport?.runtimeEvidence?.bridgeRouteCount || 0,
      lifecycleReady: context.runReport?.runtimeEvidence?.lifecycleReady === true,
      runReportPath: path.join(context.runDir, 'run-report.json'),
      shellStatePath: path.join(context.runDir, 'runtime', 'shell-state.json'),
    }, null, 2));
    return;
  }

  usage();
  process.exit(1);
}

await main();
