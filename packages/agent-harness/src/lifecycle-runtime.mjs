import fs from 'node:fs/promises';
import path from 'node:path';

async function ensureDir(dir = '') {
  if (!dir) return;
  await fs.mkdir(dir, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

export function createLifecycleRuntime({ lifecycleStatePath = '', personaStatePath = '', agentPackage = {}, eventBus = null } = {}) {
  async function init() {
    await ensureDir(path.dirname(lifecycleStatePath));
    await ensureDir(path.dirname(personaStatePath));
    const persona = {
      contractVersion: 'agent-persona-state.v1',
      updatedAt: nowIso(),
      identity: agentPackage?.identity || {},
      mission: agentPackage?.identity?.persona?.mission || '',
    };
    const lifecycle = {
      contractVersion: 'agent-harness-lifecycle.v1',
      updatedAt: nowIso(),
      heartbeatEnabled: agentPackage?.lifecyclePolicy?.heartbeatEnabled !== false,
      cronEnabled: agentPackage?.lifecyclePolicy?.cronEnabled !== false,
      personaSnapshots: agentPackage?.lifecyclePolicy?.personaSnapshots !== false,
      lastHeartbeatAt: nowIso(),
      nextSuggestedTick: nowIso(),
    };
    await fs.writeFile(personaStatePath, JSON.stringify(persona, null, 2));
    await fs.writeFile(lifecycleStatePath, JSON.stringify(lifecycle, null, 2));
    eventBus?.emit?.({ type: 'lifecycle.initialized', heartbeatEnabled: lifecycle.heartbeatEnabled, cronEnabled: lifecycle.cronEnabled });
    return { lifecycleStatePath, personaStatePath, lifecycle, persona };
  }

  return {
    kind: 'lifecycle_runtime',
    contractVersion: 'agent-harness-lifecycle.v1',
    init,
    paths: { lifecycleStatePath, personaStatePath },
  };
}
