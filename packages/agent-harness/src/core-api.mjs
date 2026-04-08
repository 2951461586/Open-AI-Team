export function createWorkflowPack({ id = '', version = '1.0.0', label = '', buildPlan } = {}) {
  return {
    kind: 'workflow_pack',
    id: String(id || 'workflow.pack'),
    version: String(version || '1.0.0'),
    label: String(label || ''),
    buildPlan,
  };
}

export function createPolicyPack({ id = '', version = '1.0.0', label = '', seedWorkQueue, afterResult } = {}) {
  return {
    kind: 'policy_pack',
    id: String(id || 'policy.pack'),
    version: String(version || '1.0.0'),
    label: String(label || ''),
    seedWorkQueue,
    afterResult,
  };
}

export function createHarness({ manifest = {}, agentPackage = {}, workflowPack = null, policyPack = null, contracts = {}, createRun, loadState, resumeRun, runTask } = {}) {
  return {
    kind: 'agent_harness_core',
    contractVersion: 'agent-harness-core.v1',
    manifest,
    agentPackage,
    workflowPack: workflowPack ? { id: workflowPack.id, version: workflowPack.version, label: workflowPack.label } : null,
    policyPack: policyPack ? { id: policyPack.id, version: policyPack.version, label: policyPack.label } : null,
    contracts,
    createRun,
    loadState,
    resumeRun,
    runTask,
  };
}

export function buildHarnessSdkMeta({ workflowPack = null, policyPack = null } = {}) {
  return {
    contractVersion: 'agent-harness-core.v1',
    api: 'createHarness',
    lifecycle: ['createRun', 'resumeRun', 'runTask'],
    workflowPack: workflowPack ? { id: workflowPack.id, version: workflowPack.version, label: workflowPack.label } : null,
    policyPack: policyPack ? { id: policyPack.id, version: policyPack.version, label: policyPack.label } : null,
  };
}

export function buildProviderContracts({ manifest = {} } = {}) {
  const providerKinds = manifest?.providers && typeof manifest.providers === 'object' ? manifest.providers : {};
  const capabilitiesByKind = {
    model: ['task_planning'],
    tool: ['list_tools', 'run_tool'],
    toolRuntime: ['evidence_logging', 'append_runs'],
    sandbox: ['workspace_paths', 'snapshot', 'guard_policy', 'tier_selection'],
    memory: ['retrieve', 'write_blackboard', 'add_artifact', 'persona_snapshots'],
    events: ['emit', 'list'],
    artifacts: ['write_markdown'],
    transport: ['spawn_role', 'stream_events', 'job_polling', 'failover', 'cluster_placement', 'distributed_dispatch'],
    backend: ['state_read', 'state_write', 'event_persist', 'queue_persist', 'cluster_registry'],
    host: ['session_bus', 'desk_service', 'scheduler_shell', 'inbox', 'outbox', 'dispatch'],
    bridge: ['ingress', 'egress', 'channel_mapping', 'thread_mapping'],
    authority: ['shared_state', 'run_index', 'recovery_index', 'cross_host_scaffold'],
    shell: ['status', 'package_inspect', 'plugin_list', 'onboarding', 'capability_observability'],
    capabilityGate: ['allow_injected_tools', 'allow_bridge_routes', 'role_scoped_policies'],
  };
  const providers = Object.fromEntries(Object.entries(providerKinds).map(([kind, providerId]) => [kind, {
    contractVersion: 'agent-harness-provider.v1',
    kind,
    providerId: String(providerId || ''),
    capabilities: capabilitiesByKind[kind] || ['custom'],
  }]));
  return {
    contractVersion: 'agent-harness-provider-set.v1',
    providers,
  };
}

export function buildWorkerContract({ manifest = {} } = {}) {
  return {
    contractVersion: 'agent-harness-worker.v1',
    workerEntry: String(manifest?.runtime?.workerEntry || './role-worker.mjs'),
    resultEnvelope: 'result',
    errorEnvelope: 'error',
    streamEnvelope: 'stream.chunk',
    supportsStreaming: true,
  };
}

