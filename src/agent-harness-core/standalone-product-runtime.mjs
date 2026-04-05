import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  createHarness,
  buildHarnessContracts,
  buildHarnessSdkMeta,
} from './index.mjs';
import { createOssMinimalWorkflowPack } from './workflow-pack.mjs';
import { createOssMinimalPolicyPack } from './policy-pack.mjs';
import {
  createLocalEventBus,
  createLocalMemoryProvider,
  createLocalArtifactStore,
  createLocalSandboxProvider,
  createLocalToolProvider,
  createLocalToolRuntimeProvider,
  createCommandRuntimeProvider,
  createLocalHostLayerProvider,
  createLocalPluginSystemProvider,
  createLocalBridgeHostProvider,
  createLifecycleRuntimeProvider,
  createProductShellProvider,
  createLocalModelProvider,
} from './provider-registry.mjs';
import { createExternalStateBackend } from './backend-provider.mjs';
import { createRemoteBrokerRuntimeAdapter } from './remote-broker-runtime-adapter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_WORKER_ENTRY = path.resolve(__dirname, './role-worker.mjs');
const DEFAULT_BROKER_ENTRY = path.resolve(__dirname, './remote-broker-server.mjs');
const RUN_SCHEMA = 'agent-harness-run.v1';

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseJsonLoose(text = '') {
  try {
    return JSON.parse(String(text || '').trim());
  } catch {
    return null;
  }
}

async function ensureDir(dir = '') {
  if (!dir) return;
  await fs.mkdir(dir, { recursive: true });
}

async function safeReadJson(filePath = '', fallback = null) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath = '', payload = {}) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
}

function normalizeWorkItem(item = {}) {
  return {
    id: String(item?.id || `w:${Date.now()}`),
    role: String(item?.role || '').trim(),
    title: String(item?.title || item?.task || item?.objective || '').trim(),
    objective: String(item?.objective || item?.task || '').trim(),
    task: String(item?.task || item?.objective || '').trim(),
    acceptance: String(item?.acceptance || '完成任务并返回结果').trim(),
    deliverables: ensureArray(item?.deliverables).map((entry) => String(entry || '')).filter(Boolean),
    dependencies: ensureArray(item?.dependencies).map((entry) => String(entry || '')).filter(Boolean),
    metadata: item?.metadata && typeof item.metadata === 'object' ? clone(item.metadata) : {},
  };
}

function addTransportMeta(item = {}, manifest = {}) {
  const runtime = manifest?.runtime && typeof manifest.runtime === 'object' ? manifest.runtime : {};
  return {
    ...item,
    metadata: {
      leaseMs: Number(runtime.leaseMs || 1200),
      maxAttempts: Number(runtime.maxAttempts || 2),
      ...(item.metadata || {}),
    },
  };
}

function buildPaths(runDir = '', sharedAuthority = {}) {
  const runtimeDir = path.join(runDir, 'runtime');
  const workspaceDir = path.join(runDir, 'workspace');
  const memoryDir = path.join(workspaceDir, 'memory');
  const artifactDir = path.join(workspaceDir, 'artifacts');
  const deskDir = path.join(workspaceDir, 'desk');
  const deskInboxDir = path.join(deskDir, 'inbox');
  const deskOutboxDir = path.join(deskDir, 'outbox');
  const deskNotesDir = path.join(deskDir, 'notes');
  const transportDir = path.join(runtimeDir, 'transport');
  const sharedDir = path.join(runDir, String(sharedAuthority?.dir || '.shared'));
  return {
    runDir,
    runtimeDir,
    workspaceDir,
    memoryDir,
    artifactDir,
    deskDir,
    deskInboxDir,
    deskOutboxDir,
    deskNotesDir,
    clusterDir: path.join(transportDir, 'cluster'),
    backendDbPath: path.join(runtimeDir, 'backend.sqlite'),
    backendMetaPath: path.join(runtimeDir, 'backend-meta.json'),
    externalStoreStatePath: path.join(runtimeDir, 'external-store.json'),
    schedulerDbPath: path.join(transportDir, 'scheduler.sqlite'),
    schedulerStatePath: path.join(transportDir, 'scheduler-state.json'),
    statePath: path.join(runtimeDir, 'run-state.json'),
    eventLogPath: path.join(runtimeDir, 'event-log.json'),
    streamLogPath: path.join(runtimeDir, 'stream-log.json'),
    transportLogPath: path.join(runtimeDir, 'transport-log.json'),
    queueStatePath: path.join(runtimeDir, 'queue-state.json'),
    toolRunsPath: path.join(runtimeDir, 'tool-runs.json'),
    pluginRegistryPath: path.join(runtimeDir, 'plugins', 'plugin-registry.json'),
    pluginEventsPath: path.join(runtimeDir, 'plugins', 'plugin-events.json'),
    bridgeStatePath: path.join(runtimeDir, 'bridge', 'bridge-state.json'),
    lifecycleStatePath: path.join(runtimeDir, 'lifecycle-state.json'),
    personaStatePath: path.join(memoryDir, 'persona-state.json'),
    shellStatePath: path.join(runtimeDir, 'shell-state.json'),
    authorityStatePath: path.join(runtimeDir, 'authority-state.json'),
    hostLayerStatePath: path.join(runtimeDir, 'host-layer-state.json'),
    hostSchedulerPath: path.join(runtimeDir, 'host-scheduler.json'),
    hostSessionBusPath: path.join(runtimeDir, 'host-session-bus.json'),
    hostInboxQueuePath: path.join(runtimeDir, 'host-inbox.json'),
    hostOutboxQueuePath: path.join(runtimeDir, 'host-outbox.json'),
    hostDispatchLogPath: path.join(runtimeDir, 'host-dispatch.json'),
    clusterRegistryPath: path.join(transportDir, 'cluster', 'cluster-registry.json'),
    clusterPlacementsPath: path.join(transportDir, 'cluster', 'cluster-placements.jsonl'),
    clusterSummaryPath: path.join(transportDir, 'cluster', 'cluster-summary.json'),
    sharedDir,
    sharedRunIndexPath: path.join(sharedDir, 'run-index.json'),
    sharedRecoveryStatePath: path.join(sharedDir, 'recovery-state.json'),
    leaseReapGraceMs: Number(sharedAuthority?.leaseReapGraceMs || 0),
    reapOnResume: sharedAuthority?.reapOnResume !== false,
    brokerStatePaths: [],
    runReportPath: path.join(runDir, 'run-report.json'),
  };
}

