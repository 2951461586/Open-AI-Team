function normalizeString(value = '') {
  return String(value || '').trim();
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => normalizeString(item)).filter(Boolean))];
}

function toObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function normalizeScopes(values = []) {
  return uniqueStrings(values).map((scope) => scope.toLowerCase());
}

function normalizeChannelRoutes(channels = []) {
  return (Array.isArray(channels) ? channels : []).map((entry) => {
    if (typeof entry === 'string') {
      const routeKey = normalizeString(entry);
      return routeKey ? { routeKey, priority: 1, modes: ['ingress', 'egress'] } : null;
    }
    const routeKey = normalizeString(entry?.routeKey || entry?.channel || entry?.id || entry?.name);
    if (!routeKey) return null;
    return {
      routeKey,
      channel: normalizeString(entry?.channel || routeKey),
      priority: Number.isFinite(Number(entry?.priority)) ? Number(entry.priority) : 1,
      modes: uniqueStrings(entry?.modes || ['ingress', 'egress']).map((mode) => mode.toLowerCase()),
      metadata: toObject(entry?.metadata, {}),
    };
  }).filter(Boolean);
}

export function normalizeAgentCapabilities(input = {}) {
  const source = toObject(input, {});
  const tools = uniqueStrings(source.tools || source.toolIds || []);
  const memory = normalizeScopes(source.memory || source.memoryScopes || []);
  const channels = normalizeChannelRoutes(source.channels || source.bridgeRoutes || []);
  const tags = uniqueStrings(source.tags || source.labels || []).map((item) => item.toLowerCase());

  return {
    schemaVersion: normalizeString(source.schemaVersion || 'agent-capabilities.v1'),
    tools,
    memory,
    channels,
    tags,
    limits: {
      maxConcurrentTasks: Math.max(1, Number(source?.limits?.maxConcurrentTasks || source?.maxConcurrentTasks || 1)),
      maxQueueDepth: Math.max(0, Number(source?.limits?.maxQueueDepth || source?.maxQueueDepth || 0)),
    },
    metadata: toObject(source.metadata, {}),
    verification: {
      mode: normalizeString(source?.verification?.mode || 'declarative'),
      evidence: uniqueStrings(source?.verification?.evidence || []),
      verifiedAt: normalizeString(source?.verification?.verifiedAt || ''),
      notes: normalizeString(source?.verification?.notes || ''),
    },
  };
}

export function summarizeAgentCapabilities(capabilities = {}) {
  const normalized = normalizeAgentCapabilities(capabilities);
  return {
    toolCount: normalized.tools.length,
    memoryScopeCount: normalized.memory.length,
    channelCount: normalized.channels.length,
    tags: [...normalized.tags],
    maxConcurrentTasks: normalized.limits.maxConcurrentTasks,
    maxQueueDepth: normalized.limits.maxQueueDepth,
  };
}

export function validateAgentCapabilities(capabilities = {}, { availableTools = [], availableMemoryScopes = [], availableChannels = [], requireEvidence = false } = {}) {
  const normalized = normalizeAgentCapabilities(capabilities);
  const errors = [];
  const warnings = [];

  const toolSet = new Set(uniqueStrings(availableTools));
  const memorySet = new Set(normalizeScopes(availableMemoryScopes));
  const channelSet = new Set(uniqueStrings(availableChannels));

  for (const tool of normalized.tools) {
    if (toolSet.size > 0 && !toolSet.has(tool)) {
      errors.push({ code: 'tool_not_available', message: `declared tool not available: ${tool}`, field: 'tools', value: tool });
    }
  }

  for (const scope of normalized.memory) {
    if (memorySet.size > 0 && !memorySet.has(scope)) {
      errors.push({ code: 'memory_scope_not_available', message: `declared memory scope not available: ${scope}`, field: 'memory', value: scope });
    }
  }

  for (const channel of normalized.channels) {
    if (channelSet.size > 0 && !channelSet.has(channel.routeKey)) {
      errors.push({ code: 'channel_not_available', message: `declared channel route not available: ${channel.routeKey}`, field: 'channels', value: channel.routeKey });
    }
    if (!Array.isArray(channel.modes) || channel.modes.length === 0) {
      warnings.push({ code: 'channel_modes_missing', message: `channel route missing modes: ${channel.routeKey}`, field: 'channels', value: channel.routeKey });
    }
  }

  if (requireEvidence && normalized.verification.mode !== 'declarative' && normalized.verification.evidence.length === 0) {
    errors.push({ code: 'verification_evidence_missing', message: 'verification evidence required for non-declarative verification mode', field: 'verification.evidence' });
  }

  return {
    ok: errors.length === 0,
    normalized,
    errors,
    warnings,
    summary: summarizeAgentCapabilities(normalized),
  };
}