export function buildBrokerContract({ manifest = {} } = {}) {
  return {
    contractVersion: 'agent-harness-broker.v1',
    transport: String(manifest?.runtime?.transport || 'remote-broker-http'),
    brokerEntry: String(manifest?.runtime?.brokerEntry || './remote-broker-server.mjs'),
    brokerCount: Math.max(1, Number(manifest?.runtime?.brokerCount || 1)),
    leaseMs: Math.max(200, Number(manifest?.runtime?.leaseMs || 1200)),
    maxAttempts: Math.max(1, Number(manifest?.runtime?.maxAttempts || 1)),
    failoverEnabled: manifest?.runtime?.failoverEnabled !== false,
    jobApi: {
      submit: '/jobs',
      poll: '/jobs/:id/poll',
      health: '/health',
      shutdown: '/shutdown',
    },
    placement: 'cluster_control_plane',
    durability: 'distributed_sqlite_state',
  };
}

export function buildMemoryContract({ agentPackage = {} } = {}) {
  return {
    contractVersion: 'agent-harness-memory.v1',
    layers: {
      working: 'upstream results + current workItem context',
      shared: 'blackboard',
      durable: 'artifacts + durable memory',
      persona: 'agent package persona + lifecycle snapshots',
    },
    retrievalTool: 'memory.retrieve',
    policy: agentPackage?.memoryPolicy || {},
  };
}

export function buildSandboxContract({ agentPackage = {} } = {}) {
  const sandboxPolicy = agentPackage?.sandboxPolicy && typeof agentPackage.sandboxPolicy === 'object' ? agentPackage.sandboxPolicy : {};
  return {
    contractVersion: 'agent-harness-sandbox.v1',
    sandboxKind: 'workspace_sandbox',
    isolation: 'path_guard',
    supportsSnapshot: true,
    guarded: true,
    writableScopes: ['artifacts', 'memory', 'desk', 'bridge'],
    tiers: Array.isArray(sandboxPolicy?.tiers) && sandboxPolicy.tiers.length > 0 ? sandboxPolicy.tiers : ['workspace_guard', 'process_guard', 'provisioner_scaffold'],
    defaultTier: String(sandboxPolicy?.defaultTier || 'workspace_guard'),
  };
}

export function buildBackendContract({ manifest = {} } = {}) {
  return {
    contractVersion: 'agent-harness-backend.v1',
    backendId: String(manifest?.providers?.backend || 'sqlite-state-backend'),
    kind: 'state_backend',
    driver: 'sqlite',
    durability: 'sqlite-wal',
    swappableTargets: ['sqlite', 'redis', 'postgres'],
  };
}

export function buildHostLayerContract({ agentPackage = {} } = {}) {
  const hostLayer = agentPackage?.hostLayerContract && typeof agentPackage.hostLayerContract === 'object' ? agentPackage.hostLayerContract : {};
  return {
    contractVersion: String(hostLayer.contractVersion || 'agent-harness-host-layer.v1'),
    features: {
      sessionBus: hostLayer?.features?.sessionBus !== false,
      desk: hostLayer?.features?.desk !== false,
      scheduler: hostLayer?.features?.scheduler !== false,
      inbox: hostLayer?.features?.inbox !== false,
      outbox: hostLayer?.features?.outbox !== false,
      dispatch: hostLayer?.features?.dispatch !== false,
      bridge: hostLayer?.features?.bridge !== false,
    },
  };
}

export function buildSessionContract({ agentPackage = {} } = {}) {
  const session = agentPackage?.sessionContract && typeof agentPackage.sessionContract === 'object' ? agentPackage.sessionContract : {};
  return {
    contractVersion: String(session.contractVersion || 'agent-harness-session.v1'),
    capabilities: {
      spawn: session?.capabilities?.spawn !== false,
      send: session?.capabilities?.send !== false,
      list: session?.capabilities?.list !== false,
      history: session?.capabilities?.history !== false,
      continuation: session?.capabilities?.continuation !== false,
      inbox: session?.capabilities?.inbox !== false,
      outbox: session?.capabilities?.outbox !== false,
      threadBus: session?.capabilities?.threadBus !== false,
      agentMessaging: session?.capabilities?.agentMessaging !== false,
    },
  };
}

