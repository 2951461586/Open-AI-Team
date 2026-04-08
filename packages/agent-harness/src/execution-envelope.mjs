function normalizeJson(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack || '',
    };
  }
  if (Array.isArray(value)) return value.map((item) => normalizeJson(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeJson(item)]));
  }
  if (typeof value === 'function') return '[function]';
  return value;
}

function nowIso() {
  return new Date().toISOString();
}

function toIso(value = '') {
  if (!value) return nowIso();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? nowIso() : date.toISOString();
}

function toDurationMs(startedAt = '', finishedAt = '') {
  const start = Date.parse(toIso(startedAt));
  const end = Date.parse(toIso(finishedAt));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, end - start);
}

export function normalizeExecutionError(error = null) {
  if (!error) return null;
  if (typeof error === 'string') return { message: error };
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack || '',
      details: normalizeJson(error.details || null),
    };
  }
  if (typeof error === 'object') {
    return {
      name: String(error.name || ''),
      message: String(error.message || error.error || 'execution_failed'),
      stack: String(error.stack || ''),
      details: normalizeJson(error.details || error),
    };
  }
  return { message: String(error) };
}

export function createExecutionEnvelope({
  executionId = '',
  executionType = 'execution',
  ok = true,
  status = '',
  startedAt = '',
  finishedAt = '',
  source = '',
  actor = null,
  target = null,
  request = null,
  response = null,
  metadata = null,
  trace = null,
  error = null,
} = {}) {
  const normalizedStartedAt = toIso(startedAt || nowIso());
  const normalizedFinishedAt = toIso(finishedAt || normalizedStartedAt);
  const normalizedError = normalizeExecutionError(error);
  const normalizedOk = normalizedError ? false : ok !== false;
  return {
    kind: 'execution_envelope',
    contractVersion: 'agent-harness-execution.v1',
    executionId: String(executionId || `exec:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`),
    executionType: String(executionType || 'execution'),
    status: String(status || (normalizedOk ? 'ok' : 'error')),
    ok: normalizedOk,
    startedAt: normalizedStartedAt,
    finishedAt: normalizedFinishedAt,
    durationMs: toDurationMs(normalizedStartedAt, normalizedFinishedAt),
    source: String(source || ''),
    actor: normalizeJson(actor),
    target: normalizeJson(target),
    request: normalizeJson(request),
    response: normalizeJson(response),
    metadata: normalizeJson(metadata),
    trace: normalizeJson(trace),
    error: normalizedError,
  };
}

export function createLlmExecutionEnvelope({
  executionId = '',
  request = {},
  response = {},
  routeInfo = null,
  selectedModel = null,
  fallbackUsed = false,
  startedAt = '',
  finishedAt = '',
  source = 'model-router',
  trace = null,
  error = null,
  metadata = {},
} = {}) {
  const envelope = createExecutionEnvelope({
    executionId,
    executionType: 'llm.call',
    ok: error ? false : response?.ok !== false,
    startedAt,
    finishedAt,
    source,
    target: {
      provider: response?.provider || selectedModel?.provider || '',
      model: response?.model || selectedModel?.model || '',
      routePreset: routeInfo?.preset || '',
    },
    request,
    response,
    trace,
    error,
    metadata: {
      routePreset: routeInfo?.preset || '',
      routeInfo: normalizeJson(routeInfo),
      selectedModel: normalizeJson(selectedModel),
      fallbackUsed: !!fallbackUsed,
      latencyMs: Number(response?.latencyMs || 0),
      tokenUsage: normalizeJson(response?.tokenUsage || response?.usage || null),
      cost: Number(response?.cost || 0),
      ...normalizeJson(metadata),
    },
  });

  return {
    ...envelope,
    provider: response?.provider || selectedModel?.provider || '',
    model: response?.model || selectedModel?.model || '',
    routePreset: routeInfo?.preset || '',
    routeInfo: normalizeJson(routeInfo),
    fallbackUsed: !!fallbackUsed,
    latencyMs: Number(response?.latencyMs || 0),
    tokenUsage: normalizeJson(response?.tokenUsage || response?.usage || null),
    cost: Number(response?.cost || 0),
    reply: String(response?.reply || ''),
  };
}

export function createToolExecutionEnvelope({
  executionId = '',
  tool = '',
  args = {},
  result = null,
  actor = null,
  source = '',
  auditId = '',
  startedAt = '',
  finishedAt = '',
  ok = true,
  error = null,
  trace = null,
  metadata = {},
} = {}) {
  const envelope = createExecutionEnvelope({
    executionId,
    executionType: 'tool.call',
    ok,
    startedAt,
    finishedAt,
    source,
    actor,
    target: { tool: String(tool || '') },
    request: { tool: String(tool || ''), args: normalizeJson(args) },
    response: normalizeJson(result),
    trace,
    error,
    metadata: {
      auditId: String(auditId || ''),
      ...normalizeJson(metadata),
    },
  });

  return {
    ...envelope,
    tool: String(tool || ''),
    auditId: String(auditId || ''),
    result: normalizeJson(result),
  };
}
