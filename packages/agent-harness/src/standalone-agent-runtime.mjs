import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { createStandaloneAgentRuntime, createStandaloneAgentManifest } from './standalone-agent-package.mjs';
import { SkillRegistry, SkillRuntime } from './skill-registry.mjs';
import { createTraceCollector } from '../../../src/observability/trace-span.mjs';

export async function runStandaloneAgent({
  manifest,
  manifestPath,
  workspaceRoot = './workspace',
  skillsRoot = null,
  enableTracing = false,
  tracingConfig = {},
} = {}) {
  let resolvedManifest = manifest;

  if (manifestPath) {
    const raw = await fs.readFile(manifestPath, 'utf8');
    resolvedManifest = JSON.parse(raw);
  }

  if (!resolvedManifest) {
    throw new Error('manifest or manifestPath is required');
  }

  const workspace = path.resolve(workspaceRoot);
  await fs.mkdir(workspace, { recursive: true });

  const skillsDir = skillsRoot ? path.resolve(skillsRoot) : path.join(workspace, 'skills');
  await fs.mkdir(skillsDir, { recursive: true });

  const registry = new SkillRegistry();
  const runtime = new SkillRuntime({ registry });

  try {
    await registry.fromDirectory(skillsDir);
  } catch (error) {
    console.warn(`[standalone-agent] Failed to load skills from ${skillsDir}: ${error.message}`);
  }

  let collector = null;
  if (enableTracing) {
    collector = createTraceCollector(tracingConfig);
  }

  const agent = createStandaloneAgentRuntime(resolvedManifest, {
    workspaceRoot: workspace,
    skillsRoot: skillsDir,
    config: {
      registry,
      runtime,
      collector,
    },
  });

  await agent.initialize();

  return {
    agent,
    registry,
    runtime,
    collector,
    workspace,

    async chat(message, options = {}) {
      if (collector) {
        return collector.withSpan('agent.chat', async (span) => {
          const result = await agent.chat(message, options);
          span.attributes = { message, ...options };
          return result;
        });
      }
      return agent.chat(message, options);
    },

    async shutdown() {
      if (collector) {
        await collector.close();
      }
      await agent.shutdown();
    },
  };
}

export async function createAgentFromTemplate({
  id = 'my-agent',
  name = 'My Agent',
  version = '1.0.0',
  description = '',
  skills = [],
  tools = [],
  outputPath = './agent-package.json',
} = {}) {
  const manifest = createStandaloneAgentManifest({
    id,
    name,
    version,
    description,
    skills,
    tools,
  });

  if (outputPath) {
    const resolved = path.resolve(outputPath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, JSON.stringify(manifest, null, 2), 'utf8');
  }

  return manifest;
}

export default {
  runStandaloneAgent,
  createAgentFromTemplate,
};