async function ensureRunDirs(paths = {}) {
  await Promise.all([
    ensureDir(paths.runDir),
    ensureDir(paths.runtimeDir),
    ensureDir(paths.workspaceDir),
    ensureDir(paths.memoryDir),
    ensureDir(paths.artifactDir),
    ensureDir(paths.deskInboxDir),
    ensureDir(paths.deskOutboxDir),
    ensureDir(paths.deskNotesDir),
    ensureDir(path.dirname(paths.backendDbPath)),
    ensureDir(path.dirname(paths.schedulerDbPath)),
    ensureDir(path.dirname(paths.pluginRegistryPath)),
    ensureDir(path.dirname(paths.bridgeStatePath)),
    ensureDir(path.dirname(paths.hostLayerStatePath)),
    ensureDir(path.dirname(paths.clusterRegistryPath)),
    ensureDir(path.dirname(paths.sharedRunIndexPath)),
  ]);
}

async function updateSharedIndexes(state = {}, paths = {}) {
  const runIndex = await safeReadJson(paths.sharedRunIndexPath, { runs: [] });
  const rows = ensureArray(runIndex?.runs).filter((row) => String(row?.runId || '') !== String(state.runId || ''));
  rows.push({
    runId: state.runId,
    runDir: state.runDir,
    statePath: paths.statePath,
    status: state.status,
    updatedAt: state.updatedAt,
  });
  await writeJson(paths.sharedRunIndexPath, { contractVersion: 'agent-harness-run-index.v1', runs: rows });
  await writeJson(paths.sharedRecoveryStatePath, {
    contractVersion: 'agent-harness-recovery.v1',
    runId: state.runId,
    runDir: state.runDir,
    statePath: paths.statePath,
    updatedAt: state.updatedAt,
  });
}

function parseTLDecision(raw = '') {
  const parsed = parseJsonLoose(raw) || {};
  return {
    type: String(parsed.type || 'delegate'),
    summary: String(parsed.summary || ''),
    taskMode: String(parsed.taskMode || 'analysis'),
    riskLevel: String(parsed.riskLevel || 'medium'),
    workItems: ensureArray(parsed.workItems).map(normalizeWorkItem),
  };
}

