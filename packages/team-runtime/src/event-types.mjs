const EVENT_TYPE_LIST = [
  'task.created',
  'task.completed',
  'task.failed',
  'task.execution.started',
  'task.execution.completed',
  'task.execution.failed',
  'task.child.created',
  'task.delegated',
  'task.replanned',
  'agent.joined',
  'agent.left',
  'memory.written',
  'channel.message',
  'imc.request',
  'imc.response',
  'session.created',
  'session.updated',
  'session.linked',
  'session.switched',
  'session.migrated',
  'event.replayed',
];

export const TEAM_EVENT_TYPES = Object.freeze(
  EVENT_TYPE_LIST.reduce((acc, key) => {
    const constKey = key.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    acc[constKey] = key;
    return acc;
  }, {}),
);

export const EVENT_PRIORITIES = Object.freeze({
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  CRITICAL: 'critical',
});

export const EVENT_VISIBILITY = Object.freeze({
  PUBLIC: 'public',
  INTERNAL: 'internal',
  AUDIT: 'audit',
});

export const EVENT_TYPE_SET = new Set(EVENT_TYPE_LIST);

export const EVENT_SCHEMA_VERSION = '1.0.0';

export const EVENT_TYPE_SCHEMAS = Object.freeze({
  [TEAM_EVENT_TYPES.TASK_CREATED]: {
    requiredPayload: ['taskId'],
    recommendedPayload: ['teamId', 'title', 'state'],
  },
  [TEAM_EVENT_TYPES.TASK_COMPLETED]: {
    requiredPayload: ['taskId'],
    recommendedPayload: ['teamId', 'result', 'state'],
  },
  [TEAM_EVENT_TYPES.TASK_FAILED]: {
    requiredPayload: ['taskId'],
    recommendedPayload: ['teamId', 'error', 'state'],
  },
  [TEAM_EVENT_TYPES.TASK_EXECUTION_STARTED]: {
    requiredPayload: ['taskId'],
    recommendedPayload: ['teamId', 'childTaskId', 'assignmentId', 'role', 'scope', 'state', 'timestamp'],
  },
  [TEAM_EVENT_TYPES.TASK_EXECUTION_COMPLETED]: {
    requiredPayload: ['taskId'],
    recommendedPayload: ['teamId', 'childTaskId', 'assignmentId', 'role', 'scope', 'state', 'timestamp', 'summary'],
  },
  [TEAM_EVENT_TYPES.TASK_EXECUTION_FAILED]: {
    requiredPayload: ['taskId'],
    recommendedPayload: ['teamId', 'childTaskId', 'assignmentId', 'role', 'scope', 'state', 'timestamp', 'error'],
  },
  [TEAM_EVENT_TYPES.TASK_CHILD_CREATED]: {
    requiredPayload: ['taskId'],
    recommendedPayload: ['teamId', 'childTaskId', 'assignmentId', 'role', 'scope', 'timestamp'],
  },
  [TEAM_EVENT_TYPES.TASK_DELEGATED]: {
    requiredPayload: ['taskId'],
    recommendedPayload: ['teamId', 'childTaskId', 'assignmentId', 'role', 'scope', 'timestamp'],
  },
  [TEAM_EVENT_TYPES.TASK_REPLANNED]: {
    requiredPayload: ['taskId'],
    recommendedPayload: ['teamId', 'scope', 'timestamp', 'triggeredByAssignmentIds', 'addedWorkItemIds'],
  },
  [TEAM_EVENT_TYPES.AGENT_JOINED]: {
    requiredPayload: ['agentId'],
    recommendedPayload: ['teamId', 'role', 'memberId'],
  },
  [TEAM_EVENT_TYPES.AGENT_LEFT]: {
    requiredPayload: ['agentId'],
    recommendedPayload: ['teamId', 'role', 'memberId', 'reason'],
  },
  [TEAM_EVENT_TYPES.MEMORY_WRITTEN]: {
    requiredPayload: ['memoryId'],
    recommendedPayload: ['scope', 'kind', 'taskId'],
  },
  [TEAM_EVENT_TYPES.CHANNEL_MESSAGE]: {
    requiredPayload: ['channel'],
    recommendedPayload: ['sessionId', 'userId', 'messageId', 'direction'],
  },
  [TEAM_EVENT_TYPES.IMC_REQUEST]: {
    requiredPayload: ['requestId'],
    recommendedPayload: ['fromAgentId', 'toAgentId', 'method'],
  },
  [TEAM_EVENT_TYPES.IMC_RESPONSE]: {
    requiredPayload: ['requestId'],
    recommendedPayload: ['fromAgentId', 'toAgentId', 'status'],
  },
  [TEAM_EVENT_TYPES.SESSION_CREATED]: {
    requiredPayload: ['sessionId'],
    recommendedPayload: ['userId', 'channel'],
  },
  [TEAM_EVENT_TYPES.SESSION_UPDATED]: {
    requiredPayload: ['sessionId'],
    recommendedPayload: ['patch', 'channel'],
  },
  [TEAM_EVENT_TYPES.SESSION_LINKED]: {
    requiredPayload: ['canonicalSessionId', 'linkedSessionId'],
    recommendedPayload: ['userId', 'channel'],
  },
  [TEAM_EVENT_TYPES.SESSION_SWITCHED]: {
    requiredPayload: ['fromSessionId', 'toSessionId'],
    recommendedPayload: ['userId', 'reason'],
  },
  [TEAM_EVENT_TYPES.SESSION_MIGRATED]: {
    requiredPayload: ['fromSessionId', 'toSessionId'],
    recommendedPayload: ['fromChannel', 'toChannel', 'userId'],
  },
  [TEAM_EVENT_TYPES.EVENT_REPLAYED]: {
    requiredPayload: ['replayedEventId'],
    recommendedPayload: ['source', 'reason'],
  },
});

