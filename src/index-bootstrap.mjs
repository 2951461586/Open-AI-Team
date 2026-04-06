import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { openTeamStore } from './team/team-store.mjs';
import { loadTeamPolicy } from './team/team-policy.mjs';
import { createTLRuntime } from './team/team-tl-runtime.mjs';
import { createModelRouter } from './agent-harness-core/model-router.mjs';
import { createNativeChatRuntime } from './team/team-native-chat.mjs';
import { createSessionCompletionBus } from './team/team-session-completion-bus.mjs';
import { loadTeamRoleDeployment } from './team/team-role-deployment.mjs';
import { createTeamResidentRuntime } from './team/team-resident-runtime.mjs';
import { createAgentLifecycleManager } from './team/team-agent-lifecycle.mjs';
import { createGovernanceRuntime } from './team/team-governance-runtime.mjs';
import { createGovernanceAuditor } from './team/governance-auditor.mjs';
import { createCriticSessionRunner } from './team/team-agent-critic-session-runner.mjs';
import { createNoopSessionRuntimeAdapter, createSessionRuntimeAdapter } from './team-runtime-adapters/session-runtime-adapter.mjs';
import { createStandaloneProductRuntime } from './agent-harness-core/standalone-product-runtime.mjs';
import { loadHostRuntimeConfig } from './index-host-config.mjs';
import { resolveRemoteSessionHostBootstrap } from './integrations/host-bootstrap-selector.mjs';
import { createTeamNodeHealth } from './team/team-node-health.mjs';
import { createRuntimeExecutionAdapter } from './team-runtime-adapters/execution-harness.mjs';
import { createControlPlaneClient } from './team-runtime-adapters/control-plane.mjs';
import { createEventBus } from './team/event-bus.mjs';
import { createIMChannelRouter } from './team/im-channel-router.mjs';
import { createTraceCollector } from './observability/trace-span.mjs';
import { FileTraceExporter } from './observability/trace-exporter.mjs';

export async function createRemoteSessionHostBootstrap(config = {}) {
  return (await resolveRemoteSessionHostBootstrap(config)) || createHostAgnosticBootstrap(config);
}

export async function createControlPlaneHostBootstrap(config = {}) {
  return createRemoteSessionHostBootstrap(config);
}

export function createHostAgnosticBootstrap(config = {}) {
  return {
    hostKind: 'host-agnostic',
    createNodeHealth({ teamStore = null } = {}) {
      return createTeamNodeHealth({ teamStore });
    },
    createSessionSubstrate({ roleDeployment } = {}) {
      const sessionControlPlane = createControlPlaneClient({
        roleDeployment,
        nodeControls: {},
      });
      const runtimeAdapter = createNoopSessionRuntimeAdapter({ provider: 'session-substrate' });
      const executionAdapter = createRuntimeExecutionAdapter({ runtimeAdapter });
      return {
        provider: 'session-substrate',
        sessionSubstrate: null,
        sessionControlPlane,
        runtimeAdapter,
        executionAdapter,
        agentHarness: runtimeAdapter,
        executionHarness: executionAdapter,
      };
    },
  };
}

