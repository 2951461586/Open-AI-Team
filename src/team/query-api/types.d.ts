export type TeamQueryContractName = 'team.governance.query.v1';
export type TeamQueryContractVersion = 'v1';

export interface TeamQueryApiMeta {
  namespace: 'team.governance.query';
  contract: TeamQueryContractName;
  version: TeamQueryContractVersion;
  route: string;
  resourceKind: string;
  stable: true;
}

export interface TeamQueryResource {
  kind: string;
  taskId?: string;
  teamId?: string;
  state?: string;
  batchId?: string;
  count?: number;
  node?: string;
  [key: string]: unknown;
}

export interface TeamQueryLinks {
  self: string;
  root: '/state/team';
  contracts: '/state/team/contracts';
  [key: string]: string;
}

export interface TeamQueryStableEnvelope<T = unknown> {
  ok: true;
  api: TeamQueryApiMeta;
  resource: TeamQueryResource;
  query: Record<string, string | number | boolean | null | undefined>;
  links: TeamQueryLinks;
}

export interface TeamQueryRouteCatalogEntry {
  path: string;
  resourceKind: string;
  requiredTopLevel: string[];
}

export interface TeamPublishedRouteCatalog {
  workbenchPayload: TeamQueryRouteCatalogEntry | null;
  residents: TeamQueryRouteCatalogEntry | null;
  control: TeamQueryRouteCatalogEntry | null;
  summary: TeamQueryRouteCatalogEntry | null;
  pipeline: TeamQueryRouteCatalogEntry | null;
  dashboard: TeamQueryRouteCatalogEntry | null;
}

export interface TeamQueryContractsRoute extends TeamQueryStableEnvelope {
  contracts: Record<string, unknown>;
  queryContracts: {
    contract: TeamQueryContractName;
    version: TeamQueryContractVersion;
    stableEnvelopeFields: string[];
    featuredRouteKeys: string[];
    featuredRoutes: TeamPublishedRouteCatalog;
    routes: Record<string, TeamQueryRouteCatalogEntry>;
  };
}

export interface TeamResidentsRoute extends TeamQueryStableEnvelope {
  residents: Array<Record<string, unknown>>;
  counts: {
    count: number;
    busyCount: number;
    activeLeaseCount: number;
  };
  observedAt?: number;
}

export interface TeamIngressListItem {
  taskId: string;
  teamId: string;
  state: string;
  updatedAt: number;
  createdAt: number;
  taskMode: string;
  riskLevel: string;
  sourceEventId: string;
  ingressKind: string;
  originNode: string;
  deliveryTarget: string;
  recipientId: string;
  recipientType: string;
  deliveryMode: string;
  senderId: string;
  channel: string;
  source: string;
}

export interface TeamQueryIngressRoute extends TeamQueryStableEnvelope {
  items: TeamIngressListItem[];
}

export interface TeamConfigResolutionStatus {
  requestedPath: string;
  resolvedPath: string;
  resolution: 'primary' | 'legacy_explicit' | 'legacy_fallback' | 'custom_explicit' | 'missing' | 'unknown';
  usedLegacy: boolean;
  allowLegacyFallback: boolean;
  warning: string;
  exists: {
    primary: boolean;
    legacy: boolean;
    resolved: boolean;
  };
}

export interface TeamQueryConfigRoute extends TeamQueryStableEnvelope {
  config: {
    version: string;
    defaults: Record<string, unknown>;
    routing: Record<string, unknown>;
    nodeMap: Record<string, unknown>;
    roles: Record<string, unknown>;
  };
  configStatus: {
    primaryPath: string;
    legacyPath: string;
    defaultPath: string;
    cachedPath: string;
    resolution: TeamConfigResolutionStatus;
  };
}