export function isKnownEventType(type = '') {
  return EVENT_TYPE_SET.has(String(type || '').trim());
}

export function createEventId(prefix = 'evt') {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}:${Date.now()}:${rand}`;
}

export function createSessionId(prefix = 'sess') {
  return createEventId(prefix);
}

export function createCorrelationId(prefix = 'corr') {
  return createEventId(prefix);
}

export function validateEventShape(event = {}) {
  const issues = [];
  const type = String(event?.type || '').trim();
  const payload = event?.payload;

  if (!type) issues.push('event.type_required');
  if (!event?.id) issues.push('event.id_required');
  if (!Number.isFinite(Number(event?.ts))) issues.push('event.ts_required');
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
    issues.push('event.payload_object_required');
  }

  const schema = EVENT_TYPE_SCHEMAS[type];
  if (schema && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    for (const key of schema.requiredPayload || []) {
      if (!(key in payload)) issues.push(`payload.${key}_required`);
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function createEventEnvelope(input = {}) {
  const now = Date.now();
  const type = String(input?.type || '').trim();
  const envelope = {
    id: String(input?.id || createEventId()),
    type,
    ts: Number(input?.ts || now),
    source: String(input?.source || 'team-runtime'),
    version: String(input?.version || EVENT_SCHEMA_VERSION),
    priority: String(input?.priority || EVENT_PRIORITIES.NORMAL),
    visibility: String(input?.visibility || EVENT_VISIBILITY.INTERNAL),
    teamId: String(input?.teamId || ''),
    sessionId: String(input?.sessionId || ''),
    userId: String(input?.userId || ''),
    correlationId: String(input?.correlationId || ''),
    causationId: String(input?.causationId || ''),
    routeKey: String(input?.routeKey || type),
    replay: !!input?.replay,
    important: !!input?.important,
    tags: Array.isArray(input?.tags) ? input.tags.filter(Boolean).map((v) => String(v)) : [],
    payload: (input?.payload && typeof input.payload === 'object' && !Array.isArray(input.payload)) ? { ...input.payload } : {},
    meta: (input?.meta && typeof input.meta === 'object' && !Array.isArray(input.meta)) ? { ...input.meta } : {},
  };

  return envelope;
}

export function createHandlerMatcher(typeOrPattern) {
  if (typeof typeOrPattern === 'function') return typeOrPattern;
  const raw = String(typeOrPattern || '').trim();
  if (!raw || raw === '*') return () => true;
  if (!raw.includes('*')) return (event) => String(event?.type || '') === raw;
  const escaped = raw
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  const re = new RegExp(`^${escaped}$`);
  return (event) => re.test(String(event?.type || ''));
}

export function getEventTypeSchema(type = '') {
  return EVENT_TYPE_SCHEMAS[String(type || '').trim()] || null;
}

export function listEventTypes() {
  return [...EVENT_TYPE_LIST];
}

export default {
  TEAM_EVENT_TYPES,
  EVENT_PRIORITIES,
  EVENT_VISIBILITY,
  EVENT_SCHEMA_VERSION,
  EVENT_TYPE_SCHEMAS,
  EVENT_TYPE_SET,
  isKnownEventType,
  createEventId,
  createSessionId,
  createCorrelationId,
  validateEventShape,
  createEventEnvelope,
  createHandlerMatcher,
  getEventTypeSchema,
  listEventTypes,
};