export function buildDeskContract({ agentPackage = {}, paths = {} } = {}) {
  const desk = agentPackage?.deskContract && typeof agentPackage.deskContract === 'object' ? agentPackage.deskContract : {};
  return {
    contractVersion: String(desk.contractVersion || 'agent-harness-desk.v1'),
    enabled: desk.enabled !== false,
    features: {
      tasks: desk?.features?.tasks !== false,
      notes: desk?.features?.notes !== false,
      threads: desk?.features?.threads !== false,
      asyncHandoff: desk?.features?.asyncHandoff !== false,
    },
    layout: {
      root: String(paths?.deskDir || 'workspace/desk'),
      inbox: String(paths?.deskInboxDir || 'workspace/desk/inbox'),
      outbox: String(paths?.deskOutboxDir || 'workspace/desk/outbox'),
      notes: String(paths?.deskNotesDir || 'workspace/desk/notes'),
    },
  };
}

export function buildBridgeContract({ agentPackage = {}, paths = {} } = {}) {
  const bridge = agentPackage?.bridgePolicy && typeof agentPackage.bridgePolicy === 'object' ? agentPackage.bridgePolicy : {};
  return {
    contractVersion: String(bridge.contractVersion || 'agent-harness-bridge.v1'),
    enabled: bridge.enabled !== false,
    channels: Array.isArray(bridge.channels) ? bridge.channels : [],
    defaultChannel: String(bridge.defaultChannel || ''),
    routeContracts: Array.isArray(bridge.routeContracts) ? bridge.routeContracts : [],
    bridgeStatePath: String(paths?.bridgeStatePath || 'runtime/bridge/bridge-state.json'),
  };
}

export function buildRuntimeCapabilityContract({ agentPackage = {} } = {}) {
  const policy = agentPackage?.runtimeCapabilityPolicy && typeof agentPackage.runtimeCapabilityPolicy === 'object' ? agentPackage.runtimeCapabilityPolicy : {};
  return {
    contractVersion: String(policy.contractVersion || 'agent-harness-capability-gate.v1'),
    defaultInjectedToolAccess: String(policy.defaultInjectedToolAccess || 'deny'),
    roles: policy?.roles && typeof policy.roles === 'object' ? policy.roles : {},
  };
}

export function buildLifecycleContract({ agentPackage = {}, paths = {} } = {}) {
  const lifecycle = agentPackage?.lifecyclePolicy && typeof agentPackage.lifecyclePolicy === 'object' ? agentPackage.lifecyclePolicy : {};
  return {
    contractVersion: String(lifecycle.contractVersion || 'agent-harness-lifecycle.v1'),
    heartbeatEnabled: lifecycle.heartbeatEnabled !== false,
    cronEnabled: lifecycle.cronEnabled !== false,
    personaSnapshots: lifecycle.personaSnapshots !== false,
    lifecycleStatePath: String(paths?.lifecycleStatePath || 'runtime/lifecycle-state.json'),
    personaStatePath: String(paths?.personaStatePath || 'workspace/memory/persona-state.json'),
  };
}

export function buildAuthorityContract({ manifest = {}, paths = {} } = {}) {
  const sharedAuthority = manifest?.runtime?.sharedAuthority && typeof manifest.runtime.sharedAuthority === 'object' ? manifest.runtime.sharedAuthority : {};
  return {
    contractVersion: 'agent-harness-authority.v1',
    mode: String(sharedAuthority.mode || 'shared_fs'),
    supportedModes: ['shared_fs', 'http_authority_scaffold'],
    sharedDir: String(paths?.sharedDir || ''),
    authorityStatePath: String(paths?.authorityStatePath || 'runtime/authority-state.json'),
  };
}