export function createStandaloneBrokerBootstrap(config = {}) {
  return {
    hostKind: 'standalone-broker',
    createNodeHealth({ teamStore = null } = {}) {
      return createTeamNodeHealth({ teamStore });
    },
    async createSessionSubstrate() {
      const harness = await createStandaloneProductRuntime();
      const runsRoot = String(harness?.runsRoot || '');
      const buildPaths = typeof harness?.buildPaths === 'function' ? harness.buildPaths : null;
      const loadState = typeof harness?.loadState === 'function' ? harness.loadState : null;

      async function listRunDirs() {
        if (!runsRoot) return [];
        try {
          const fs = await import('node:fs/promises');
          const entries = await fs.readdir(runsRoot, { withFileTypes: true });
          return entries.filter((entry) => entry.isDirectory()).map((entry) => `${runsRoot}/${entry.name}`);
        } catch {
          return [];
        }
      }

      async function readSessionBusMessages(runDir = '') {
        if (!buildPaths || !runDir) return [];
        try {
          const fs = await import('node:fs/promises');
          const busPath = buildPaths(runDir)?.hostSessionBusPath || '';
          if (!busPath) return [];
          const raw = await fs.readFile(busPath, 'utf8');
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed?.messages) ? parsed.messages : [];
        } catch {
          return [];
        }
      }

      const runtimeAdapter = createSessionRuntimeAdapter({
        provider: 'standalone-broker-productized',
        probeRoleImpl: async (role = '') => ({
          ok: true,
          provider: 'standalone-broker-productized',
          role,
          selectedNode: 'broker-cluster',
          deployment: {
            selectedNode: 'broker-cluster',
            executionMode: 'remote_broker_http',
            outwardIdentity: `standalone:${role}`,
          },
          status: 200,
          error: '',
        }),
        spawnForRoleImpl: async ({ role = '', onChunk = null, ...request } = {}) => {
          const result = await harness.runTask(request.task || request.objective || '', { onChunk });
          const roleResult = Array.isArray(result?.results)
            ? result.results.find((item) => String(item?.role || '') === String(role || '')) || result.results.at(-1)
            : null;
          const sessionKey = String(result?.sessionKey || result?.childSessionKey || result?.runId || result?.standaloneRunId || '');
          return {
            ok: !!result?.ok,
            provider: 'standalone-broker-productized',
            via: 'remote_broker_http.productized',
            sessionKey,
            childSessionKey: sessionKey,
            reply: JSON.stringify({
              summary: String(roleResult?.summary || result?.decision?.summary || 'standalone broker execution finished'),
              deliverables: Array.isArray(result?.memory?.durableArtifacts) ? result.memory.durableArtifacts.map((item) => item.path).filter(Boolean) : [],
              blackboardUpdate: { standaloneBrokerRunId: result?.runId || '' },
            }),
            artifactPath: roleResult?.artifactPath || result?.runReportPath || '',
            brokerId: roleResult?.brokerId || '',
            brokerJobId: roleResult?.brokerJobId || '',
            schedulerDispatchId: roleResult?.schedulerDispatchId || '',
            schedulerLeaseId: roleResult?.schedulerLeaseId || '',
            workerPid: roleResult?.workerPid || 0,
            workerEventLog: Array.isArray(result?.results) ? result.results : [],
            workerToolRuns: [],
            standaloneRunId: result?.runId || '',
            runReportPath: result?.runReportPath || '',
          };
        },
        sendToSessionImpl: async ({ sessionKey = '', text = '', message = '', role = 'user', payload = {} } = {}) => {
          const key = String(sessionKey || '').trim();
          if (!key || !runsRoot) return { ok: false, error: 'session_key_required', via: 'standalone-broker-productized' };
          const runDir = `${runsRoot}/${key}`;
          const state = loadState ? await loadState(runDir).catch(() => null) : null;
          if (!state) return { ok: false, error: 'session_not_found', via: 'standalone-broker-productized' };
          const fs = await import('node:fs/promises');
          const busPath = buildPaths(runDir)?.hostSessionBusPath || '';
          const current = await readSessionBusMessages(runDir);
          current.push({ sessionKey: key, role: String(role || 'user'), text: String(text || message || payload?.text || ''), createdAt: new Date().toISOString(), ...payload });
          await fs.writeFile(busPath, JSON.stringify({ contractVersion: 'agent-harness-host-session-bus.v1', messages: current }, null, 2));
          return { ok: true, via: 'standalone-broker-productized', sessionKey: key };
        },
        listSessionsForSessionImpl: async ({ sessionKey = '', limit = 100 } = {}) => {
          const dirs = await listRunDirs();
          const target = String(sessionKey || '').trim();
          const rows = [];
          for (const runDir of dirs) {
            const state = loadState ? await loadState(runDir).catch(() => null) : null;
            if (!state?.runId) continue;
            if (target && String(state.runId) !== target) continue;
            const messages = await readSessionBusMessages(runDir);
            const last = messages.at(-1) || {};
            rows.push({
              sessionKey: String(state.runId),
              childSessionKey: String(state.runId),
              messageCount: messages.length,
              lastMessageAt: String(last.createdAt || state.updatedAt || ''),
              lastMessage: String(last.text || ''),
            });
          }
          rows.sort((a, b) => String(b.lastMessageAt || '').localeCompare(String(a.lastMessageAt || '')));
          return { ok: true, via: 'standalone-broker-productized', sessions: rows.slice(0, Math.max(1, Number(limit || 100))) };
        },
        getSessionHistoryImpl: async ({ sessionKey = '', limit = 50 } = {}) => {
          const key = String(sessionKey || '').trim();
          if (!key || !runsRoot) return { ok: false, error: 'session_key_required', via: 'standalone-broker-productized' };
          const runDir = `${runsRoot}/${key}`;
          const state = loadState ? await loadState(runDir).catch(() => null) : null;
          if (!state) return { ok: false, error: 'session_not_found', via: 'standalone-broker-productized' };
          const messages = (await readSessionBusMessages(runDir)).slice(-Math.max(1, Number(limit || 50))).map((item, idx) => ({
            id: `msg:${idx + 1}`,
            role: String(item?.role || 'user'),
            text: String(item?.text || ''),
            content: String(item?.text || ''),
            createdAt: String(item?.createdAt || ''),
            payload: item,
          }));
          return { ok: true, via: 'standalone-broker-productized', sessionKey: key, messages };
        },
      });
      const executionAdapter = createRuntimeExecutionAdapter({ runtimeAdapter });
      return {
        provider: 'standalone-broker-productized',
        sessionSubstrate: null,
        sessionControlPlane: null,
        runtimeAdapter,
        executionAdapter,
        agentHarness: harness,
        executionHarness: executionAdapter,
      };
    },
  };
}

