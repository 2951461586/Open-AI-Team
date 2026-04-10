export const ERROR_CATEGORIES = {
  TRANSIENT: 'transient',
  PERMANENT: 'permanent',
  UNKNOWN: 'unknown',
  RATE_LIMIT: 'rate_limit',
  AUTH: 'auth',
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  VALIDATION: 'validation',
  EXECUTION: 'execution',
};

export const RECOVERY_STRATEGIES = {
  RETRY: 'retry',
  FALLBACK: 'fallback',
  DEGRADED: 'degraded',
  SKIP: 'skip',
  ABORT: 'abort',
};

export function classifyError(error = {}) {
  const message = String(error?.message || error?.error || error || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();

  if (/rate.?limit|429|429|too.?many.?requests/i.test(message)) {
    return ERROR_CATEGORIES.RATE_LIMIT;
  }
  if (/401|403|auth|permission|unauthorized|forbidden/i.test(message)) {
    return ERROR_CATEGORIES.AUTH;
  }
  if (/timeout|timed?out|etimedout|esockettimeout/i.test(message)) {
    return ERROR_CATEGORIES.TIMEOUT;
  }
  if (/network|connection|connect|econnrefused|enotfound|enetunreach/i.test(message)) {
    return ERROR_CATEGORIES.NETWORK;
  }
  if (/validation|invalid|malformed|schema.?error|parse.?error/i.test(message)) {
    return ERROR_CATEGORIES.VALIDATION;
  }
  if (/not.?found|404|enoent/i.test(message)) {
    return ERROR_CATEGORIES.PERMANENT;
  }
  if (/internal|server.?error|500|503/i.test(message)) {
    return ERROR_CATEGORIES.TRANSIENT;
  }

  return ERROR_CATEGORIES.UNKNOWN;
}

export function getRecoveryStrategy(error = {}, options = {}) {
  const category = classifyError(error);
  const retryable = options.retryableErrors || [];
  const nonRetryable = options.nonRetryableErrors || [];

  if (nonRetryable.includes(category)) {
    return { strategy: RECOVERY_STRATEGIES.ABORT, shouldRetry: false };
  }

  if (retryable.includes(category)) {
    return { strategy: RECOVERY_STRATEGIES.RETRY, shouldRetry: true };
  }

  switch (category) {
    case ERROR_CATEGORIES.TRANSIENT:
    case ERROR_CATEGORIES.RATE_LIMIT:
    case ERROR_CATEGORIES.NETWORK:
    case ERROR_CATEGORIES.TIMEOUT:
      return { strategy: RECOVERY_STRATEGIES.RETRY, shouldRetry: true };
    case ERROR_CATEGORIES.AUTH:
      return { strategy: RECOVERY_STRATEGIES.FALLBACK, shouldRetry: false };
    case ERROR_CATEGORIES.VALIDATION:
      return { strategy: RECOVERY_STRATEGIES.SKIP, shouldRetry: false };
    case ERROR_CATEGORIES.PERMANENT:
      return { strategy: RECOVERY_STRATEGIES.ABORT, shouldRetry: false };
    default:
      return { strategy: RECOVERY_STRATEGIES.RETRY, shouldRetry: true };
  }
}

export function createRetryPolicy({
  maxRetries = 3,
  baseDelayMs = 1000,
  maxDelayMs = 30000,
  backoffMultiplier = 2,
  jitter = true,
  retryableErrors = [ERROR_CATEGORIES.TRANSIENT, ERROR_CATEGORIES.RATE_LIMIT, ERROR_CATEGORIES.NETWORK, ERROR_CATEGORIES.TIMEOUT],
} = {}) {
  const state = {
    attemptCount: 0,
    totalRetries: 0,
    successfulRetries: 0,
    failedRetries: 0,
  };

  function calculateDelay(attempt = 1) {
    const exponentialDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
    if (!jitter) return cappedDelay;
    const jitterAmount = cappedDelay * 0.2 * Math.random();
    return Math.floor(cappedDelay + jitterAmount);
  }

  async function executeWithRetry(fn = () => {}, options = {}) {
    const max = Math.max(0, options.maxRetries ?? maxRetries);
    let lastError = null;

    for (let attempt = 0; attempt <= max; attempt++) {
      state.attemptCount++;
      if (attempt > 0) state.totalRetries++;

      try {
        const result = await fn({ attempt, maxRetries: max });
        if (attempt > 0) state.successfulRetries++;
        return { ok: true, result, attempts: attempt + 1 };
      } catch (error) {
        lastError = error;
        const { shouldRetry } = getRecoveryStrategy(error, { retryableErrors });

        if (!shouldRetry || attempt >= max) {
          state.failedRetries++;
          return {
            ok: false,
            error,
            attempts: attempt + 1,
            category: classifyError(error),
            exhausted: attempt >= max,
          };
        }

        const delay = calculateDelay(attempt);
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    state.failedRetries++;
    return {
      ok: false,
      error: lastError,
      attempts: max + 1,
      exhausted: true,
    };
  }

  function getStats() {
    return {
      ...state,
      maxRetries,
      baseDelayMs,
      maxDelayMs,
      backoffMultiplier,
      jitter,
    };
  }

  function reset() {
    state.attemptCount = 0;
    state.totalRetries = 0;
    state.successfulRetries = 0;
    state.failedRetries = 0;
  }

  return {
    executeWithRetry,
    calculateDelay,
    getStats,
    reset,
  };
}

export function createCircuitBreaker({
  failureThreshold = 5,
  successThreshold = 2,
  timeoutMs = 60000,
  monitorWindowMs = 30000,
} = {}) {
  let state = {
    failures: 0,
    successes: 0,
    lastFailureTime: null,
    state: 'closed',
  };

  const history = [];

  function isOpen() {
    return state.state === 'open' && (Date.now() - state.lastFailureTime) < timeoutMs;
  }

  function should_attempt() {
    if (state.state === 'closed') return true;
    if (state.state === 'open') {
      if (is_open()) return false;
      state.state = 'half-open';
      return true;
    }
    return state.state === 'half-open';
  }

  function recordSuccess() {
    const now = Date.now();
    history.push({ type: 'success', time: now });
    state.successes++;
    state.failures = 0;

    if (state.state === 'half-open' && state.successes >= successThreshold) {
      state.state = 'closed';
      state.successes = 0;
    }

    pruneHistory(now);
  }

  function recordFailure() {
    const now = Date.now();
    history.push({ type: 'failure', time: now });
    state.failures++;
    state.lastFailureTime = now;

    if (state.state === 'closed' && state.failures >= failureThreshold) {
      state.state = 'open';
    } else if (state.state === 'half-open') {
      state.state = 'open';
    }

    pruneHistory(now);
  }

  function pruneHistory(now = Date.now()) {
    const cutoff = now - monitorWindowMs;
    while (history.length > 0 && history[0].time < cutoff) {
      history.shift();
    }
  }

  function getStatus() {
    return {
      state: state.state,
      failures: state.failures,
      successes: state.successes,
      lastFailureTime: state.lastFailureTime,
      isOpen: is_open(),
      shouldAttempt: should_attempt(),
      recentHistory: [...history],
    };
  }

  return {
    recordSuccess,
    recordFailure,
    shouldAttempt: should_attempt,
    getStatus,
  };
}

export function createCheckpointManager({
  checkpointDir = './.checkpoints',
  maxCheckpoints = 10,
} = {}) {
  const checkpoints = new Map();

  async function saveCheckpoint(id = '', data = {}, metadata = {}) {
    const checkpoint = {
      id: String(id),
      timestamp: new Date().toISOString(),
      data,
      metadata,
    };

    checkpoints.set(id, checkpoint);

    try {
      const { writeFile, mkdir } = await import('node:fs/promises');
      const { join } = await import('node:path');
      await mkdir(checkpointDir, { recursive: true });
      const filePath = join(checkpointDir, `${id}.json`);
      await writeFile(filePath, JSON.stringify(checkpoint, null, 2), 'utf8');

      pruneOldCheckpoints();
      return { ok: true, checkpoint };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  function pruneOldCheckpoints() {
    if (checkpoints.size <= maxCheckpoints) return;
    const sorted = [...checkpoints.entries()].sort(
      (a, b) => new Date(b[1].timestamp).getTime() - new Date(a[1].timestamp).getTime()
    );
    const toRemove = sorted.slice(maxCheckpoints);
    for (const [id] of toRemove) {
      checkpoints.delete(id);
    }
  }

  function getCheckpoint(id = '') {
    return checkpoints.get(String(id)) || null;
  }

  function listCheckpoints() {
    return [...checkpoints.values()].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  function deleteCheckpoint(id = '') {
    return checkpoints.delete(String(id));
  }

  return {
    saveCheckpoint,
    getCheckpoint,
    listCheckpoints,
    deleteCheckpoint,
  };
}

export default {
  ERROR_CATEGORIES,
  RECOVERY_STRATEGIES,
  classifyError,
  getRecoveryStrategy,
  createRetryPolicy,
  createCircuitBreaker,
  createCheckpointManager,
};