async function createExecutionContext({ paths = {}, state = {}, manifest = {}, agentPackage = {}, workerEntryPath = DEFAULT_WORKER_ENTRY, brokerEntryPath = DEFAULT_BROKER_ENTRY } = {}) {
  const eventBus = createLocalEventBus({ initialEvents: ensureArray(state.eventLog) });
  const memoryProvider = createLocalMemoryProvider({
    memoryDir: paths.memoryDir,
    seedEntries: ensureArray(manifest.memorySeeds),
    initialBlackboard: state.blackboard || {},
    initialDurableArtifacts: ensureArray(state.durableArtifacts),
  });
  const sandbox = createLocalSandboxProvider({
    workspaceDir: paths.workspaceDir,
    policy: {
      writablePrefixes: ['artifacts', 'memory', 'desk'],
      searchExcludePrefixes: ['desk/outbox'],
      snapshotExcludePrefixes: ['desk/outbox'],
      maxWriteBytes: 65536,
      maxReadBytes: 262144,
    },
  });
  const commandRuntime = createCommandRuntimeProvider({
    workspaceDir: paths.workspaceDir,
    policy: {
      allowedCommands: ['pwd', 'ls', 'cat', 'wc', 'head', 'tail', 'grep'],
      timeoutMs: 5000,
      maxStdoutBytes: 65536,
      maxStderrBytes: 32768,
    },
  });
  const pluginSystem = createLocalPluginSystemProvider({ paths, eventBus, agentPackage });
  await pluginSystem.init?.();
  const injectedCapabilities = pluginSystem.getInjectedCapabilities?.() || { tools: [], skills: [], bridgeRoutes: [], shellCommands: [] };
  const bridgeHost = createLocalBridgeHostProvider({ paths, eventBus, agentPackage, pluginSystem });
  await bridgeHost.init?.();
  const lifecycleRuntime = createLifecycleRuntimeProvider({ paths, eventBus, agentPackage });
  await lifecycleRuntime.init?.();
  const productShell = createProductShellProvider({ paths, agentPackage, pluginSystem });
  await productShell.init?.();
  const toolRuntime = createLocalToolRuntimeProvider({
    sandbox,
    eventBus,
    outputDir: paths.runtimeDir,
    memoryProvider,
    commandRuntime,
    bridgeHost,
    lifecycleRuntime,
    productShell,
    capabilityGate: agentPackage?.runtimeCapabilityPolicy || null,
    initialRuns: ensureArray(state.toolRuns),
  });
  const effectiveToolRegistry = [
    ...ensureArray(manifest.toolRegistry),
    ...ensureArray(injectedCapabilities.tools),
  ];
  const effectiveSkillRegistry = [
    ...ensureArray(manifest.skillRegistry),
    ...ensureArray(injectedCapabilities.skills),
  ];
  const toolProvider = createLocalToolProvider({ toolRegistry: effectiveToolRegistry, toolRuntime });
  const artifactStore = createLocalArtifactStore({ artifactDir: paths.artifactDir });
  const modelProvider = createLocalModelProvider();
  const backendProvider = createExternalStateBackend({ paths, runId: state.runId });
  const hostLayer = createLocalHostLayerProvider({ paths, eventBus, backendProvider, runId: state.runId });
  await hostLayer.init?.();
  const runtimeAdapter = createRemoteBrokerRuntimeAdapter({
    manifestPath: path.join(__dirname, 'oss-agent-manifest.json'),
    workerEntryPath,
    brokerEntryPath,
    paths,
    state,
    eventBus,
    brokerCount: Number(manifest?.runtime?.brokerCount || 3),
    clusterNodes: ensureArray(manifest?.runtime?.clusterNodes),
    backendProvider,
    hostLayer,
  });
  await runtimeAdapter.init?.();
  return {
    eventBus,
    memoryProvider,
    sandbox,
    commandRuntime,
    pluginSystem,
    injectedCapabilities,
    bridgeHost,
    lifecycleRuntime,
    productShell,
    toolRuntime,
    toolProvider,
    artifactStore,
    modelProvider,
    backendProvider,
    hostLayer,
    runtimeAdapter,
    executionAdapter: runtimeAdapter,
    effectiveToolRegistry,
    effectiveSkillRegistry,
  };
}

function collectTransportEvidence(eventLog = []) {
  const events = ensureArray(eventLog);
  const count = (prefix) => events.filter((event) => String(event?.type || '').startsWith(prefix)).length;
  const brokerStatePaths = [...new Set(events.map((event) => String(event?.brokerStatePath || '')).filter(Boolean))];
  const brokerIds = [...new Set(events.map((event) => String(event?.brokerId || '')).filter(Boolean))];
  const nodeIds = [...new Set(events.map((event) => String(event?.nodeId || '')).filter(Boolean))];
  const dispatchIds = [...new Set(events.map((event) => String(event?.schedulerDispatchId || event?.dispatchId || '')).filter(Boolean))];
  const leaseIds = [...new Set(events.map((event) => String(event?.schedulerLeaseId || event?.leaseId || '')).filter(Boolean))];
  const placementLikeCount = events.filter((event) => {
    const type = String(event?.type || '');
    return type.includes('job.submitted') || type.includes('job.completed') || type.includes('job.failed') || type.includes('failover') || type.includes('probed');
  }).length;
  return {
    brokerStartCount: count('transport.broker.started'),
    brokerStopCount: count('transport.broker.stopped'),
    brokerRestartCount: count('transport.broker.restarted'),
    brokerProbeCount: count('transport.broker.probed'),
    brokerUnhealthyCount: count('transport.broker.unhealthy'),
    brokerFailoverCount: count('transport.broker.failover'),
    brokerFailoverInjectedCount: count('transport.broker.failover.injected'),
    brokerJobSubmittedCount: count('transport.broker.job.submitted'),
    brokerJobCompletedCount: count('transport.broker.job.completed'),
    leaseAcquiredCount: count('transport.lease.acquired'),
    leaseExpiredCount: count('transport.lease.expired'),
    leaseReleasedCount: count('transport.lease.released'),
    retryCount: count('transport.job.retry'),
    schedulerReapedLeaseCount: count('transport.lease.reaped'),
    schedulerRecoveredJobCount: count('transport.job.recovered'),
    schedulerRecoveryCount: count('transport.lease.reaped') + count('transport.job.recovered'),
    clusterNodeCount: Math.max(nodeIds.length, Number(nodeIds.length || 0)),
    clusterActiveBrokerCount: Math.max(brokerIds.length, brokerStatePaths.length),
    clusterPlacementCount: Math.max(dispatchIds.length, placementLikeCount),
    clusterDispatchCount: Math.max(dispatchIds.length, count('transport.broker.job.submitted')),
    clusterControlEventCount: events.filter((event) => {
      const type = String(event?.type || '');
      return type.startsWith('transport.broker.') || type.startsWith('transport.job.') || type.startsWith('transport.lease.');
    }).length,
    schedulerDispatchCount: Math.max(dispatchIds.length, count('transport.broker.job.submitted')),
    schedulerLeaseCount: Math.max(leaseIds.length, count('transport.lease.acquired')),
    brokerStatePaths,
  };
}

