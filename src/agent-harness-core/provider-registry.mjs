import fs from 'node:fs/promises';
import path from 'node:path';
import { createWorkspaceSandbox } from './sandbox.mjs';
import { createLocalToolRuntime } from './tool-runtime.mjs';
import { createFileStateBackend } from './backend-provider.mjs';
import { createLocalHostLayer } from './host-layer.mjs';
import { createCommandRuntime } from './command-runtime.mjs';
import { createLocalPluginSystem } from './plugin-system.mjs';
import { createLocalBridgeHost } from './bridge-host.mjs';
import { createLifecycleRuntime } from './lifecycle-runtime.mjs';
import { createProductShell } from './product-shell.mjs';

async function ensureDir(dir = '') {
  if (!dir) return;
  await fs.mkdir(dir, { recursive: true });
}

async function writeText(filePath = '', content = '') {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, String(content || ''), 'utf8');
}

function normalizeText(value = '') {
  return String(value || '').trim();
}

function buildSearchTokens(query = '') {
  const raw = normalizeText(query).toLowerCase();
  const split = raw.split(/[\s,，。；;：:/|_-]+/).filter(Boolean);
  if (split.length === 0 && raw) return [raw];
  return split.length > 0 ? split : [];
}

export function createLocalEventBus({ initialEvents = [] } = {}) {
  const events = Array.isArray(initialEvents) ? [...initialEvents] : [];
  return {
    kind: 'event_bus',
    emit(event = {}) {
      events.push({ ...event, ts: event.ts || Date.now() });
    },
    list() {
      return [...events];
    },
  };
}

export function createLocalMemoryProvider({ memoryDir = '', seedEntries = [], initialBlackboard = {}, initialDurableArtifacts = [] } = {}) {
  const blackboard = { ...(initialBlackboard || {}) };
  const durableArtifacts = Array.isArray(initialDurableArtifacts) ? [...initialDurableArtifacts] : [];
  const knowledgeBase = Array.isArray(seedEntries) ? seedEntries.map((entry, index) => ({
    id: entry.id || `seed:${index + 1}`,
    title: normalizeText(entry.title || `Seed ${index + 1}`),
    text: normalizeText(entry.text || ''),
    keywords: Array.isArray(entry.keywords) ? entry.keywords.map((x) => normalizeText(x)).filter(Boolean) : [],
  })) : [];

  function writeBlackboard(section = '', value = {}) {
    if (!section) return;
    blackboard[section] = value;
  }

  function addArtifact(entry = {}) {
    durableArtifacts.push(entry);
  }

  async function retrieve(query = '', { limit = 5 } = {}) {
    const tokens = buildSearchTokens(query);
    const rows = [];

    for (const entry of knowledgeBase) {
      rows.push({
        scope: 'knowledgeBase',
        id: entry.id,
        title: entry.title,
        text: `${entry.title}\n${entry.text}\n${entry.keywords.join(' ')}`,
      });
    }

    for (const [section, value] of Object.entries(blackboard)) {
      rows.push({
        scope: 'blackboard',
        id: `blackboard:${section}`,
        title: section,
        text: JSON.stringify(value),
      });
    }

    for (const [index, entry] of durableArtifacts.entries()) {
      rows.push({
        scope: 'durableArtifacts',
        id: entry.id || `artifact:${index + 1}`,
        title: normalizeText(entry.title || entry.path || `Artifact ${index + 1}`),
        text: `${normalizeText(entry.summary || '')}\n${normalizeText(entry.path || '')}\n${normalizeText(entry.role || '')}`,
      });
    }

    const scored = rows.map((row) => {
      const hay = normalizeText(row.text).toLowerCase();
      let score = 0;
      if (tokens.length === 0) score = hay ? 1 : 0;
      for (const token of tokens) {
        if (!token) continue;
        if (hay.includes(token)) score += token.length > 2 ? 2 : 1;
      }
      return { ...row, score };
    }).filter((row) => row.score > 0);

    scored.sort((a, b) => b.score - a.score || a.scope.localeCompare(b.scope) || a.title.localeCompare(b.title));
    return scored.slice(0, Math.max(1, Number(limit || 5))).map((row) => ({
      scope: row.scope,
      id: row.id,
      title: row.title,
      score: row.score,
      snippet: normalizeText(row.text).slice(0, 240),
    }));
  }

  return {
    kind: 'memory_provider',
    blackboard,
    durableArtifacts,
    knowledgeBase,
    writeBlackboard,
    addArtifact,
    retrieve,
    async flush() {
      await ensureDir(memoryDir);
      const blackboardPath = path.join(memoryDir, 'blackboard.json');
      const durableMemoryPath = path.join(memoryDir, 'durable-memory.json');
      await fs.writeFile(blackboardPath, JSON.stringify(blackboard, null, 2));
      await fs.writeFile(durableMemoryPath, JSON.stringify({ knowledgeBase, durableArtifacts }, null, 2));
      return { blackboardPath, durableMemoryPath };
    },
  };
}

export function createLocalArtifactStore({ artifactDir = '' } = {}) {
  return {
    kind: 'artifact_store',
    async writeMarkdown(name = '', content = '') {
      const filePath = path.join(artifactDir, name);
      await writeText(filePath, content);
      return filePath;
    },
  };
}

export function createLocalSandboxProvider({ workspaceDir = '', policy = {} } = {}) {
  return createWorkspaceSandbox({ workspaceDir, policy });
}