export async function createAppContext(config = {}) {
  const now = () => Date.now();
  const idgen = (prefix = 'id') => `${prefix}:${randomUUID()}`;

  const teamStore = openTeamStore(config.TEAM_DB_PATH);
  const TEAM_POLICY = loadTeamPolicy(config.ENV);
  const hostConfig = loadHostRuntimeConfig(config);
  const TEAM_ROLE_DEPLOYMENT = loadTeamRoleDeployment({ ...(config.ENV || {}), TEAM_WORKSPACE_ROOT: hostConfig.workspaceRoot });

  const hostBootstrap = config.hostBootstrap
    || (config.sessionSubstrate === 'host-agnostic'
      ? createHostAgnosticBootstrap(config)
      : config.sessionSubstrate === 'standalone-broker'
        ? createStandaloneBrokerBootstrap(config)
        : await createRemoteSessionHostBootstrap(config));

  const teamNodeHealth = hostBootstrap.createNodeHealth({ teamStore });
  void teamNodeHealth.refreshNodeStatus?.().catch(() => {});
  setTimeout(() => { teamNodeHealth.refreshNodeStatus?.().catch(() => {}); }, 2000).unref?.();
  setTimeout(() => { teamNodeHealth.refreshNodeStatus?.().catch(() => {}); }, 5000).unref?.();
  setInterval(() => { teamNodeHealth.refreshNodeStatus?.().catch(() => {}); }, 30000).unref?.();

  const governanceConfigPath = new URL('../config/team/governance.json', import.meta.url);
  const teamEventBus = createEventBus();
  const traceExporter = new FileTraceExporter(config.TRACE_LOG_PATH || 'state/observability/traces.jsonl');
  const traceCollector = createTraceCollector({
    traceLogPath: traceExporter.filePath,
    exporter: traceExporter,
    flushIntervalMs: Number(config.TRACE_FLUSH_INTERVAL_MS || 5000),
    maxBufferSize: Number(config.TRACE_MAX_BUFFER_SIZE || 50),
  });
  const governanceAuditor = createGovernanceAuditor({ eventBus: teamEventBus });
  const governanceRuntime = createGovernanceRuntime(governanceConfigPath, { eventBus: teamEventBus, teamStore, auditor: governanceAuditor });
  const governanceConfigMeta = governanceRuntime.getConfigMeta?.() || {};
  if (governanceConfigMeta.loaded) {
    console.log(`[governance] loaded version=${governanceConfigMeta.version || 'unknown'} path=${governanceConfigMeta.path || 'unknown'}${governanceConfigMeta.usedFallback ? ' fallback=true' : ''}`);
  } else {
    console.warn(`[governance] config not loaded; path=${governanceConfigMeta.path || 'default-search'}; defaults in effect`);
  }
  const lifecycleConfig = governanceRuntime.getLifecycleConfig?.() || {};

  const agentLifecycle = createAgentLifecycleManager({
    defaultLeaseDurationMs: Number(lifecycleConfig.leaseDefaultMs || 5 * 60 * 1000),
    heartbeatGracePeriodMs: Number(lifecycleConfig.gracePeriodMs || 90 * 1000),
    now,
    onAgentExpired: (reg) => { console.warn(`[lifecycle] agent expired: ${reg.agentId} (role=${reg.role}, node=${reg.node})`); },
    onAgentDraining: (reg) => { console.log(`[lifecycle] agent draining: ${reg.agentId} (role=${reg.role})`); },
  });
  setInterval(() => {
    const expired = agentLifecycle.sweepExpired();
    if (expired.length > 0) console.log(`[lifecycle] swept ${expired.length} expired agent(s): ${expired.map(r => r.agentId).join(', ')}`);
  }, Number(lifecycleConfig.sweepIntervalMs || 30000)).unref?.();

  const teamResidentRuntime = createTeamResidentRuntime({ teamStore, roleDeployment: TEAM_ROLE_DEPLOYMENT, teamNodeHealth, now, idgen });
  const sessionSubstrate = await Promise.resolve(hostBootstrap.createSessionSubstrate({ roleDeployment: TEAM_ROLE_DEPLOYMENT }));
  const sessionControlPlane = sessionSubstrate.sessionControlPlane || sessionSubstrate.sessionSubstrate || null;
  const runtimeAdapter = sessionSubstrate.runtimeAdapter;
  const executionAdapter = sessionSubstrate.executionAdapter;

  const roleConfigForTL = (() => {
    try { return JSON.parse(fs.readFileSync(new URL('../config/team/roles.json', import.meta.url), 'utf8')); } catch { return TEAM_ROLE_DEPLOYMENT || {}; }
  })();

  const nativeChat = createNativeChatRuntime({
    baseUrl: hostConfig?.nativeChat?.baseUrl || 'http://127.0.0.1:8317/v1',
    apiKey: hostConfig?.nativeChat?.apiKey || '',
    model: hostConfig?.nativeChat?.model || 'gpt-5.4',
  });
  const sessionCompletionBus = createSessionCompletionBus();
  const modelRouter = createModelRouter({
    auditLogger: async ({ ok, response, error, routeInfo, selectedModel, fallbackUsed }) => {
      await governanceAuditor?.logAgentBehavior?.({
        action: 'llm.call',
        role: 'tl',
        message: ok ? 'model router call completed' : `model router call failed: ${String(error || response?.error || '')}`,
        metadata: {
          routePreset: routeInfo?.preset || '',
          complexity: routeInfo?.complexity || null,
          provider: response?.provider || selectedModel?.provider || '',
          modelId: response?.model || selectedModel?.model || '',
          tokenUsage: response?.tokenUsage || null,
          latencyMs: Number(response?.latencyMs || 0),
          cost: Number(response?.cost || 0),
          fallbackUsed: !!fallbackUsed,
        },
      });
    },
    invoker: async ({ text, history, mode, systemPrompt, model }) => nativeChat.generateReply({ text, history, mode, systemPrompt, model }),
  });

  const tlRuntime = createTLRuntime({
    teamStore,
    nativeChat,
    modelRouter,
    runtimeAdapter,
    executionAdapter,
    governanceRuntime,
    governanceAuditor,
    sessionCompletionBus,
    eventBus: teamEventBus,
    traceCollector,
    roleConfig: roleConfigForTL,
    workspaceRoot: hostConfig.taskWorkspaceRoot,
    now,
    idgen,
  });

  const criticSessionRunner = createCriticSessionRunner({ teamStore, tlRuntime });
  const imChannelRouter = createIMChannelRouter({
    tlRuntime,
    teamStore,
    governanceRuntime,
  });
  await imChannelRouter.initEnabledChannels();

  return {
    now,
    idgen,
    teamStore,
    TEAM_POLICY,
    TEAM_ROLE_DEPLOYMENT,
    teamNodeHealth,
    teamResidentRuntime,
    agentLifecycle,
    JUDGE_TRUE_EXECUTION_WIRED: true,
    criticSessionRunner,
    tlRuntime,
    governanceAuditor,
    traceCollector,
    imChannelRouter,
    nativeChat,
    hostBootstrap,
    hostConfig,
    sessionControlPlane,
    runtimeAdapter,
    executionAdapter,
    agentHarness: sessionSubstrate.agentHarness || runtimeAdapter,
    executionHarness: sessionSubstrate.executionHarness || executionAdapter,
    sessionSubstrateProvider: sessionSubstrate.provider || runtimeAdapter?.provider || '',
  };
}
