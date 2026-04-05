import { createOpenClawRemoteSessionHostBootstrap } from './openclaw/host-bootstrap.mjs';

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

const remoteSessionBootstrapFactories = {
  openclaw: createOpenClawRemoteSessionHostBootstrap,
};

export function listRemoteSessionHostBootstrapIntegrations() {
  return Object.keys(remoteSessionBootstrapFactories);
}

export function resolveRemoteSessionHostBootstrapIntegration(config = {}) {
  const env = (config?.ENV && typeof config.ENV === 'object' && !Array.isArray(config.ENV)) ? config.ENV : {};
  return normalizeIntegration(firstNonEmpty(
    config?.remoteSessionIntegration,
    env.TEAM_REMOTE_SESSION_INTEGRATION,
    process.env.TEAM_REMOTE_SESSION_INTEGRATION,
    'openclaw',
  ));
}

export function resolveRemoteSessionHostBootstrap(config = {}) {
  const explicitFactory = config?.remoteSessionHostBootstrapFactory || config?.remoteSessionBootstrapFactory;
  if (typeof explicitFactory === 'function') {
    const out = explicitFactory(config);
    return out || null;
  }

  const integration = resolveRemoteSessionHostBootstrapIntegration(config);
  if (!integration || integration === 'none' || integration === 'host-agnostic') return null;
  const factory = remoteSessionBootstrapFactories[integration];
  if (typeof factory !== 'function') return null;
  const bootstrap = factory(config);
  if (bootstrap && typeof bootstrap === 'object' && !bootstrap.selectedIntegration) {
    bootstrap.selectedIntegration = integration;
  }
  return bootstrap;
}
