import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStandaloneProductRuntime } from '../../src/agent-harness-core/standalone-product-runtime.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(__dirname, 'agent-manifest.json');
const agentPackagePath = path.join(__dirname, 'agent-package.json');
const runsRoot = path.join(__dirname, '.runs');

export async function createStandaloneHarness({
  manifestPath: overrideManifestPath = manifestPath,
  agentPackagePath: overrideAgentPackagePath = agentPackagePath,
  runtimeOptions = {},
} = {}) {
  return createStandaloneProductRuntime({
    manifestPath: overrideManifestPath,
    agentPackagePath: overrideAgentPackagePath,
    runtimeOptions: {
      runsRoot,
      ...runtimeOptions,
    },
  });
}