function scoreChannels(requirements = {}, capabilities = {}) {
  const wanted = uniqueStrings(requirements.channels || requirements.routes || []);
  if (wanted.length === 0) return { score: 0, matched: [] };
  const declared = new Set(normalizeAgentCapabilities(capabilities).channels.map((item) => item.routeKey));
  const matched = wanted.filter((item) => declared.has(item));
  return { score: matched.length * 3, matched };
}

function scoreTools(requirements = {}, capabilities = {}) {
  const wanted = uniqueStrings(requirements.tools || requirements.toolIds || []);
  if (wanted.length === 0) return { score: 0, matched: [] };
  const declared = new Set(normalizeAgentCapabilities(capabilities).tools);
  const matched = wanted.filter((item) => declared.has(item));
  return { score: matched.length * 4, matched };
}

function scoreMemory(requirements = {}, capabilities = {}) {
  const wanted = normalizeScopes(requirements.memory || requirements.memoryScopes || []);
  if (wanted.length === 0) return { score: 0, matched: [] };
  const declared = new Set(normalizeAgentCapabilities(capabilities).memory);
  const matched = wanted.filter((item) => declared.has(item));
  return { score: matched.length * 2, matched };
}

function scoreTags(requirements = {}, capabilities = {}) {
  const wanted = uniqueStrings(requirements.tags || []).map((item) => item.toLowerCase());
  if (wanted.length === 0) return { score: 0, matched: [] };
  const declared = new Set(normalizeAgentCapabilities(capabilities).tags);
  const matched = wanted.filter((item) => declared.has(item));
  return { score: matched.length, matched };
}

export function matchAgentCapabilities(requirements = {}, candidates = []) {
  const requiredTools = uniqueStrings(requirements.requiredTools || requirements.tools || requirements.toolIds || []);
  const requiredMemory = normalizeScopes(requirements.requiredMemory || requirements.memory || requirements.memoryScopes || []);
  const requiredChannels = uniqueStrings(requirements.requiredChannels || requirements.channels || requirements.routes || []);

  return (Array.isArray(candidates) ? candidates : []).map((candidate, index) => {
    const capabilities = normalizeAgentCapabilities(candidate?.capabilities || candidate);
    const declaredTools = new Set(capabilities.tools);
    const declaredMemory = new Set(capabilities.memory);
    const declaredChannels = new Set(capabilities.channels.map((item) => item.routeKey));

    const missingRequired = {
      tools: requiredTools.filter((item) => !declaredTools.has(item)),
      memory: requiredMemory.filter((item) => !declaredMemory.has(item)),
      channels: requiredChannels.filter((item) => !declaredChannels.has(item)),
    };

    const tools = scoreTools(requirements, capabilities);
    const memory = scoreMemory(requirements, capabilities);
    const channels = scoreChannels(requirements, capabilities);
    const tags = scoreTags(requirements, capabilities);
    const loadPenalty = Math.max(0, Number(candidate?.currentTaskCount || 0));
    const priorityBoost = Number(candidate?.priority || 0);
    const score = tools.score + memory.score + channels.score + tags.score + priorityBoost - loadPenalty;

    return {
      agentId: normalizeString(candidate?.agentId || candidate?.id || `candidate:${index + 1}`),
      score,
      priorityBoost,
      loadPenalty,
      capabilities,
      missingRequired,
      matches: {
        tools: tools.matched,
        memory: memory.matched,
        channels: channels.matched,
        tags: tags.matched,
      },
      eligible: missingRequired.tools.length === 0 && missingRequired.memory.length === 0 && missingRequired.channels.length === 0,
      currentTaskCount: Number(candidate?.currentTaskCount || 0),
      status: normalizeString(candidate?.status || 'active'),
      raw: candidate,
    };
  }).sort((a, b) => b.score - a.score || a.currentTaskCount - b.currentTaskCount || a.agentId.localeCompare(b.agentId));
}

export function selectBestAgent(requirements = {}, candidates = []) {
  const ranked = matchAgentCapabilities(requirements, candidates).filter((item) => item.status !== 'offline');
  const best = ranked.find((item) => item.eligible && item.status === 'active') || ranked.find((item) => item.eligible) || null;
  return {
    ok: !!best,
    selected: best,
    ranked,
  };
}

export function buildCapabilitiesSnapshot(registry = []) {
  const items = (Array.isArray(registry) ? registry : []).map((entry) => ({
    agentId: normalizeString(entry?.agentId),
    status: normalizeString(entry?.status || 'unknown'),
    currentTaskCount: Number(entry?.currentTaskCount || 0),
    capabilities: normalizeAgentCapabilities(entry?.capabilities || {}),
  }));
  return {
    contractVersion: 'agent-capabilities-snapshot.v1',
    generatedAt: new Date().toISOString(),
    count: items.length,
    items,
  };
}
