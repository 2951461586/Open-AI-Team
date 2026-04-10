export const STANDALONE_AGENT_CONTRACT_VERSION = 'standalone-agent-package.v1';

export function createStandaloneAgentManifest({
  id = 'standalone-agent',
  name = 'Standalone Agent',
  version = '1.0.0',
  description = '',
  author = '',
  skills = [],
  tools = [],
  capabilities = [],
  model = 'auto',
  maxContextTokens = 100000,
  isolationLevel = 'partial',
  personality = {},
} = {}) {
  return {
    contractVersion: STANDALONE_AGENT_CONTRACT_VERSION,
    id: String(id).trim(),
    name: String(name).trim(),
    version: String(version).trim(),
    description: String(description).trim(),
    author: String(author).trim(),
    metadata: {
      createdAt: new Date().toISOString(),
      model: String(model).trim(),
      maxContextTokens: Math.max(0, Number(maxContextTokens) || 100000),
      isolationLevel: String(isolationLevel).trim(),
    },
    skills: Array.isArray(skills) ? skills.map(String) : [],
    tools: Array.isArray(tools) ? tools.map(String) : [],
    capabilities: Array.isArray(capabilities) ? capabilities.map(String) : [],
    personality: normalizePersonality(personality),
  };
}

function normalizePersonality(personality = {}) {
  return {
    name: String(personality.name || 'Assistant'),
    style: String(personality.style || 'helpful'),
    tone: String(personality.tone || 'professional'),
    mission: String(personality.mission || 'Provide helpful assistance'),
    greeting: String(personality.greeting || 'Hello! How can I help you today?'),
    ...personality,
  };
}

export function createStandaloneAgentContext({
  manifest = {},
  workspaceRoot = './workspace',
  skillsRoot = './skills',
  memoryPath = './memory',
  config = {},
} = {}) {
  return {
    manifest,
    workspace: {
      root: String(workspaceRoot),
      skills: String(skillsRoot),
      memory: String(memoryPath),
    },
    config: {
      model: manifest?.metadata?.model || 'auto',
      maxContextTokens: manifest?.metadata?.maxContextTokens || 100000,
      isolationLevel: manifest?.metadata?.isolationLevel || 'partial',
      ...config,
    },
    initialized: false,
    startedAt: null,
  };
}

export function validateStandaloneAgentManifest(manifest = {}) {
  const errors = [];

  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, errors: ['manifest must be a non-null object'] };
  }

  const id = String(manifest.id || '').trim();
  if (!id) errors.push('manifest.id is required');
  if (id && !/^[a-zA-Z0-9_-]+$/.test(id)) {
    errors.push('manifest.id must contain only alphanumeric characters, hyphens, and underscores');
  }

  const version = String(manifest.version || '').trim();
  if (!version) errors.push('manifest.version is required');
  if (version && !/^\d+\.\d+\.\d+$/.test(version)) {
    errors.push('manifest.version must be in semver format (e.g., 1.0.0)');
  }

  const name = String(manifest.name || '').trim();
  if (!name) errors.push('manifest.name is required');

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function getStandaloneAgentCapabilities(manifest = {}) {
  const base = [
    'chat',
    'file_read',
    'file_write',
    'memory',
    'skills',
  ];

  const skills = Array.isArray(manifest.skills) ? manifest.skills : [];
  const tools = Array.isArray(manifest.tools) ? manifest.tools : [];
  const caps = Array.isArray(manifest.capabilities) ? manifest.capabilities : [];

  return [...new Set([...base, ...skills, ...tools, ...caps])];
}

export function createStandaloneAgentRuntime(manifest = {}, options = {}) {
  const validation = validateStandaloneAgentManifest(manifest);
  if (!validation.ok) {
    throw new Error(`Invalid standalone agent manifest: ${validation.errors.join(', ')}`);
  }

  const context = createStandaloneAgentContext({
    manifest,
    workspaceRoot: options.workspaceRoot || './workspace',
    skillsRoot: options.skillsRoot || './skills',
    memoryPath: options.memoryPath || './memory',
    config: options.config || {},
  });

  return {
    manifest,
    context,
    capabilities: getStandaloneAgentCapabilities(manifest),

    async initialize() {
      if (context.initialized) return { ok: true, alreadyInitialized: true };
      context.initialized = true;
      context.startedAt = new Date().toISOString();
      return { ok: true };
    },

    async chat(message = '', options = {}) {
      if (!context.initialized) {
        await this.initialize();
      }
      return {
        ok: true,
        reply: `Echo: ${message}`,
        context: {
          agentId: manifest.id,
          timestamp: new Date().toISOString(),
        },
      };
    },

    async shutdown() {
      context.initialized = false;
      return { ok: true };
    },
  };
}

export default {
  STANDALONE_AGENT_CONTRACT_VERSION,
  createStandaloneAgentManifest,
  createStandaloneAgentContext,
  createStandaloneAgentRuntime,
  validateStandaloneAgentManifest,
  getStandaloneAgentCapabilities,
};