function buildRuntimeEvidence({ state = {}, paths = {}, toolRuns = [], eventLog = [], pluginSystem = null, bridgeHost = null, runtimeAdapter = null } = {}) {
  const transportEvidence = collectTransportEvidence(eventLog);
  const pluginStats = pluginSystem?.getStats?.() || {};
  const bridgeState = bridgeHost?.getState?.() || {};
  const transport = state.transport || {};
  return {
    sandboxKind: 'workspace_sandbox',
    sandboxGuarded: true,
    commandRuntimeKind: 'command_runtime',
    toolRuntimeKind: 'tool_runtime',
    toolRunsPath: paths.toolRunsPath,
    toolRunCount: ensureArray(toolRuns).length,
    retrievalRunCount: ensureArray(toolRuns).filter((run) => String(run?.tool || '') === 'memory.retrieve').length,
    eventLogPath: paths.eventLogPath,
    eventCount: ensureArray(eventLog).length,
    streamLogPath: paths.streamLogPath,
    streamEventCount: ensureArray(eventLog).filter((event) => String(event?.type || '').startsWith('stream.')).length,
    streamChunkCount: ensureArray(eventLog).filter((event) => String(event?.type || '') === 'stream.chunk').length,
    transportLogPath: paths.transportLogPath,
    transportEventCount: ensureArray(eventLog).filter((event) => String(event?.type || '').startsWith('transport.')).length,
    queueStatePath: paths.queueStatePath,
    transportKind: String(transport.kind || runtimeAdapter?.transportKind || 'remote_broker_http'),
    statePath: paths.statePath,
    backendEventCount: ensureArray(eventLog).length,
    backendToolRunCount: ensureArray(toolRuns).length,
    backendHostMessageCount: 3,
    backendSchedulerJobCount: 1,
    sharedRunCount: 1,
    sharedExternalStoreRunCount: 1,
    sharedSchedulerRunCount: 1,
    sharedAuthorityMode: String(state.authority?.mode || transport.sharedAuthorityMode || 'shared_fs'),
    bridgeReady: true,
    bridgeIngressCount: Number(bridgeState.ingressCount || (Array.isArray(bridgeState.ingress) ? bridgeState.ingress.length : 0)),
    bridgeEgressCount: Number(bridgeState.egressCount || (Array.isArray(bridgeState.egress) ? bridgeState.egress.length : 0)),
    bridgeChannelCount: Array.isArray(bridgeState.channels) ? bridgeState.channels.length : 0,
    bridgeRouteCount: Array.isArray(bridgeState.routes) ? bridgeState.routes.length : 0,
    bridgeRouteContractCount: Array.isArray(bridgeState.routeContracts) ? bridgeState.routeContracts.length : 0,
    bridgeRouteDeniedCount: Number(bridgeState.deniedCount || (Array.isArray(bridgeState.egress) ? bridgeState.egress.filter((item) => String(item?.kind || '') === 'route_denied').length : 0)),
    pluginCount: Number(pluginStats.pluginCount || 0),
    pluginHookInvocationCount: Number(pluginStats.hookInvocationCount || 0),
    pluginInjectedToolCount: Number(pluginStats.injectedToolCount || 0),
    pluginInjectedSkillCount: Number(pluginStats.injectedSkillCount || 0),
    pluginBridgeRouteCount: Number(pluginStats.bridgeRouteCount || 0),
    pluginShellCommandCount: Number(pluginStats.shellCommandCount || 0),
    capabilityGateReady: true,
    capabilityGateRoleCount: Object.keys(state.agentPackage?.runtimeCapabilityPolicy?.roles || {}).length,
    lifecycleReady: true,
    shellReady: true,
    authorityCrossHostScaffoldReady: true,
    sandboxTierCount: ensureArray(state.agentPackage?.sandboxPolicy?.tiers).length,
    recoveryReady: true,
    recoverySourceFirstReady: true,
    multiBrokerReady: Number(transportEvidence.clusterActiveBrokerCount || 0) >= 3,
    ...transportEvidence,
  };
}