export function createLocalToolProvider({ toolRegistry = [], toolRuntime = null } = {}) {
  return {
    kind: 'tool_provider',
    registry: toolRegistry,
    listTools() {
      return [...toolRegistry];
    },
    async execute(tool = '', args = {}) {
      if (!toolRuntime?.run) return { ok: false, error: 'tool_runtime_unavailable' };
      return toolRuntime.run(tool, args);
    },
  };
}

export function createLocalToolRuntimeProvider({ sandbox, eventBus = null, outputDir = '', memoryProvider = null, commandRuntime = null, bridgeHost = null, lifecycleRuntime = null, productShell = null, capabilityGate = null, initialRuns = [] } = {}) {
  return createLocalToolRuntime({ sandbox, eventBus, outputDir, memoryProvider, commandRuntime, bridgeHost, lifecycleRuntime, productShell, capabilityGate, initialRuns });
}

export function createCommandRuntimeProvider({ workspaceDir = '', policy = {} } = {}) {
  return createCommandRuntime({ workspaceDir, policy });
}

export function createFileStateBackendProvider({ paths = {}, runId = '' } = {}) {
  return createFileStateBackend({ paths, runId });
}

export function createLocalHostLayerProvider({ paths = {}, eventBus = null, backendProvider = null, runId = '' } = {}) {
  return createLocalHostLayer({ paths, eventBus, backendProvider, runId });
}

export function createLocalPluginSystemProvider({ paths = {}, eventBus = null, agentPackage = {} } = {}) {
  return createLocalPluginSystem({
    registryPath: String(paths.pluginRegistryPath || path.join(paths.runtimeDir || '.', 'plugins', 'plugin-registry.json')),
    eventsPath: String(paths.pluginEventsPath || path.join(paths.runtimeDir || '.', 'plugins', 'plugin-events.json')),
    pluginRefs: Array.isArray(agentPackage?.pluginRefs) ? agentPackage.pluginRefs : [],
    eventBus,
  });
}

export function createLocalBridgeHostProvider({ paths = {}, eventBus = null, agentPackage = {}, pluginSystem = null } = {}) {
  const injected = pluginSystem?.getInjectedCapabilities?.() || { bridgeRoutes: [] };
  return createLocalBridgeHost({
    bridgeStatePath: String(paths.bridgeStatePath || path.join(paths.runtimeDir || '.', 'bridge', 'bridge-state.json')),
    channels: Array.isArray(agentPackage?.bridgePolicy?.channels) ? agentPackage.bridgePolicy.channels : [],
    defaultChannel: String(agentPackage?.bridgePolicy?.defaultChannel || ''),
    routes: Array.isArray(injected.bridgeRoutes) ? injected.bridgeRoutes : [],
    routeContracts: Array.isArray(agentPackage?.bridgePolicy?.routeContracts) ? agentPackage.bridgePolicy.routeContracts : [],
    eventBus,
  });
}

export function createLifecycleRuntimeProvider({ paths = {}, eventBus = null, agentPackage = {} } = {}) {
  return createLifecycleRuntime({
    lifecycleStatePath: String(paths.lifecycleStatePath || path.join(paths.runtimeDir || '.', 'lifecycle-state.json')),
    personaStatePath: String(paths.personaStatePath || path.join(paths.memoryDir || '.', 'persona-state.json')),
    agentPackage,
    eventBus,
  });
}

export function createProductShellProvider({ paths = {}, agentPackage = {}, pluginSystem = null } = {}) {
  const injected = pluginSystem?.getInjectedCapabilities?.() || { shellCommands: [] };
  return createProductShell({
    shellStatePath: String(paths.shellStatePath || path.join(paths.runtimeDir || '.', 'shell-state.json')),
    commands: Array.isArray(agentPackage?.productShell?.commands) ? agentPackage.productShell.commands : [],
    extraCommands: Array.isArray(injected.shellCommands) ? injected.shellCommands : [],
    capabilityPolicy: agentPackage?.runtimeCapabilityPolicy || null,
  });
}

export function createLocalModelProvider() {
  return {
    kind: 'model_provider',
    buildTaskPlan(userText = '') {
      return {
        action: 'delegate',
        summary: '这是一个需要完整产出的任务，按 planner → executor → critic → judge 编排，并允许 critic 触发一次 retrieval/replan。',
        taskMode: 'analysis',
        riskLevel: 'medium',
        workItems: [
          {
            id: 'w1',
            role: 'planner',
            title: '生成执行计划',
            objective: userText,
            task: '给出最小开源 harness 样板的规划。',
            acceptance: '明确角色、registry、memory、artifact、report。',
            deliverables: ['PLAN.md'],
            dependencies: [],
          },
          {
            id: 'w2',
            role: 'executor',
            title: '生成最小样板交付',
            objective: userText,
            task: '先输出最小可运行样板的核心交付，但先不要主动补 retrieval 证据。',
            acceptance: '给出 workspace / artifact / report 级结果。',
            deliverables: ['DELIVERABLE.md'],
            dependencies: ['w1'],
          },
          {
            id: 'w3',
            role: 'critic',
            title: '审查最小样板结果',
            objective: '审查 executor 结果是否达到独立最小 harness 标准。',
            task: '基于 planner 与 executor 结果给出 review verdict；如果缺少 retrieval 证据，要明确要求 replan。',
            acceptance: '返回 approve / revise 级别结论。',
            deliverables: ['REVIEW.md'],
            dependencies: ['w2'],
          },
          {
            id: 'w4',
            role: 'judge',
            title: '裁决是否可作为开源样板',
            objective: '给出最终是否可交付的裁决。',
            task: '综合 planner / executor / critic 输出做 final decision。',
            acceptance: '返回 approve / reject。',
            deliverables: ['DECISION.md'],
            dependencies: ['w3'],
          }
        ]
      };
    },
  };
}
