export const API_CONFIG = {
  V1_PREFIX: '/api/v1',
  TEAM_PREFIX: '/api/v1/team',
  STATE_PREFIX: '/api/v1/state',
  INTERNAL_PREFIX: '/api/v1/internal',

  endpoints: {
    chat: {
      create: 'POST /api/v1/team/chat',
      task: 'POST /api/v1/team/chat/task',
    },
    tasks: {
      control: 'POST /api/v1/team/tasks/:taskId/control',
      files: 'GET /api/v1/team/tasks/:taskId/files',
    },
    state: {
      team: 'GET /api/v1/state/team',
      dashboard: 'GET /api/v1/state/team/dashboard',
      nodes: 'GET /api/v1/state/team/nodes',
      agents: 'GET /api/v1/state/team/agents',
      summary: 'GET /api/v1/state/team/summary',
      workbench: 'GET /api/v1/state/team/workbench',
      pipeline: 'GET /api/v1/state/team/pipeline',
      control: 'GET /api/v1/state/team/control',
      artifacts: 'GET /api/v1/state/team/artifacts',
      evidence: 'GET /api/v1/state/team/evidence',
      threads: 'GET /api/v1/state/team/threads',
      mailbox: 'GET /api/v1/state/team/mailbox',
      archive: 'GET /api/v1/state/team/archive',
      residents: 'GET /api/v1/state/team/residents',
      blackboard: 'GET /api/v1/state/team/blackboard',
      inbox: 'GET /api/v1/state/team/inbox',
      contracts: 'GET /api/v1/state/team/contracts',
    },
    config: {
      roles: 'GET /api/v1/team/config/roles',
      reloadRoles: 'POST /api/v1/team/config/roles/reload',
    },
  },

  legacyMapping: {
    '/api/chat/create': '/api/v1/team/chat',
    '/api/chat/task': '/api/v1/team/chat/task',
    '/api/dashboard/control': '/api/v1/team/tasks/:taskId/control',
    '/api/task/:taskId/files': '/api/v1/team/tasks/:taskId/files',
    '/api/config/roles': '/api/v1/team/config/roles',
    '/api/config/roles/reload': '/api/v1/team/config/roles/reload',
    '/state/team': '/api/v1/state/team',
    '/state/team/dashboard': '/api/v1/state/team/dashboard',
    '/state/team/nodes': '/api/v1/state/team/nodes',
    '/state/team/agents': '/api/v1/state/team/agents',
    '/state/team/summary': '/api/v1/state/team/summary',
    '/state/team/workbench': '/api/v1/state/team/workbench',
    '/state/team/pipeline': '/api/v1/state/team/pipeline',
    '/state/team/control': '/api/v1/state/team/control',
    '/state/team/artifacts': '/api/v1/state/team/artifacts',
    '/state/team/evidence': '/api/v1/state/team/evidence',
    '/state/team/threads': '/api/v1/state/team/threads',
    '/state/team/mailbox': '/api/v1/state/team/mailbox',
    '/state/team/archive': '/api/v1/state/team/archive',
    '/state/team/residents': '/api/v1/state/team/residents',
    '/state/team/blackboard': '/api/v1/state/team/blackboard',
    '/state/team/inbox': '/api/v1/state/team/inbox',
    '/state/team/contracts': '/api/v1/state/team/contracts',
  },
};

export function buildApiUrl(baseUrl, endpoint, params = {}) {
  let url = `${baseUrl}${endpoint}`;
  for (const [key, value] of Object.entries(params)) {
    url = url.replace(`:${key}`, encodeURIComponent(value));
  }
  return url;
}

export function createApiClient(baseUrl) {
  const api = {
    baseUrl,

    async request(method, endpoint, data = null, params = {}) {
      const url = buildApiUrl(baseUrl, endpoint, params);
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (data) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);
      return response.json();
    },

    chat: {
      create: (data) => api.request('POST', '/api/v1/team/chat', data),
      task: (data) => api.request('POST', '/api/v1/team/chat/task', data),
    },

    tasks: {
      control: (taskId, data) => api.request('POST', '/api/v1/team/tasks/:taskId/control', data, { taskId }),
      files: (taskId) => api.request('GET', '/api/v1/team/tasks/:taskId/files', null, { taskId }),
    },

    state: {
      team: (query = {}) => api.request('GET', '/api/v1/state/team', null, query),
      dashboard: () => api.request('GET', '/api/v1/state/team/dashboard'),
      nodes: () => api.request('GET', '/api/v1/state/team/nodes'),
      agents: (query = {}) => api.request('GET', '/api/v1/state/team/agents', null, query),
      summary: (taskId) => api.request('GET', '/api/v1/state/team/summary', null, { taskId }),
      workbench: (taskId) => api.request('GET', '/api/v1/state/team/workbench', null, { taskId }),
      pipeline: (taskId) => api.request('GET', '/api/v1/state/team/pipeline', null, { taskId }),
      control: (taskId) => api.request('GET', '/api/v1/state/team/control', null, { taskId }),
      artifacts: (taskId, query = {}) => api.request('GET', '/api/v1/state/team/artifacts', null, { taskId, ...query }),
      evidence: (taskId, query = {}) => api.request('GET', '/api/v1/state/team/evidence', null, { taskId, ...query }),
      threads: (query = {}) => api.request('GET', '/api/v1/state/team/threads', null, query),
      mailbox: (query = {}) => api.request('GET', '/api/v1/state/team/mailbox', null, query),
      archive: (query = {}) => api.request('GET', '/api/v1/state/team/archive', null, query),
      residents: (query = {}) => api.request('GET', '/api/v1/state/team/residents', null, query),
      blackboard: (query = {}) => api.request('GET', '/api/v1/state/team/blackboard', null, query),
      inbox: (query = {}) => api.request('GET', '/api/v1/state/team/inbox', null, query),
      contracts: () => api.request('GET', '/api/v1/state/team/contracts'),
    },

    config: {
      roles: () => api.request('GET', '/api/v1/team/config/roles'),
      reloadRoles: () => api.request('POST', '/api/v1/team/config/roles/reload'),
    },
  };

  return api;
}

export default { API_CONFIG, buildApiUrl, createApiClient };