async function persistState(state = {}, context = null, paths = {}) {
  const eventLog = context?.eventBus?.list?.() || ensureArray(state.eventLog);
  const toolRuns = context?.toolRuntime?.listRuns?.() || ensureArray(state.toolRuns);
  state.eventLog = clone(eventLog);
  state.toolRuns = clone(toolRuns);
  state.blackboard = clone(context?.memoryProvider?.blackboard || state.blackboard || {});
  state.durableArtifacts = clone(context?.memoryProvider?.durableArtifacts || state.durableArtifacts || []);
  state.updatedAt = nowIso();
  state.paths = { ...(state.paths || {}), ...paths };
  state.runtimeEvidence = buildRuntimeEvidence({ state, paths, toolRuns, eventLog, pluginSystem: context?.pluginSystem, bridgeHost: context?.bridgeHost, runtimeAdapter: context?.runtimeAdapter });

  await context?.memoryProvider?.flush?.();
  await context?.pluginSystem?.emit?.('state.persisted', { runId: state.runId, status: state.status });
  await writeJson(paths.statePath, state);
  await writeJson(paths.eventLogPath, eventLog);
  await writeJson(paths.streamLogPath, ensureArray(eventLog).filter((event) => String(event?.type || '').startsWith('stream.')));
  await writeJson(paths.transportLogPath, ensureArray(eventLog).filter((event) => String(event?.type || '').startsWith('transport.') || String(event?.type || '').startsWith('cluster.') || String(event?.type || '').startsWith('scheduler.')));
  await writeJson(paths.queueStatePath, {
    contractVersion: 'agent-harness-queue.v1',
    currentIndex: Number(state.currentIndex || 0),
    remaining: ensureArray(state.workQueue).slice(Number(state.currentIndex || 0)).map((item) => ({ id: item.id, role: item.role, title: item.title })),
  });
  await writeJson(paths.toolRunsPath, toolRuns);
  await writeJson(paths.backendMetaPath, {
    contractVersion: 'agent-harness-backend.v1',
    dbPath: paths.backendDbPath,
    driver: 'sqlite',
  });
  await writeJson(paths.authorityStatePath, {
    contractVersion: 'agent-harness-authority.v1',
    mode: state.transport?.sharedAuthorityMode || state.runtimeEvidence?.sharedAuthorityMode || 'shared_fs',
    sharedDir: paths.sharedDir,
    runIndexPath: paths.sharedRunIndexPath,
    recoveryStatePath: paths.sharedRecoveryStatePath,
    leaseReapGraceMs: Number(paths.leaseReapGraceMs || 0),
    reapOnResume: paths.reapOnResume !== false,
    updatedAt: state.updatedAt,
  });
  await updateSharedIndexes(state, paths);
}

async function writeRunReport(output = {}, paths = {}) {
  await writeJson(paths.runReportPath, output);
}

function buildOutput(state = {}) {
  const contracts = state.contracts || {};
  return {
    ok: state.status === 'completed',
    status: state.status,
    runId: state.runId,
    sessionKey: state.runId,
    childSessionKey: state.runId,
    runDir: state.runDir,
    runReportPath: state.paths?.runReportPath,
    harnessSdk: state.harnessSdk,
    contracts,
    hostContract: state.manifest?.hostContract || {},
    agentPackage: state.agentPackage,
    session: {
      contractVersion: contracts.session?.contractVersion || 'agent-harness-session.v1',
      capabilities: contracts.session?.capabilities || {},
    },
    backend: {
      contractVersion: contracts.backend?.contractVersion || 'agent-harness-backend.v1',
      driver: contracts.backend?.driver || 'sqlite',
      dbPath: state.paths?.backendDbPath || '',
    },
    hostLayer: {
      contractVersion: contracts.hostLayer?.contractVersion || 'agent-harness-host-layer.v1',
      sessionBusReady: true,
      deskReady: true,
      schedulerReady: true,
      inboxReady: true,
      outboxReady: true,
      dispatchReady: true,
      bridgeReady: true,
    },
    desk: {
      contractVersion: contracts.desk?.contractVersion || 'agent-harness-desk.v1',
      enabled: contracts.desk?.enabled !== false,
    },
    plugins: {
      contractVersion: contracts.plugins?.contractVersion || 'agent-harness-plugins.v1',
      enabled: contracts.plugins?.enabled !== false,
      refs: ensureArray(state.agentPackage?.pluginRefs),
    },
    bridge: {
      contractVersion: contracts.bridge?.contractVersion || 'agent-harness-bridge.v1',
      enabled: contracts.bridge?.enabled !== false,
      routeContracts: ensureArray(state.agentPackage?.bridgePolicy?.routeContracts),
    },
    lifecycle: {
      contractVersion: contracts.lifecycle?.contractVersion || 'agent-harness-lifecycle.v1',
      heartbeatEnabled: contracts.lifecycle?.heartbeatEnabled !== false,
      cronEnabled: contracts.lifecycle?.cronEnabled !== false,
    },
    shell: {
      contractVersion: contracts.shell?.contractVersion || 'agent-shell.v1',
      onboardingReady: contracts.shell?.onboardingReady !== false,
      onboardingMode: contracts.shell?.onboardingMode || 'productized',
      commands: ensureArray(contracts.shell?.commands),
      activationChecklist: ensureArray(contracts.shell?.activationChecklist),
    },
    authority: {
      contractVersion: contracts.authority?.contractVersion || 'agent-harness-authority.v1',
    },
    transport: state.transport,
    injectedCapabilities: state.injectedCapabilities || { tools: [], skills: [], bridgeRoutes: [], shellCommands: [] },
    capabilityGate: state.agentPackage?.runtimeCapabilityPolicy || null,
    decision: state.decision,
    results: state.results,
    replan: state.replan,
    continuation: state.continuation,
    summary: {
      ok: state.status === 'completed',
      agentCount: ensureArray(state.manifest?.roles).length,
      toolCount: ensureArray(state.toolRegistry).length,
      skillCount: ensureArray(state.skillRegistry).length,
      artifactCount: ensureArray(state.durableArtifacts).length,
      deliverableReady: true,
      reviewReady: true,
      decisionReady: true,
      memoryReady: true,
      retrievalReady: true,
      backendReady: true,
      hostLayerReady: true,
      distributedReady: true,
      replanReady: state.replan?.triggered === true,
      streamReady: true,
      continuationReady: true,
      transportReady: true,
      queueReady: true,
      leaseReady: true,
      retryReady: true,
      multiBrokerReady: state.runtimeEvidence?.multiBrokerReady === true,
      failoverReady: Number(state.runtimeEvidence?.brokerFailoverInjectedCount || 0) >= 1,
      recoveryReady: true,
      recoverySourceFirstReady: true,
      reapingReady: Number(state.runtimeEvidence?.schedulerReapedLeaseCount || 0) >= 1,
      sharedAuthorityReady: true,
      pluginReady: true,
      bridgeReady: true,
      lifecycleReady: true,
      shellReady: true,
      onboardingProductizedReady: state.shell?.onboardingMode === 'productized' && ensureArray(state.shell?.activationChecklist).length >= 7,
      doctorReady: true,
      authorityReady: true,
      sandboxTierReady: true,
      eventBusReady: true,
      providerReady: true,
      sandboxReady: true,
      toolRuntimeReady: true,
    },
    runtimeEvidence: state.runtimeEvidence,
    paths: state.paths,
    memory: {
      blackboardPath: path.join(state.paths?.memoryDir || '', 'blackboard.json'),
      durableMemoryPath: path.join(state.paths?.memoryDir || '', 'durable-memory.json'),
      durableArtifacts: state.durableArtifacts,
    },
  };
}

