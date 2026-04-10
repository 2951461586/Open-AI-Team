export const CONTEXT_ISOLATION_LEVELS = {
  NONE: 'none',
  PARTIAL: 'partial',
  FULL: 'full',
  STRICT: 'strict',
};

export const ISOLATION_SCOPES = {
  MEMORY: 'memory',
  TOOLS: 'tools',
  SANDBOX: 'sandbox',
  CONTEXT: 'context',
  FILESYSTEM: 'filesystem',
};

export function createSubAgentContext({
  parentContext = {},
  isolationLevel = CONTEXT_ISOLATION_LEVELS.PARTIAL,
  scope = {},
  options = {},
} = {}) {
  const config = {
    isolationLevel: String(isolationLevel || CONTEXT_ISOLATION_LEVELS.PARTIAL).toLowerCase(),
    scope: {
      memory: Boolean(scope.memory ?? true),
      tools: scope.tools ?? true,
      sandbox: scope.sandbox ?? true,
      context: scope.context ?? true,
      filesystem: scope.filesystem ?? true,
      ...scope,
    },
    options: {
      maxContextTokens: Math.max(0, Number(options.maxContextTokens || 0)),
      maxMemoryItems: Math.max(0, Number(options.maxMemoryItems || 50)),
      excludedMemoryKeys: Array.isArray(options.excludedMemoryKeys) ? options.excludedMemoryKeys : [],
      includedMemoryKeys: Array.isArray(options.includedMemoryKeys) ? options.includedMemoryKeys : [],
      toolWhitelist: Array.isArray(options.toolWhitelist) ? options.toolWhitelist : null,
      toolBlacklist: Array.isArray(options.toolBlacklist) ? options.toolBlacklist : [],
      sandboxAllowedPaths: Array.isArray(options.sandboxAllowedPaths) ? options.sandboxAllowedPaths : null,
      sandboxDeniedPaths: Array.isArray(options.sandboxDeniedPaths) ? options.sandboxDeniedPaths : [],
      inheritParentMemory: Boolean(options.inheritParentMemory ?? false),
      isolateFromOtherAgents: Boolean(options.isolateFromOtherAgents ?? true),
      ...options,
    },
  };

  return {
    id: `subctx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    parentContextId: parentContext?.id || '',
    isolationLevel: config.isolationLevel,
    scope: config.scope,
    options: config.options,
    createdAt: new Date().toISOString(),
    metadata: {},
  };
}

export function filterMemoryByIsolation(context = {}, memorySnapshot = '') {
  if (!context?.scope?.memory) return '';
  if (context?.options?.excludedMemoryKeys?.length > 0) {
    let filtered = memorySnapshot;
    for (const key of context.options.excludedMemoryKeys) {
      const regex = new RegExp(`\\[${key}\\]|${key}：|${key}:`, 'gi');
      filtered = filtered.replace(regex, '[FILTERED]');
    }
    return filtered;
  }
  if (context?.options?.includedMemoryKeys?.length > 0) {
    const lines = String(memorySnapshot).split('\n');
    const included = context.options.includedMemoryKeys;
    return lines
      .filter((line) => included.some((key) => line.toLowerCase().includes(key.toLowerCase())))
      .join('\n');
  }
  return memorySnapshot;
}

export function filterToolsByIsolation(context = {}, tools = []) {
  if (!context?.scope?.tools) return [];
  const whitelist = context.options?.toolWhitelist;
  const blacklist = context.options?.toolBlacklist || [];

  if (whitelist) {
    return tools.filter((tool) => whitelist.includes(tool.id || tool.name));
  }
  if (blacklist.length > 0) {
    return tools.filter((tool) => !blacklist.includes(tool.id || tool.name));
  }
  return tools;
}

export function buildIsolatedSandboxConfig(context = {}, baseSandboxConfig = {}) {
  if (!context?.scope?.sandbox) return baseSandboxConfig;

  const allowedPaths = context.options?.sandboxAllowedPaths;
  const deniedPaths = context.options?.sandboxDeniedPaths || [];

  if (allowedPaths) {
    return {
      ...baseSandboxConfig,
      allowedPaths,
      deniedPaths: [...(baseSandboxConfig.deniedPaths || []), ...deniedPaths],
    };
  }

  return {
    ...baseSandboxConfig,
    deniedPaths: [...(baseSandboxConfig.deniedPaths || []), ...deniedPaths],
  };
}

export function shouldIncludeInContext(context = {}, itemKey = '', itemType = '') {
  if (!context?.scope?.context) return false;

  const includedKeys = context.options?.includedMemoryKeys || [];
  const excludedKeys = context.options?.excludedMemoryKeys || [];

  if (excludedKeys.includes(itemKey)) return false;
  if (includedKeys.length === 0) return true;
  return includedKeys.includes(itemKey);
}

export function createContextBoundary({
  parentSpanId = '',
  traceId = '',
  contextId = '',
} = {}) {
  return {
    parentSpanId: String(parentSpanId || ''),
    traceId: String(traceId || ''),
    contextId: String(contextId || ''),
    boundaryType: 'sub_agent',
    timestamp: new Date().toISOString(),
  };
}

export function mergeContextOptions(base = {}, override = {}) {
  return {
    ...base,
    ...override,
    excludedMemoryKeys: [
      ...(base.excludedMemoryKeys || []),
      ...(override.excludedMemoryKeys || []),
    ],
    includedMemoryKeys:
      override.includedMemoryKeys?.length > 0
        ? override.includedMemoryKeys
        : base.includedMemoryKeys || [],
    toolWhitelist: override.toolWhitelist || base.toolWhitelist,
    toolBlacklist: [
      ...(base.toolBlacklist || []),
      ...(override.toolBlacklist || []),
    ],
    sandboxAllowedPaths:
      override.sandboxAllowedPaths || base.sandboxAllowedPaths,
    sandboxDeniedPaths: [
      ...(base.sandboxDeniedPaths || []),
      ...(override.sandboxDeniedPaths || []),
    ],
  };
}

export function isContextIsolationEnabled(context = {}) {
  return (
    context?.isolationLevel &&
    context.isolationLevel !== CONTEXT_ISOLATION_LEVELS.NONE
  );
}

export function getIsolationCompatibility(level = '') {
  const compat = {
    [CONTEXT_ISOLATION_LEVELS.NONE]: {
      canInheritMemory: true,
      canAccessAllTools: true,
      canSeeOtherAgents: true,
      strictFilesystem: false,
    },
    [CONTEXT_ISOLATION_LEVELS.PARTIAL]: {
      canInheritMemory: true,
      canAccessAllTools: false,
      canSeeOtherAgents: true,
      strictFilesystem: false,
    },
    [CONTEXT_ISOLATION_LEVELS.FULL]: {
      canInheritMemory: false,
      canAccessAllTools: false,
      canSeeOtherAgents: false,
      strictFilesystem: true,
    },
    [CONTEXT_ISOLATION_LEVELS.STRICT]: {
      canInheritMemory: false,
      canAccessAllTools: false,
      canSeeOtherAgents: false,
      strictFilesystem: true,
    },
  };
  return compat[String(level).toLowerCase()] || compat[CONTEXT_ISOLATION_LEVELS.PARTIAL];
}

export function validateIsolationConfig(config = {}) {
  const errors = [];
  const level = String(config.isolationLevel || '').toLowerCase();

  if (!Object.values(CONTEXT_ISOLATION_LEVELS).includes(level)) {
    errors.push(`Invalid isolation level: ${level}`);
  }

  if (config.options?.toolWhitelist && config.options?.toolBlacklist?.length > 0) {
    errors.push('Cannot specify both toolWhitelist and toolBlacklist');
  }

  if (config.options?.sandboxAllowedPaths && config.options?.sandboxDeniedPaths?.length > 0) {
    const overlap = config.options.sandboxAllowedPaths.filter((p) =>
      config.options.sandboxDeniedPaths.includes(p)
    );
    if (overlap.length > 0) {
      errors.push(`Conflicting sandbox paths: ${overlap.join(', ')}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export default {
  CONTEXT_ISOLATION_LEVELS,
  ISOLATION_SCOPES,
  createSubAgentContext,
  filterMemoryByIsolation,
  filterToolsByIsolation,
  buildIsolatedSandboxConfig,
  shouldIncludeInContext,
  createContextBoundary,
  mergeContextOptions,
  isContextIsolationEnabled,
  getIsolationCompatibility,
  validateIsolationConfig,
};
