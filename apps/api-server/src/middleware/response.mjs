export function createApiResponse() {
  return async function apiResponse(c, next) {
    await next();
  };
}

export function buildEnvelope({ route, resourceKind, payload, query = {} } = {}) {
  return {
    ok: true,
    route: route || '',
    resourceKind: resourceKind || '',
    query: query || {},
    payload: payload || {},
    timestamp: Date.now(),
  };
}

export function buildErrorEnvelope({ route, error, code = 'error' } = {}) {
  return {
    ok: false,
    route: route || '',
    error: String(error || 'unknown_error'),
    code: code || 'error',
    timestamp: Date.now(),
  };
}
