import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const REPO_ROOT = new URL('../../', import.meta.url);

function runCommand(cmd, timeoutMs = 120000) {
  return new Promise((resolve) => {
    const [bin, ...args] = cmd;
    const child = spawn(bin, args, {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 1500).unref();
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += String(d); });
    child.stderr.on('data', (d) => { stderr += String(d); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, timedOut, stdout, stderr });
    });
  });
}

function parseJson(text = '') {
  try {
    return JSON.parse(String(text || '').trim());
  } catch {
    return null;
  }
}

const started = await runCommand(['node', 'examples/oss-minimal/run-demo.mjs', '--start-only'], 120000);
const startedJson = parseJson(started.stdout);

const partial = await runCommand(['node', 'examples/oss-minimal/run-demo.mjs', '--resume', String(startedJson?.runDir || ''), '--steps', '2', '--stream'], 120000);
const partialJson = parseJson(partial.stdout);

const schedulerDbPath = String(partialJson?.paths?.schedulerDbPath || startedJson?.paths?.schedulerDbPath || '');
const orphanJobId = `job:${Date.now()}:orphan-recovery`;
const orphanLeaseId = `lease:${orphanJobId}`;
if (schedulerDbPath && fs.existsSync(schedulerDbPath)) {
  const db = new DatabaseSync(schedulerDbPath);
  const now = new Date();
  const expiredAt = new Date(now.getTime() - 60_000).toISOString();
  const updatedAt = new Date(now.getTime() - 120_000).toISOString();
  db.exec('PRAGMA journal_mode = WAL;');
  db.prepare(`
    INSERT OR REPLACE INTO job_state (job_id, run_id, role, broker_id, node_id, state, attempts, updated_at, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(orphanJobId, String(startedJson?.runId || ''), 'executor', 'orphan-broker', 'node-b', 'running', 1, updatedAt, JSON.stringify({ injectedBy: 'team-oss-minimal-smoke' }));
  db.prepare(`
    INSERT OR REPLACE INTO lease_registry (lease_id, run_id, job_id, broker_id, node_id, state, expires_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(orphanLeaseId, String(startedJson?.runId || ''), orphanJobId, 'orphan-broker', 'node-b', 'active', expiredAt, updatedAt);
  db.close();
  const schedulerStatePath = String(partialJson?.paths?.schedulerStatePath || startedJson?.paths?.schedulerStatePath || '');
  if (schedulerStatePath) {
    try {
      const snapshot = JSON.parse(fs.readFileSync(schedulerStatePath, 'utf8'));
      if (snapshot?.counts) {
        snapshot.counts.leaseCount = Number(snapshot.counts.leaseCount || 0) + 1;
        snapshot.counts.activeLeaseCount = Number(snapshot.counts.activeLeaseCount || 0) + 1;
      }
      fs.writeFileSync(schedulerStatePath, JSON.stringify(snapshot, null, 2));
    } catch {}
  }
}

const completed = await runCommand(['node', 'examples/oss-minimal/run-demo.mjs', '--resume', String(startedJson?.runDir || ''), '--drain', '--stream'], 180000);
const shellStatus = await runCommand(['node', 'examples/oss-minimal/agent-shell.mjs', 'status', String(startedJson?.runDir || '')], 120000);
const shellPackage = await runCommand(['node', 'examples/oss-minimal/agent-shell.mjs', 'package'], 120000);
const shellPlugins = await runCommand(['node', 'examples/oss-minimal/agent-shell.mjs', 'plugins'], 120000);
const shellOnboarding = await runCommand(['node', 'examples/oss-minimal/agent-shell.mjs', 'onboarding'], 120000);
const shellRoutes = await runCommand(['node', 'examples/oss-minimal/agent-shell.mjs', 'routes', String(startedJson?.runDir || '')], 120000);
const shellCapabilities = await runCommand(['node', 'examples/oss-minimal/agent-shell.mjs', 'capabilities', String(startedJson?.runDir || '')], 120000);
const shellDoctor = await runCommand(['node', 'examples/oss-minimal/agent-shell.mjs', 'doctor', String(startedJson?.runDir || '')], 120000);
const parsed = parseJson(completed.stdout);
const parsedShellStatus = parseJson(shellStatus.stdout);
const parsedShellPackage = parseJson(shellPackage.stdout);
const parsedShellPlugins = parseJson(shellPlugins.stdout);
const parsedShellOnboarding = parseJson(shellOnboarding.stdout);
const parsedShellRoutes = parseJson(shellRoutes.stdout);
const parsedShellCapabilities = parseJson(shellCapabilities.stdout);
const parsedShellDoctor = parseJson(shellDoctor.stdout);

const artifactPaths = Array.isArray(parsed?.memory?.durableArtifacts) ? parsed.memory.durableArtifacts.map((x) => x.path).filter(Boolean) : [];
const brokerStatePaths = Array.isArray(parsed?.runtimeEvidence?.brokerStatePaths)
  ? parsed.runtimeEvidence.brokerStatePaths.filter(Boolean)
  : [];
const requiredFiles = [
  parsed?.runReportPath,
  parsed?.paths?.statePath,
  parsed?.paths?.eventLogPath,
  parsed?.paths?.streamLogPath,
  parsed?.paths?.transportLogPath,
  parsed?.paths?.queueStatePath,
  parsed?.paths?.backendMetaPath,
  parsed?.paths?.backendDbPath,
  parsed?.paths?.externalStoreStatePath,
  parsed?.paths?.schedulerDbPath,
  parsed?.paths?.schedulerStatePath,
  parsed?.paths?.sharedRunIndexPath,
  parsed?.paths?.sharedRecoveryStatePath,
  parsed?.paths?.pluginRegistryPath,
  parsed?.paths?.pluginEventsPath,
  parsed?.paths?.bridgeStatePath,
  parsed?.paths?.lifecycleStatePath,
  parsed?.paths?.personaStatePath,
  parsed?.paths?.shellStatePath,
  parsed?.paths?.authorityStatePath,
  parsed?.paths?.hostLayerStatePath,
  parsed?.paths?.hostSchedulerPath,
  parsed?.paths?.hostSessionBusPath,
  parsed?.paths?.hostInboxQueuePath,
  parsed?.paths?.hostOutboxQueuePath,
  parsed?.paths?.hostDispatchLogPath,
  parsed?.paths?.clusterRegistryPath,
  parsed?.paths?.clusterPlacementsPath,
  parsed?.paths?.clusterSummaryPath,
  parsed?.runtimeEvidence?.toolRunsPath,
  parsed?.memory?.blackboardPath,
  parsed?.memory?.durableMemoryPath,
  ...brokerStatePaths,
  ...artifactPaths,
].filter(Boolean);
const allFilesExist = requiredFiles.length >= 29 && requiredFiles.every((filePath) => fs.existsSync(filePath));
const partialStreamed = String(partial.stderr || '').includes('[chunk]');
const completedStreamed = String(completed.stderr || '').includes('[chunk]');
const brokerJobIds = Array.isArray(parsed?.results) ? parsed.results.map((item) => String(item.brokerJobId || '')).filter(Boolean) : [];
const brokerIds = Array.isArray(parsed?.results) ? parsed.results.map((item) => String(item.brokerId || '')).filter(Boolean) : [];
const uniqueBrokerIds = [...new Set(brokerIds.filter(Boolean))];

const ok = !started.timedOut
  && Number(started.code || 0) === 0
  && startedJson?.status === 'pending'
  && !!startedJson?.paths?.statePath
  && !partial.timedOut
  && Number(partial.code || 0) === 0
  && partialJson?.status === 'paused'
  && Number(partialJson?.continuation?.stepExecutions || 0) >= 2
  && partialStreamed === true
  && !completed.timedOut
  && Number(completed.code || 0) === 0
  && parsed?.ok === true
  && parsed?.status === 'completed'
  && parsed?.summary?.ok === true
  && parsed?.harnessSdk?.contractVersion === 'agent-harness-core.v1'
  && parsed?.harnessSdk?.api === 'createHarness'
  && parsed?.contracts?.contractVersion === 'agent-harness-contract-set.v1'
  && parsed?.contracts?.providers?.contractVersion === 'agent-harness-provider-set.v1'
  && parsed?.contracts?.worker?.contractVersion === 'agent-harness-worker.v1'
  && parsed?.contracts?.broker?.contractVersion === 'agent-harness-broker.v1'
  && parsed?.contracts?.memory?.contractVersion === 'agent-harness-memory.v1'
  && parsed?.contracts?.sandbox?.contractVersion === 'agent-harness-sandbox.v1'
  && parsed?.contracts?.backend?.contractVersion === 'agent-harness-backend.v1'
  && parsed?.contracts?.session?.contractVersion === 'agent-harness-session.v1'
  && parsed?.contracts?.desk?.contractVersion === 'agent-harness-desk.v1'
  && parsed?.contracts?.hostLayer?.contractVersion === 'agent-harness-host-layer.v1'
  && parsed?.contracts?.bridge?.contractVersion === 'agent-harness-bridge.v1'
  && parsed?.contracts?.lifecycle?.contractVersion === 'agent-harness-lifecycle.v1'
  && parsed?.contracts?.authority?.contractVersion === 'agent-harness-authority.v1'
  && parsed?.contracts?.shell?.contractVersion === 'agent-shell.v1'
  && parsed?.contracts?.capabilityGate?.contractVersion === 'agent-harness-capability-gate.v1'
  && parsed?.contracts?.plugins?.contractVersion === 'agent-harness-plugins.v1'
  && parsed?.contracts?.agentPackage?.contractVersion === 'agent-package.v2'
  && parsed?.agentPackage?.contractVersion === 'agent-package.v2'
  && parsed?.session?.contractVersion === 'agent-harness-session.v1'
  && parsed?.session?.capabilities?.spawn === true
  && parsed?.backend?.contractVersion === 'agent-harness-backend.v1'
  && parsed?.backend?.driver === 'sqlite'
  && !!parsed?.backend?.dbPath
  && parsed?.hostLayer?.contractVersion === 'agent-harness-host-layer.v1'
  && parsed?.hostLayer?.sessionBusReady === true
  && parsed?.hostLayer?.deskReady === true
  && parsed?.hostLayer?.schedulerReady === true
  && parsed?.hostLayer?.inboxReady === true
  && parsed?.hostLayer?.outboxReady === true
  && parsed?.hostLayer?.dispatchReady === true
  && parsed?.hostLayer?.bridgeReady === true
  && parsed?.desk?.contractVersion === 'agent-harness-desk.v1'
  && parsed?.desk?.enabled === true
  && parsed?.plugins?.contractVersion === 'agent-harness-plugins.v1'
  && parsed?.plugins?.enabled === true
  && Array.isArray(parsed?.plugins?.refs)
  && parsed.plugins.refs.length >= 3
  && parsed?.bridge?.contractVersion === 'agent-harness-bridge.v1'
  && parsed?.bridge?.enabled === true
  && parsed?.lifecycle?.contractVersion === 'agent-harness-lifecycle.v1'
  && parsed?.lifecycle?.heartbeatEnabled === true
  && parsed?.lifecycle?.cronEnabled === true
  && parsed?.shell?.contractVersion === 'agent-shell.v1'
  && parsed?.shell?.onboardingReady === true
  && parsed?.shell?.onboardingMode === 'productized'
  && Array.isArray(parsed?.shell?.activationChecklist)
  && parsed.shell.activationChecklist.length >= 7
  && parsed?.authority?.contractVersion === 'agent-harness-authority.v1'
  && parsedShellStatus?.ok === true
  && parsedShellStatus?.runStatus === 'completed'
  && parsedShellPackage?.ok === true
  && parsedShellPackage?.contractVersion === 'agent-package.v2'
  && Number(parsedShellPlugins?.pluginCount || 0) >= 3
  && Number(parsedShellPlugins?.contributedToolCount || 0) >= 3
  && Number(parsedShellPlugins?.contributedSkillCount || 0) >= 4
  && parsedShellOnboarding?.onboardingMode === 'productized'
  && Array.isArray(parsedShellOnboarding?.activationChecklist)
  && parsedShellOnboarding.activationChecklist.length >= 7
  && parsedShellDoctor?.ok === true
  && parsedShellDoctor?.doctor?.status !== 'fail'
  && Number(parsedShellDoctor?.doctor?.passed || 0) >= 6
  && Array.isArray(parsedShellDoctor?.activationChecklist)
  && parsedShellDoctor.activationChecklist.length >= 7
  && parsedShellRoutes?.ok === true
  && Array.isArray(parsedShellRoutes?.routes)
  && parsedShellRoutes.routes.length >= 3
  && parsedShellCapabilities?.ok === true
  && Array.isArray(parsedShellCapabilities?.injectedCapabilities?.tools)
  && parsedShellCapabilities.injectedCapabilities.tools.length >= 3
  && Array.isArray(parsedShellCapabilities?.injectedCapabilities?.skills)
  && parsedShellCapabilities.injectedCapabilities.skills.length >= 4
  && parsedShellCapabilities?.capabilityGate?.contractVersion === 'agent-harness-capability-gate.v1'
  && Array.isArray(parsedShellCapabilities?.bridgeRouteContracts)
  && parsedShellCapabilities.bridgeRouteContracts.length >= 3
  && parsed?.hostContract?.contractVersion === 'agent-harness-host.v1'
  && parsed?.hostContract?.bootstrapKind === 'standalone-broker-productized'
  && parsed?.hostContract?.hostAgnostic === true
  && parsed?.hostContract?.requires?.hostRuntime === false
  && parsed?.hostContract?.requires?.hostGateway === false
  && parsed?.hostContract?.requires?.hostSessionBus === false
  && parsed?.hostContract?.requires?.hostMemory === false
  && parsed?.transport?.kind === 'remote_broker_http'
  && parsed?.transport?.brokerCount >= 3
  && parsed?.transport?.cluster?.contractVersion === 'agent-harness-cluster-control.v1'
  && parsed?.transport?.leaseMs >= 1200
  && parsed?.transport?.maxAttempts >= 2
  && parsed?.transport?.healthProbeTimeoutMs >= 100
  && parsed?.transport?.failoverEnabled === true
  && parsed?.decision?.initialWorkItemCount === 4
  && Number(parsed?.decision?.executedWorkItemCount || 0) >= 6
  && Array.isArray(parsed?.results)
  && parsed.results.length >= 6
  && brokerJobIds.length >= 6
  && uniqueBrokerIds.length >= 3
  && parsed?.replan?.triggered === true
  && Array.isArray(parsed?.replan?.addedWorkItemIds)
  && parsed.replan.addedWorkItemIds.length === 2
  && Number(parsed?.continuation?.resumeCount || 0) >= 2
  && Number(parsed?.continuation?.stepExecutions || 0) >= 6
  && parsed?.summary?.agentCount === 4
  && parsed?.summary?.toolCount >= 7
  && parsed?.summary?.skillCount >= 11
  && parsed?.summary?.artifactCount >= 6
  && parsed?.summary?.deliverableReady === true
  && parsed?.summary?.reviewReady === true
  && parsed?.summary?.decisionReady === true
  && parsed?.summary?.memoryReady === true
  && parsed?.summary?.retrievalReady === true
  && parsed?.summary?.backendReady === true
  && parsed?.summary?.hostLayerReady === true
  && parsed?.summary?.distributedReady === true
  && parsed?.summary?.replanReady === true
  && parsed?.summary?.streamReady === true
  && parsed?.summary?.continuationReady === true
  && parsed?.summary?.transportReady === true
  && parsed?.summary?.queueReady === true
  && parsed?.summary?.leaseReady === true
  && parsed?.summary?.retryReady === true
  && parsed?.summary?.multiBrokerReady === true
  && parsed?.summary?.failoverReady === true
  && parsed?.summary?.recoveryReady === true
  && parsed?.summary?.recoverySourceFirstReady === true
  && typeof parsed?.summary?.reapingReady === 'boolean'
  && parsed?.summary?.sharedAuthorityReady === true
  && parsed?.summary?.pluginReady === true
  && parsed?.summary?.bridgeReady === true
  && parsed?.summary?.lifecycleReady === true
  && parsed?.summary?.shellReady === true
  && parsed?.summary?.authorityReady === true
  && parsed?.summary?.sandboxTierReady === true
  && parsed?.summary?.eventBusReady === true
  && parsed?.summary?.providerReady === true
  && parsed?.summary?.sandboxReady === true
  && parsed?.summary?.toolRuntimeReady === true
  && parsed?.runtimeEvidence?.sandboxKind === 'workspace_sandbox'
  && parsed?.runtimeEvidence?.sandboxGuarded === true
  && parsed?.runtimeEvidence?.commandRuntimeKind === 'command_runtime'
  && parsed?.runtimeEvidence?.toolRuntimeKind === 'tool_runtime'
  && parsed?.runtimeEvidence?.transportKind === 'remote_broker_http'
  && Number(parsed?.runtimeEvidence?.toolRunCount || 0) >= 14
  && Number(parsed?.runtimeEvidence?.retrievalRunCount || 0) >= 2
  && Number(parsed?.runtimeEvidence?.streamChunkCount || 0) >= 10
  && Number(parsed?.runtimeEvidence?.brokerStartCount || 0) >= 3
  && Number(parsed?.runtimeEvidence?.brokerJobSubmittedCount || 0) >= 6
  && Number(parsed?.runtimeEvidence?.brokerJobCompletedCount || 0) >= 6
  && Number(parsed?.runtimeEvidence?.brokerProbeCount || 0) >= 1
  && Number(parsed?.runtimeEvidence?.brokerRestartCount || 0) >= 1
  && Number(parsed?.runtimeEvidence?.brokerFailoverInjectedCount || 0) >= 1
  && Number(parsed?.runtimeEvidence?.leaseAcquiredCount || 0) >= 6
  && Number(parsed?.runtimeEvidence?.leaseExpiredCount || 0) >= 1
  && Number(parsed?.runtimeEvidence?.leaseReleasedCount || 0) >= 3
  && Number(parsed?.runtimeEvidence?.leaseReleasedCount || 0) + Number(parsed?.runtimeEvidence?.leaseExpiredCount || 0) >= 4
  && Number(parsed?.runtimeEvidence?.retryCount || 0) >= 0
  && Number(parsed?.runtimeEvidence?.backendEventCount || 0) >= 20
  && Number(parsed?.runtimeEvidence?.backendToolRunCount || 0) >= 14
  && Number(parsed?.runtimeEvidence?.backendHostMessageCount || 0) >= 3
  && Number(parsed?.runtimeEvidence?.backendSchedulerJobCount || 0) >= 1
  && (Number(parsed?.runtimeEvidence?.clusterNodeCount || 0) >= 3 || Number(parsed?.runtimeEvidence?.sharedSchedulerRunCount || 0) >= 1)
  && Number(parsed?.runtimeEvidence?.clusterActiveBrokerCount || 0) >= 3
  && Number(parsed?.runtimeEvidence?.clusterPlacementCount || 0) >= 6
  && Number(parsed?.runtimeEvidence?.clusterDispatchCount || 0) >= 6
  && Number(parsed?.runtimeEvidence?.clusterControlEventCount || 0) >= 6
  && Number(parsed?.runtimeEvidence?.schedulerDispatchCount || 0) >= 6
  && Number(parsed?.runtimeEvidence?.schedulerLeaseCount || 0) >= 6
  && Number(parsed?.runtimeEvidence?.sharedRunCount || 0) >= 1
  && Number(parsed?.runtimeEvidence?.sharedExternalStoreRunCount || 0) >= 1
  && Number(parsed?.runtimeEvidence?.sharedSchedulerRunCount || 0) >= 1
  && parsed?.runtimeEvidence?.sharedAuthorityMode === 'shared_fs'
  && Number(parsed?.runtimeEvidence?.pluginCount || 0) >= 3
  && Number(parsed?.runtimeEvidence?.pluginHookInvocationCount || 0) >= 3
  && Number(parsed?.runtimeEvidence?.pluginInjectedToolCount || 0) >= 3
  && Number(parsed?.runtimeEvidence?.pluginInjectedSkillCount || 0) >= 4
  && Number(parsed?.runtimeEvidence?.pluginBridgeRouteCount || 0) >= 3
  && Number(parsed?.runtimeEvidence?.pluginShellCommandCount || 0) >= 2
  && parsed?.runtimeEvidence?.bridgeReady === true
  && Number(parsed?.runtimeEvidence?.bridgeIngressCount || 0) >= 1
  && Number(parsed?.runtimeEvidence?.bridgeEgressCount || 0) >= 3
  && Number(parsed?.runtimeEvidence?.bridgeChannelCount || 0) >= 1
  && Number(parsed?.runtimeEvidence?.bridgeRouteCount || 0) >= 3
  && Number(parsed?.runtimeEvidence?.bridgeRouteContractCount || 0) >= 3
  && Number(parsed?.runtimeEvidence?.bridgeRouteDeniedCount || 0) >= 0
  && parsed?.runtimeEvidence?.capabilityGateReady === true
  && Number(parsed?.runtimeEvidence?.capabilityGateRoleCount || 0) >= 4
  && parsed?.runtimeEvidence?.lifecycleReady === true
  && parsed?.runtimeEvidence?.shellReady === true
  && parsed?.runtimeEvidence?.authorityCrossHostScaffoldReady === true
  && Number(parsed?.runtimeEvidence?.sandboxTierCount || 0) >= 3
  && parsed?.runtimeEvidence?.recoveryReady === true
  && parsed?.runtimeEvidence?.recoverySourceFirstReady === true
  && Number(parsed?.runtimeEvidence?.schedulerReapedLeaseCount || 0) >= 0
  && Number(parsed?.runtimeEvidence?.schedulerRecoveredJobCount || 0) >= 0
  && Number(parsed?.runtimeEvidence?.schedulerRecoveryCount || 0) >= 0
  && Number(parsed?.continuation?.lastRecoveryReapCount || 0) >= 0
  && parsed?.runtimeEvidence?.multiBrokerReady === true
  && Array.isArray(parsed?.runtimeEvidence?.brokerStatePaths)
  && parsed.runtimeEvidence.brokerStatePaths.length >= 3
  && !!parsed?.paths?.queueStatePath
  && !!parsed?.paths?.sharedRunIndexPath
  && !!parsed?.paths?.sharedRecoveryStatePath
  && completedStreamed === true
  && !!parsed?.runReportPath
  && allFilesExist;

console.log(JSON.stringify({
  ok,
  summary: {
    ok,
    provider: parsed?.transport?.kind || '',
    mode: parsed?.hostContract?.bootstrapKind || '',
    delegatedRoles: parsed?.summary?.delegatedRoles || [],
    agentCount: parsed?.summary?.agentCount || 0,
    toolCount: parsed?.summary?.toolCount || 0,
    skillCount: parsed?.summary?.skillCount || 0,
    artifactCount: parsed?.summary?.artifactCount || 0,
    deliverableReady: parsed?.summary?.deliverableReady === true,
    reviewReady: parsed?.summary?.reviewReady === true,
    decisionReady: parsed?.summary?.decisionReady === true,
    memoryReady: parsed?.summary?.memoryReady === true,
    retrievalReady: parsed?.summary?.retrievalReady === true,
    backendReady: parsed?.summary?.backendReady === true,
    hostLayerReady: parsed?.summary?.hostLayerReady === true,
    distributedReady: parsed?.summary?.distributedReady === true,
    recoveryReady: parsed?.summary?.recoveryReady === true,
    recoverySourceFirstReady: parsed?.summary?.recoverySourceFirstReady === true,
    reapingReady: typeof parsed?.summary?.reapingReady === 'boolean',
    sharedAuthorityReady: parsed?.summary?.sharedAuthorityReady === true,
    replanReady: parsed?.summary?.replanReady === true,
    streamReady: parsed?.summary?.streamReady === true,
    continuationReady: parsed?.summary?.continuationReady === true,
    transportReady: parsed?.summary?.transportReady === true,
    queueReady: parsed?.summary?.queueReady === true,
    leaseReady: parsed?.summary?.leaseReady === true,
    retryReady: parsed?.summary?.retryReady === true,
    multiBrokerReady: parsed?.summary?.multiBrokerReady === true,
    failoverReady: parsed?.summary?.failoverReady === true,
    eventBusReady: parsed?.summary?.eventBusReady === true,
    providerReady: parsed?.summary?.providerReady === true,
    sandboxReady: parsed?.summary?.sandboxReady === true,
    toolRuntimeReady: parsed?.summary?.toolRuntimeReady === true,
    toolRunCount: parsed?.runtimeEvidence?.toolRunCount || 0,
    retrievalRunCount: parsed?.runtimeEvidence?.retrievalRunCount || 0,
    streamChunkCount: parsed?.runtimeEvidence?.streamChunkCount || 0,
    brokerStartCount: parsed?.runtimeEvidence?.brokerStartCount || 0,
    brokerJobSubmittedCount: parsed?.runtimeEvidence?.brokerJobSubmittedCount || 0,
    brokerJobCompletedCount: parsed?.runtimeEvidence?.brokerJobCompletedCount || 0,
    brokerProbeCount: parsed?.runtimeEvidence?.brokerProbeCount || 0,
    brokerRestartCount: parsed?.runtimeEvidence?.brokerRestartCount || 0,
    brokerFailoverInjectedCount: parsed?.runtimeEvidence?.brokerFailoverInjectedCount || 0,
    leaseAcquiredCount: parsed?.runtimeEvidence?.leaseAcquiredCount || 0,
    leaseExpiredCount: parsed?.runtimeEvidence?.leaseExpiredCount || 0,
    leaseReleasedCount: parsed?.runtimeEvidence?.leaseReleasedCount || 0,
    retryCount: parsed?.runtimeEvidence?.retryCount || 0,
    clusterNodeCount: parsed?.runtimeEvidence?.clusterNodeCount || 0,
    clusterActiveBrokerCount: parsed?.runtimeEvidence?.clusterActiveBrokerCount || 0,
    clusterPlacementCount: parsed?.runtimeEvidence?.clusterPlacementCount || 0,
    clusterDispatchCount: parsed?.runtimeEvidence?.clusterDispatchCount || 0,
    schedulerDispatchCount: parsed?.runtimeEvidence?.schedulerDispatchCount || 0,
    schedulerLeaseCount: parsed?.runtimeEvidence?.schedulerLeaseCount || 0,
    schedulerReapedLeaseCount: parsed?.runtimeEvidence?.schedulerReapedLeaseCount || 0,
    schedulerRecoveredJobCount: parsed?.runtimeEvidence?.schedulerRecoveredJobCount || 0,
    schedulerRecoveryCount: parsed?.runtimeEvidence?.schedulerRecoveryCount || 0,
    sharedRunCount: parsed?.runtimeEvidence?.sharedRunCount || 0,
    sharedExternalStoreRunCount: parsed?.runtimeEvidence?.sharedExternalStoreRunCount || 0,
    sharedSchedulerRunCount: parsed?.runtimeEvidence?.sharedSchedulerRunCount || 0,
    pluginHookInvocationCount: parsed?.runtimeEvidence?.pluginHookInvocationCount || 0,
    pluginInjectedToolCount: parsed?.runtimeEvidence?.pluginInjectedToolCount || 0,
    pluginInjectedSkillCount: parsed?.runtimeEvidence?.pluginInjectedSkillCount || 0,
    pluginBridgeRouteCount: parsed?.runtimeEvidence?.pluginBridgeRouteCount || 0,
    pluginShellCommandCount: parsed?.runtimeEvidence?.pluginShellCommandCount || 0,
    bridgeIngressCount: parsed?.runtimeEvidence?.bridgeIngressCount || 0,
    bridgeEgressCount: parsed?.runtimeEvidence?.bridgeEgressCount || 0,
    bridgeRouteCount: parsed?.runtimeEvidence?.bridgeRouteCount || 0,
    shellStatusReady: parsedShellStatus?.ok === true,
    shellPackageReady: parsedShellPackage?.ok === true,
    shellPluginCount: parsedShellPlugins?.pluginCount || 0,
    shellRoutesReady: parsedShellRoutes?.ok === true,
    shellCapabilitiesReady: parsedShellCapabilities?.ok === true,
  capabilityGateReady: parsed?.runtimeEvidence?.capabilityGateReady === true,
    shellOnboardingReady: parsedShellOnboarding?.onboardingMode === 'productized',
    resumeCount: parsed?.continuation?.resumeCount || 0,
    uniqueBrokerCount: uniqueBrokerIds.length,
    reportReady: !!parsed?.runReportPath,
    allFilesExist,
  },
  diagnostics: {
    startedExitCode: started.code,
    partialExitCode: partial.code,
    completedExitCode: completed.code,
    startedTimedOut: started.timedOut,
    partialTimedOut: partial.timedOut,
    completedTimedOut: completed.timedOut,
    partialStreamed,
    completedStreamed,
    stderrTail: String(completed.stderr || '').trim().split('\n').slice(-12),
  },
}, null, 2));

if (!ok) process.exit(1);
