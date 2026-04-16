export function createAuthMiddleware({ isOrchAuthorized, isDashboardAuthorized } = {}) {
  return async function authMiddleware(c, next) {
    c.set('auth', {
      isOrchAuthorized: (req) => isOrchAuthorized?.(req || {}),
      isDashboardAuthorized: (req) => isDashboardAuthorized?.(req || {}),
    });
    await next();
  };
}

export function requireOrchAuth(c) {
  const auth = c.get('auth');
  if (!auth?.isOrchAuthorized()) {
    return c.json({ ok: false, error: 'unauthorized' }, 401);
  }
  return null;
}

export function requireDashboardAuth(c) {
  const auth = c.get('auth');
  if (!auth?.isDashboardAuthorized()) {
    return c.json({ ok: false, error: 'dashboard_unauthorized' }, 401);
  }
  return null;
}