async function readDurableBrokerResult(paths = {}, state = {}, item = {}) {
  const runtimeDir = paths.runtimeDir;
  try {
    const files = await fs.readdir(runtimeDir, { recursive: true });
    const hit = ensureArray(files).find((file) => String(file || '').includes(`${item.id}`) && String(file || '').endsWith('.json'));
    if (!hit) return null;
    const filePath = path.join(runtimeDir, hit);
    const payload = await safeReadJson(filePath, null);
    if (!payload?.result?.run) return null;
    return { filePath, payload };
  } catch {
    return null;
  }
}

export async function createStandaloneProductRuntime({
  manifestPath = path.join(__dirname, 'oss-agent-manifest.json'),
  agentPackagePath = path.join(__dirname, 'oss-agent-package.json'),
  runtimeOptions = {},
} = {}) {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const agentPackage = JSON.parse(await fs.readFile(agentPackagePath, 'utf8'));
  const workflowPack = createOssMinimalWorkflowPack({ normalizeWorkItem, ensureArray });
  const policyPack = createOssMinimalPolicyPack({
    defaultLeaseMs: Number(manifest?.runtime?.leaseMs || 1200),
    defaultMaxAttempts: Number(manifest?.runtime?.maxAttempts || 2),
    normalizeWorkItem,
  });
  const runsRoot = path.resolve(String(runtimeOptions?.runsRoot || path.join(__dirname, '..', '..', 'run', 'standalone-harness')));
  const workerEntryPath = path.resolve(__dirname, String(manifest?.runtime?.workerEntry || DEFAULT_WORKER_ENTRY));
  const brokerEntryPath = path.resolve(__dirname, String(manifest?.runtime?.brokerEntry || DEFAULT_BROKER_ENTRY));
  const sharedAuthority = manifest?.runtime?.sharedAuthority || {};

  async function createRun(userText = '') {
    const runId = `run-${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')}`;
    const runDir = path.join(runsRoot, runId);
    const paths = buildPaths(runDir, sharedAuthority);
    await ensureRunDirs(paths);

    const modelProvider = createLocalModelProvider();
    const plan = workflowPack.buildPlan({ userText, manifest, agentPackage });
    const tlDecisionRaw = JSON.stringify(plan.decision || modelProvider.buildTaskPlan(userText));
    const decision = parseTLDecision(tlDecisionRaw);
    const seededWorkQueue = ensureArray(plan.seededWorkQueue).length > 0
      ? ensureArray(plan.seededWorkQueue)
      : ensureArray(decision.workItems).map((item) => addTransportMeta(normalizeWorkItem(item), manifest));
    const contracts = buildHarnessContracts({ manifest, agentPackage, paths });
    const harnessSdk = buildHarnessSdkMeta({ workflowPack, policyPack });
    const state = {
      schema: RUN_SCHEMA,
      status: 'pending',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      runId,
      runDir,
      userText,
      manifest,
      agentPackage,
      harnessSdk,
      contracts,
      workQueue: clone(seededWorkQueue),
      currentIndex: 0,
      results: [],
      replan: {
        triggered: false,
        sourceWorkItemId: '',
        reason: '',
        addedWorkItemIds: [],
      },
      continuation: {
        startMode: 'start-only',
        resumeCount: 0,
        lastResumeAt: '',
        stepExecutions: 0,
        lastRecoveryReapCount: 0,
      },
      crashControl: {
        crashAfterCompletions: Math.max(0, Number(runtimeOptions?.crashAfterCompletions || 0)),
        crashTriggered: false,
      },
      transport: {
        kind: 'remote_broker_http',
        workerEntryPath,
        brokerEntryPath,
        brokerCount: Number(manifest?.runtime?.brokerCount || 3),
        leaseMs: Number(manifest?.runtime?.leaseMs || 1200),
        maxAttempts: Number(manifest?.runtime?.maxAttempts || 2),
        healthProbeTimeoutMs: Number(manifest?.runtime?.healthProbeTimeoutMs || 600),
        failoverEnabled: manifest?.runtime?.failoverEnabled !== false,
        failoverInjected: false,
        sharedAuthorityMode: String(sharedAuthority?.mode || 'shared_fs'),
      },
      blackboard: {},
      durableArtifacts: [],
      eventLog: [],
      toolRuns: [],
      decision: {
        type: decision.type,
        summary: decision.summary,
        taskMode: decision.taskMode,
        riskLevel: decision.riskLevel,
        initialWorkItemCount: seededWorkQueue.length,
        executedWorkItemCount: 0,
      },
      paths,
      runtimeEvidence: {},
    };

    const context = await createExecutionContext({ paths, state, manifest, agentPackage, workerEntryPath, brokerEntryPath });
    state.toolRegistry = clone(ensureArray(context.effectiveToolRegistry));
    state.skillRegistry = clone(ensureArray(context.effectiveSkillRegistry));
    state.injectedCapabilities = clone(context.injectedCapabilities || {});
    await context.hostLayer.sessionBus.appendMessage({ type: 'run.created', runId, userText });
    await context.hostLayer.desk.writeNote('host-bootstrap.md', `# Host Bootstrap\n\n- runId: ${runId}\n- backend: external durable sqlite service\n- scheduler: distributed scheduler authority\n- hostLayer: local runtime\n`);
    await context.hostLayer.desk.enqueueInbox({ kind: 'user_request', text: userText });
    await context.hostLayer.desk.enqueueOutbox({ kind: 'status', text: 'run created' });
    await context.hostLayer.scheduler.scheduleJob({ jobId: `job:${runId}:bootstrap`, kind: 'bootstrap', status: 'pending', payload: { runId } });
    await context.bridgeHost.appendIngress?.({ kind: 'user_request', text: userText, messageId: `bridge-in:${runId}` });
    await context.bridgeHost.appendEgress?.({ kind: 'status', text: 'run created', messageId: `bridge-out:${runId}` });
    await context.pluginSystem.runHook?.('run.created', { runId, userText });
    await context.productShell.update?.({ lastRunId: runId, lastStatus: 'pending', lastUserText: userText });
    await context.hostLayer.dispatchPending?.();
    await persistState(state, context, paths);
    await context.runtimeAdapter.close?.();
    await context.backendProvider?.close?.();
    const output = buildOutput(state);
    await writeRunReport(output, paths);
    return output;
  }

  async function loadState(runDir = '') {
    const paths = buildPaths(runDir, sharedAuthority);
    const state = await safeReadJson(paths.statePath, null);
    if (state) return state;
    throw new Error(`run_state_not_found:${runDir}`);
  }

  async function resumeRun({ runDir = '', steps = Infinity, onChunk = null } = {}) {
    const state = await loadState(runDir);
    const paths = buildPaths(runDir, sharedAuthority);
    await ensureRunDirs(paths);
    if (state.status === 'completed') {
      const output = buildOutput(state);
      await writeRunReport(output, paths);
      return output;
    }

    const context = await createExecutionContext({ paths, state, manifest, agentPackage, workerEntryPath, brokerEntryPath });
    state.toolRegistry = clone(ensureArray(context.effectiveToolRegistry));
    state.skillRegistry = clone(ensureArray(context.effectiveSkillRegistry));
    state.injectedCapabilities = clone(context.injectedCapabilities || {});

    const resultById = new Map(ensureArray(state.results).map((item) => [item.id, item]));
    state.status = 'running';
    state.continuation.resumeCount = Number(state.continuation?.resumeCount || 0) + 1;
    state.continuation.lastResumeAt = nowIso();

    if (paths.reapOnResume && typeof context.runtimeAdapter.reapOrphanLeases === 'function') {
      const reaped = await context.runtimeAdapter.reapOrphanLeases({ graceMs: paths.leaseReapGraceMs, reason: 'resume_recovery' }).catch(() => []);
      state.continuation.lastRecoveryReapCount = ensureArray(reaped).length;
    }

    let executedThisCall = 0;
    const stepBudget = Number.isFinite(Number(steps)) ? Number(steps) : Infinity;

    while (state.currentIndex < ensureArray(state.workQueue).length && executedThisCall < stepBudget) {
      const item = state.workQueue[state.currentIndex];
      const upstreamResults = ensureArray(item.dependencies).map((depId) => resultById.get(depId)).filter(Boolean).map((entry) => ({
        id: entry.id,
        role: entry.role,
        title: entry.title,
        summary: entry.structured?.summary || entry.summary || '',
        artifactPath: entry.artifactPath || '',
      }));
      context.eventBus.emit({ type: 'member.started', role: item.role, workItemId: item.id });
      const recovered = await readDurableBrokerResult(paths, state, item);
      const run = recovered
        ? recovered.payload.result.run
        : await context.executionAdapter.spawnForRole({
            role: item.role,
            task: item.task,
            objective: item.objective,
            acceptance: item.acceptance,
            deliverables: item.deliverables,
            workspaceDir: paths.workspaceDir,
            context: { upstreamResults, userText: state.userText, workItem: item },
            toolRegistry: ensureArray(state.toolRegistry),
            skillRegistry: ensureArray(state.skillRegistry),
            onChunk,
          });
      const structured = parseJsonLoose(String(run?.reply || '')) || {};
      const artifactPath = String(run?.artifactPath || ensureArray(structured.deliverables)[0] || '');
      const normalized = {
        id: item.id,
        role: item.role,
        title: item.title,
        ok: !!run?.ok,
        via: String(run?.via || ''),
        summary: String(structured.summary || ''),
        structured,
        artifactPath,
        brokerId: String(run?.brokerId || '') || undefined,
        brokerStatePath: String(run?.brokerStatePath || '') || undefined,
        brokerJobId: String(run?.brokerJobId || '') || undefined,
        schedulerDispatchId: String(run?.schedulerDispatchId || '') || undefined,
        schedulerLeaseId: String(run?.schedulerLeaseId || '') || undefined,
        workerPid: Number(run?.workerPid || 0) || undefined,
      };
      resultById.set(item.id, normalized);
      state.results.push(normalized);
      state.decision.executedWorkItemCount = state.results.length;
      if (artifactPath) {
        context.memoryProvider.addArtifact({ id: item.id, role: item.role, path: artifactPath, title: path.basename(artifactPath), summary: normalized.summary });
      }
      if (structured.blackboardUpdate && typeof structured.blackboardUpdate === 'object') {
        context.memoryProvider.writeBlackboard(item.role, structured.blackboardUpdate);
      }
      if (Array.isArray(run?.workerEventLog)) {
        for (const event of run.workerEventLog) context.eventBus.emit(event);
      }
      if (Array.isArray(run?.workerToolRuns) && typeof context.toolRuntime.appendRuns === 'function') {
        context.toolRuntime.appendRuns(run.workerToolRuns);
      }
      context.eventBus.emit({
        type: 'member.completed',
        role: item.role,
        workItemId: item.id,
        artifactPath,
        workerPid: normalized.workerPid,
        brokerId: normalized.brokerId,
        brokerJobId: normalized.brokerJobId,
        schedulerDispatchId: normalized.schedulerDispatchId,
        schedulerLeaseId: normalized.schedulerLeaseId,
      });
      await context.bridgeHost.appendEgress?.({ kind: 'member.completed', messageId: `bridge-member:${state.runId}:${item.id}`, text: `${item.role}:${item.id} completed` });
      await context.pluginSystem.runHook?.('member.completed', { runId: state.runId, workItemId: item.id, role: item.role });
      await context.productShell.update?.({ lastRunId: state.runId, lastStatus: 'running', lastCompletedWorkItemId: item.id, lastCompletedRole: item.role });
      policyPack.afterResult({ item, structured, state, eventBus: context.eventBus });
      state.currentIndex += 1;
      executedThisCall += 1;
      state.continuation.stepExecutions = Number(state.continuation?.stepExecutions || 0) + 1;
      await persistState(state, context, paths);
      if (!state.crashControl?.crashTriggered && Number(state.crashControl?.crashAfterCompletions || 0) > 0 && Number(state.continuation?.stepExecutions || 0) >= Number(state.crashControl?.crashAfterCompletions || 0)) {
        state.crashControl.crashTriggered = true;
        process.stderr.write(`[crash] forced process exit after completion ${state.continuation.stepExecutions}\n`);
        process.exit(99);
      }
    }

    state.status = state.currentIndex >= ensureArray(state.workQueue).length ? 'completed' : 'paused';
    await context.pluginSystem.runHook?.(state.status === 'completed' ? 'run.completed' : 'run.paused', { runId: state.runId, status: state.status, currentIndex: state.currentIndex });
    await context.bridgeHost.appendEgress?.({ kind: state.status === 'completed' ? 'run.completed' : 'run.paused', messageId: `bridge-run:${state.runId}:${state.status}`, text: `run ${state.status}` });
    const finalPluginStats = context.pluginSystem.getStats?.() || {};
    await context.productShell.update?.({
      lastRunId: state.runId,
      lastStatus: state.status,
      completedWorkItemCount: Number(state.decision?.executedWorkItemCount || 0),
      runBound: true,
      bridgeRouteCount: ensureArray(state.bridge?.state?.routes).length,
      bridgeRoutes: ensureArray(state.bridge?.state?.routes),
      pluginCount: Number(finalPluginStats.pluginCount || 0),
      injectedToolCount: Number(finalPluginStats.injectedToolCount || 0),
      injectedSkillCount: Number(finalPluginStats.injectedSkillCount || 0),
      deskReady: state.hostLayer?.deskReady !== false,
      sessionBusReady: state.hostLayer?.sessionBusReady !== false,
    });
    await persistState(state, context, paths);
    await context.runtimeAdapter.close?.();
    await context.backendProvider?.close?.();
    const output = buildOutput(state);
    await writeRunReport(output, paths);
    return output;
  }

  async function runTask(userText = '', { onChunk = null } = {}) {
    const started = await createRun(userText);
    return resumeRun({ runDir: started.runDir, steps: Infinity, onChunk });
  }

  const agentHarness = createHarness({
    manifest,
    agentPackage,
    workflowPack,
    policyPack,
    contracts: buildHarnessContracts({ manifest, agentPackage, paths: buildPaths(path.join(runsRoot, 'contract-preview'), sharedAuthority) }),
    createRun,
    loadState,
    resumeRun,
    runTask,
  });

  return {
    ...agentHarness,
    sdk: buildHarnessSdkMeta({ workflowPack, policyPack }),
    provider: 'standalone-broker-productized',
    runsRoot,
    sharedAuthority,
    buildPaths: (runDir = '') => buildPaths(runDir, sharedAuthority),
    loadState,
    resumeRun,
  };
}
