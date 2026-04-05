function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function normalizeIntegration(value = '') {
  return String(value || '').trim().toLowerCase();
}

const remoteSessionBootstrapIntegrationLoaders = {
  openclaw: async () => {
    const mod = await import('./openclaw/host-bootstrap.mjs');
    return mod?.createOpenClawRemoteSessionHostBootstrap || null;
  },
};

export function listRemoteSessionHostBootstrapIntegrations() {
  return Object.keys(remoteSessionBootstrapIntegrationLoaders);
}

export function resolveRemoteSessionHostBootstrapIntegration(config = {}) {
  const env = (config?.ENV && typeof config.ENV === 'object' && !Array.isArray(config.ENV)) ? config.ENV : {};
  return normalizeIntegration(firstNonEmpty(
    config?.remoteSessionIntegration,
    env.TEAM_REMOTE_SESSION_INTEGRATION,
    process.env.TEAM_REMOTE_SESSION_INTEGRATION,
    'none',
  ));
}

export async function resolveRemoteSessionHostBootstrap(config = {}) {
  const explicitFactory = config?.remoteSessionHostBootstrapFactory || config?.remoteSessionBootstrapFactory;
  if (typeof explicitFactory === 'function') {
    const out = await Promise.resolve(explicitFactory(config));
    return out || null;
  }

  const integration = resolveRemoteSessionHostBootstrapIntegration(config);
  if (!integration || integration === 'none' || integration === 'host-agnostic') return null;
  const loader = remoteSessionBootstrapIntegrationLoaders[integration];
  if (typeof loader !== 'function') return null;
  const factory = await loader();
  if (typeof factory !== 'function') return null;
  const bootstrap = await Promise.resolve(factory(config));
  if (bootstrap && typeof bootstrap === 'object' && !bootstrap.selectedIntegration) {
    bootstrap.selectedIntegration = integration;
  }
  return bootstrap;
}
