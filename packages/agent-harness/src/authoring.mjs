function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export const AGENT_LIFECYCLE_PHASES = Object.freeze([
  'init',
  'observe',
  'plan',
  'act',
  'review',
  'handoff',
  'complete',
]);

export function createLifecyclePhaseContract({
  contractVersion = 'agent-lifecycle-phases.v1',
  phases = AGENT_LIFECYCLE_PHASES,
  handoffRequired = true,
  reviewRequired = true,
  completionSignal = 'run.completed',
} = {}) {
  const normalizedPhases = asArray(phases).map((phase) => String(phase || '').trim()).filter(Boolean);
  return {
    contractVersion,
    phases: normalizedPhases.length > 0 ? normalizedPhases : [...AGENT_LIFECYCLE_PHASES],
    handoffRequired: handoffRequired !== false,
    reviewRequired: reviewRequired !== false,
    completionSignal: String(completionSignal || 'run.completed'),
  };
}

export function createAgentManifestTemplate({
  id = 'sample.third-party-agent',
  name = 'Third-Party Sample Agent',
  version = '0.1.0',
  bootstrap = '../../src/agent-harness-core/standalone-product-runtime.mjs',
  workerEntry = '../../src/agent-harness-core/role-worker.mjs',
  brokerEntry = '../../src/agent-harness-core/remote-broker-server.mjs',
  providerPrefix = 'provider.third-party',
  roles = [],
} = {}) {
  const resolvedRoles = asArray(roles).length > 0 ? asArray(roles) : [
    {
      role: 'planner',
      displayName: 'Planner',
      capabilities: ['planning', 'decomposition'],
      contract: { version: 'planner.plan.v2', outputType: 'team.plan.v2' },
    },
    {
      role: 'executor',
      displayName: 'Executor',
      capabilities: ['analysis', 'delivery'],
      contract: { version: 'executor.result.v1', outputType: 'team.execution.v1' },
    },
  ];
  return {
    contractVersion: 'agent-manifest.v1',
    identity: {
      agentId: `agent:${id}`,
      displayName: name,
    },
    id,
    name,
    version,
    runtime: {
      kind: 'standalone-harness',
      bootstrap,
      workerEntry,
      brokerEntry,
      transport: 'remote-broker-http',
      brokerCount: 1,
      leaseMs: 1200,
      maxAttempts: 2,
      healthProbeTimeoutMs: 600,
      failoverEnabled: true,
      sharedAuthority: {
        mode: 'shared_fs',
        dir: './.shared',
        leaseReapGraceMs: 0,
        reapOnResume: true,
      },
    },
    hostContract: {
      contractVersion: 'agent-harness-host.v1',
      bootstrapKind: 'standalone-broker-productized',
      hostAgnostic: true,
      requires: {
        hostRuntime: false,
        hostGateway: false,
        hostSessionBus: false,
        hostMemory: false,
      },
    },
    providers: {
      model: `${providerPrefix}.model`,
      tool: `${providerPrefix}.toolkit`,
      toolRuntime: `${providerPrefix}.tool-runtime`,
      sandbox: `${providerPrefix}.sandbox`,
      memory: `${providerPrefix}.memory`,
      events: `${providerPrefix}.events`,
      artifacts: `${providerPrefix}.artifacts`,
      transport: `${providerPrefix}.transport`,
      backend: `${providerPrefix}.backend`,
      host: `${providerPrefix}.host`,
      bridge: `${providerPrefix}.bridge`,
      authority: `${providerPrefix}.authority`,
      shell: `${providerPrefix}.shell`,
      capabilityGate: `${providerPrefix}.capability-gate`,
    },
    roles: clone(resolvedRoles),
  };
}

export function createAgentPackageTemplate({
  agentId = 'agent:sample.third-party-agent',
  displayName = 'Third-Party Sample Agent',
  workflowPackId = 'workflow.third-party-sample.v1',
  policyPackId = 'policy.third-party-sample.v1',
  lifecycle = {},
} = {}) {
  const lifecycleContract = createLifecyclePhaseContract(lifecycle);
  return {
    contractVersion: 'agent-package.v2',
    identity: {
      agentId,
      displayName,
      persona: {
        style: 'direct',
        tone: 'integrator',
        mission: 'demonstrate a host-neutral independent agent onboarding template',
      },
    },
    workflowPackId,
    policyPackId,
    lifecycleContract,
    memoryPolicy: {
      personaSnapshots: true,
      durableArtifacts: true,
      sharedBlackboard: true,
    },
    sandboxPolicy: {
      defaultTier: 'workspace_guard',
      tiers: ['workspace_guard', 'process_guard'],
    },
    pluginRefs: [],
    sessionContract: {
      contractVersion: 'agent-harness-session.v1',
      capabilities: {
        spawn: true,
        send: true,
        list: true,
        history: true,
        continuation: true,
        inbox: true,
        outbox: true,
        threadBus: true,
        agentMessaging: true,
      },
    },
    deskContract: {
      contractVersion: 'agent-harness-desk.v1',
      enabled: true,
      features: {
        tasks: true,
        notes: true,
        threads: true,
        asyncHandoff: true,
      },
      layout: {
        root: 'workspace/desk',
        inbox: 'workspace/desk/inbox',
        outbox: 'workspace/desk/outbox',
        notes: 'workspace/desk/notes',
      },
    },
    hostLayerContract: {
      contractVersion: 'agent-harness-host-layer.v1',
      features: {
        sessionBus: true,
        desk: true,
        scheduler: true,
        inbox: true,
        outbox: true,
        dispatch: true,
        bridge: true,
      },
    },
    bridgePolicy: {
      contractVersion: 'agent-harness-bridge.v1',
      enabled: true,
      channels: ['local-thread'],
      defaultChannel: 'local-thread',
      routeContracts: [
        { routeKey: 'local-thread', enabled: true, allowedRoles: ['planner', 'executor'], allowedKinds: ['bootstrap', 'status', 'route', 'user_request', 'egress'] },
      ],
    },
    runtimeCapabilityPolicy: {
      contractVersion: 'agent-harness-capability-gate.v1',
      defaultInjectedToolAccess: 'deny',
      roles: {
        planner: { allowInjectedTools: [], allowBridgeRoutes: ['local-thread'] },
        executor: { allowInjectedTools: [], allowBridgeRoutes: ['local-thread'] },
      },
    },
    lifecyclePolicy: {
      contractVersion: 'agent-harness-lifecycle.v1',
      heartbeatEnabled: true,
      cronEnabled: true,
      personaSnapshots: true,
    },
    productShell: {
      contractVersion: 'agent-shell.v1',
      onboardingReady: true,
      onboardingMode: 'productized',
      commands: ['status', 'package', 'plugins', 'onboarding', 'routes', 'capabilities', 'doctor'],
      activationChecklist: [
        { step: 'inspect package', command: 'package', ready: true },
        { step: 'inspect shell status', command: 'status', ready: true },
        { step: 'inspect plugins', command: 'plugins', ready: true },
        { step: 'inspect onboarding', command: 'onboarding', ready: true },
        { step: 'inspect bridge routes', command: 'routes', ready: true },
        { step: 'inspect capability gate', command: 'capabilities', ready: true },
        { step: 'run onboarding doctor', command: 'doctor', ready: true },
      ],
    },
  };
}