export function buildShellContract({ agentPackage = {}, paths = {} } = {}) {
  const shell = agentPackage?.productShell && typeof agentPackage.productShell === 'object' ? agentPackage.productShell : {};
  const commands = Array.isArray(shell.commands) ? shell.commands : ['status', 'package', 'plugins', 'onboarding', 'doctor'];
  return {
    contractVersion: String(shell.contractVersion || 'agent-shell.v1'),
    onboardingReady: shell.onboardingReady !== false,
    onboardingMode: String(shell.onboardingMode || 'productized'),
    commands,
    activationChecklist: Array.isArray(shell.activationChecklist) ? shell.activationChecklist : commands.map((command) => ({ step: `run ${command}`, command, ready: true })),
    shellStatePath: String(paths?.shellStatePath || 'runtime/shell-state.json'),
  };
}

export function buildPluginContract({ agentPackage = {}, paths = {} } = {}) {
  const refs = Array.isArray(agentPackage?.pluginRefs) ? agentPackage.pluginRefs : [];
  return {
    contractVersion: 'agent-harness-plugins.v1',
    enabled: refs.length > 0,
    pluginCount: refs.length,
    registryPath: String(paths?.pluginRegistryPath || 'runtime/plugins/plugin-registry.json'),
    eventPath: String(paths?.pluginEventsPath || 'runtime/plugins/plugin-events.json'),
  };
}

export function buildAgentPackageContract({ manifest = {}, agentPackage = {} } = {}) {
  const identity = agentPackage?.identity && typeof agentPackage.identity === 'object' ? agentPackage.identity : {};
  return {
    contractVersion: String(agentPackage?.contractVersion || 'agent-package.v2'),
    agentId: String(identity.agentId || manifest?.id || 'agent.oss-minimal'),
    displayName: String(identity.displayName || manifest?.name || 'OSS Minimal Agent'),
    persona: {
      style: String(identity?.persona?.style || 'direct'),
      tone: String(identity?.persona?.tone || 'builder'),
      mission: String(identity?.persona?.mission || 'ship strong standalone agent runtime'),
    },
    workflowPackId: String(agentPackage?.workflowPackId || ''),
    policyPackId: String(agentPackage?.policyPackId || ''),
    pluginCount: Array.isArray(agentPackage?.pluginRefs) ? agentPackage.pluginRefs.length : 0,
    bridgeEnabled: agentPackage?.bridgePolicy?.enabled !== false,
    lifecycleEnabled: agentPackage?.lifecyclePolicy?.heartbeatEnabled !== false || agentPackage?.lifecyclePolicy?.cronEnabled !== false,
    shellContractVersion: String(agentPackage?.productShell?.contractVersion || 'agent-shell.v1'),
  };
}

export function buildHarnessContracts({ manifest = {}, agentPackage = {}, paths = {} } = {}) {
  return {
    contractVersion: 'agent-harness-contract-set.v1',
    providers: buildProviderContracts({ manifest }),
    worker: buildWorkerContract({ manifest }),
    broker: buildBrokerContract({ manifest }),
    memory: buildMemoryContract({ manifest, agentPackage }),
    sandbox: buildSandboxContract({ agentPackage }),
    backend: buildBackendContract({ manifest }),
    session: buildSessionContract({ agentPackage }),
    desk: buildDeskContract({ agentPackage, paths }),
    hostLayer: buildHostLayerContract({ agentPackage }),
    bridge: buildBridgeContract({ agentPackage, paths }),
    lifecycle: buildLifecycleContract({ agentPackage, paths }),
    authority: buildAuthorityContract({ manifest, paths }),
    shell: buildShellContract({ agentPackage, paths }),
    capabilityGate: buildRuntimeCapabilityContract({ agentPackage }),
    plugins: buildPluginContract({ agentPackage, paths }),
    agentPackage: buildAgentPackageContract({ manifest, agentPackage }),
  };
}
