import fs from 'node:fs/promises';
import { createLocalRuntimeAdapter } from './local-runtime-adapter.mjs';
import { createCommandRuntimeProvider, createLifecycleRuntimeProvider, createLocalArtifactStore, createLocalBridgeHostProvider, createLocalEventBus, createLocalMemoryProvider, createLocalModelProvider, createLocalPluginSystemProvider, createLocalSandboxProvider, createLocalToolProvider, createLocalToolRuntimeProvider } from './provider-registry.mjs';

function emit(message = {}) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

const payloadPath = process.argv[2] || '';
if (!payloadPath) {
  emit({ type: 'error', error: 'payload_path_required' });
  process.exit(1);
}

try {
  const payload = JSON.parse(await fs.readFile(payloadPath, 'utf8'));
  const manifest = JSON.parse(await fs.readFile(payload.manifestPath, 'utf8'));
  const agentPackage = JSON.parse(await fs.readFile(new URL('./oss-agent-package.json', import.meta.url), 'utf8'));
  const paths = payload.paths || {};
  const stateSnapshot = payload.stateSnapshot || {};
  const request = payload.request || {};

  const eventBus = createLocalEventBus();
  const memoryProvider = createLocalMemoryProvider({
    memoryDir: paths.memoryDir,
    seedEntries: Array.isArray(manifest.memorySeeds) ? manifest.memorySeeds : [],
    initialBlackboard: stateSnapshot.blackboard || {},
    initialDurableArtifacts: Array.isArray(stateSnapshot.durableArtifacts) ? stateSnapshot.durableArtifacts : [],
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
  const toolRuntime = createLocalToolRuntimeProvider({
    sandbox,
    eventBus,
    outputDir: paths.runtimeDir,
    memoryProvider,
    commandRuntime,
    bridgeHost,
    lifecycleRuntime,
    capabilityGate: agentPackage?.runtimeCapabilityPolicy || null,
  });
  const toolProvider = createLocalToolProvider({
    toolRegistry: [...(Array.isArray(manifest.toolRegistry) ? manifest.toolRegistry : []), ...(Array.isArray(injectedCapabilities.tools) ? injectedCapabilities.tools : [])],
    toolRuntime,
  });
  const artifactStore = createLocalArtifactStore({ artifactDir: paths.artifactDir });
  const modelProvider = createLocalModelProvider();
  const runtimeAdapter = createLocalRuntimeAdapter({
    agentRegistry: Array.isArray(manifest.roles) ? manifest.roles : [],
    toolProvider,
    memoryProvider,
    eventBus,
    artifactStore,
    modelProvider,
  });

  const attempt = Number(request.__brokerAttempt || 1);
  const workMeta = request?.context?.workItem?.metadata || {};
  if (workMeta.forceRetryOnce === true && attempt === 1) {
    await new Promise((resolve) => setTimeout(resolve, Math.max(1200, Number(workMeta.forceRetrySleepMs || 1200))));
  }

  const run = await runtimeAdapter.spawnForRole({
    ...request,
    onChunk: async (chunk) => emit({ type: 'stream.chunk', payload: chunk }),
  });

  emit({
    type: 'result',
    payload: {
      run,
      eventLog: eventBus.list(),
      toolRuns: toolRuntime.listRuns(),
    },
  });
} catch (err) {
  emit({ type: 'error', error: String(err?.message || err || 'worker_failed') });
  process.exit(1);
}
