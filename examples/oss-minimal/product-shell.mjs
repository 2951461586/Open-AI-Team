import fs from 'node:fs/promises';
import path from 'node:path';

async function ensureDir(dir = '') {
  if (!dir) return;
  await fs.mkdir(dir, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

export function createProductShell({ shellStatePath = '', commands = [], extraCommands = [], capabilityPolicy = null } = {}) {
  let lastState = null;

  function buildDoctorChecks(extra = {}) {
    const routeCount = Math.max(Number(extra.bridgeRouteCount || 0), Array.isArray(extra.bridgeRoutes) ? extra.bridgeRoutes.length : 0, Number(lastState?.bridgeRouteCount || 0), Array.isArray(lastState?.bridgeRoutes) ? lastState.bridgeRoutes.length : 0);
    const pluginCount = Math.max(Number(extra.pluginCount || 0), Number(extra.injectedToolCount || 0), Number(extra.injectedSkillCount || 0), Number(lastState?.pluginCount || 0), Number(lastState?.injectedToolCount || 0), Number(lastState?.injectedSkillCount || 0));
    const checks = [
      { key: 'package', label: 'agent package loaded', ok: true },
      { key: 'shell', label: 'product shell state writable', ok: !!shellStatePath },
      { key: 'capabilityGate', label: 'capability gate present', ok: !!capabilityPolicy },
      { key: 'commands', label: 'shell commands registered', ok: [...new Set([...(Array.isArray(commands) ? commands : []), ...(Array.isArray(extraCommands) ? extraCommands : [])])].length >= 4 },
      { key: 'routes', label: 'bridge routes observable', ok: routeCount >= 1 },
      { key: 'plugins', label: 'plugin surface injected', ok: pluginCount >= 1 },
      { key: 'desk', label: 'desk surface ready', ok: extra.deskReady !== false && lastState?.deskReady !== false },
      { key: 'sessionBus', label: 'session bus ready', ok: extra.sessionBusReady !== false && lastState?.sessionBusReady !== false },
    ];
    return checks;
  }

  function buildActivationChecklist(extra = {}) {
    return [
      { step: 'inspect package', command: 'package', ready: true },
      { step: 'inspect shell status', command: 'status', ready: extra.runBound !== false },
      { step: 'inspect plugins', command: 'plugins', ready: true },
      { step: 'inspect onboarding', command: 'onboarding', ready: true },
      { step: 'inspect bridge routes', command: 'routes', ready: extra.runBound !== false },
      { step: 'inspect capability gate', command: 'capabilities', ready: extra.runBound !== false },
      { step: 'run onboarding doctor', command: 'doctor', ready: true },
    ];
  }

  async function writeState(extra = {}) {
    await ensureDir(path.dirname(shellStatePath));
    const merged = { ...(lastState || {}), ...extra };
    const resolvedCommands = [...new Set([...(Array.isArray(commands) ? commands : []), ...(Array.isArray(extraCommands) ? extraCommands : [])])];
    const doctorChecks = buildDoctorChecks(merged);
    const doctorPassed = doctorChecks.filter((item) => item.ok).length;
    const doctorTotal = doctorChecks.length;
    lastState = {
      ...merged,
      contractVersion: 'agent-shell.v1',
      updatedAt: nowIso(),
      onboardingReady: doctorPassed === doctorTotal,
      onboardingMode: 'productized',
      commands: resolvedCommands,
      capabilityPolicy: capabilityPolicy || null,
      doctor: {
        status: doctorPassed === doctorTotal ? 'pass' : 'warn',
        passed: doctorPassed,
        total: doctorTotal,
        checks: doctorChecks,
      },
      activationChecklist: buildActivationChecklist(merged),
      status: 'ready',
    };
    await fs.writeFile(shellStatePath, JSON.stringify(lastState, null, 2));
    return lastState;
  }

  async function init() {
    const state = await writeState();
    return { shellStatePath, state };
  }

  async function update(extra = {}) {
    const state = await writeState({ ...(lastState || {}), ...extra });
    return { shellStatePath, state };
  }

  return {
    kind: 'product_shell',
    contractVersion: 'agent-shell.v1',
    init,
    update,
    paths: { shellStatePath },
  };
}
