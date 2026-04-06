import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { openTeamStore } from '../team/team-store.mjs';
import { loadTeamRolesConfig } from '../team/team-roles-config.mjs';
import { loadJson, saveJson, ensureDir } from '../tools/tool-common.mjs';
import { createSandboxCore } from '../agent-harness-core/sandbox-core.mjs';
import { createCommandRuntime } from '../agent-harness-core/command-runtime.mjs';
import { createLocalToolRuntime } from '../agent-harness-core/tool-runtime.mjs';
import { createCalendarProvider } from '../tools/tool-calendar.mjs';
import { createEmailProvider } from '../tools/tool-email.mjs';

function nowIso() { return new Date().toISOString(); }
function nowMs() { return Date.now(); }
function asArray(v) { return Array.isArray(v) ? v : []; }
function asObject(v, fb = {}) { return v && typeof v === 'object' && !Array.isArray(v) ? v : fb; }
function normalizeText(v = '') { return String(v || '').trim(); }
function makeId(prefix = 'id') { return `${prefix}:${randomUUID()}`; }

function mapToolToMcp(def = {}) {
  return {
    name: String(def.id || def.name || ''),
    title: String(def.title || def.summary || def.id || ''),
    description: String(def.description || def.summary || def.title || ''),
    inputSchema: def.inputSchema || { type: 'object', additionalProperties: true },
  };
}

async function createBaseRuntime({ rootDir, toolsConfigPath, outputDir }) {
  const sandbox = createSandboxCore({ workspaceDir: rootDir });
  const commandRuntime = createCommandRuntime({ workspaceDir: rootDir, policy: {} });
  const providers = [
    ...(await createCalendarProvider({ rootDir, configPath: toolsConfigPath })),
    ...(await createEmailProvider({ rootDir, configPath: toolsConfigPath })),
  ];
  return createLocalToolRuntime({ sandbox, commandRuntime, outputDir, providers });
}

function buildTaskTools({ teamStore }) {
  return [
    {
      id: 'team.task.list',
      title: 'List team tasks',
      description: 'List recent tasks or tasks for a team.',
      inputSchema: { type: 'object', properties: { teamId: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 200 } }, additionalProperties: false },
      outputSchema: { type: 'object', properties: { items: { type: 'array' }, count: { type: 'integer' } }, required: ['items', 'count'], additionalProperties: true },
      async execute({ args }) {
        const items = args.teamId ? teamStore.listTasksByTeam(args.teamId) : teamStore.listRecentTasks(Number(args.limit || 50));
        const sliced = items.slice(0, Number(args.limit || 50));
        return { items: sliced, count: sliced.length };
      },
    },
    {
      id: 'team.task.get',
      title: 'Get task',
      description: 'Get a task plus related plan/review/decision/artifact summary.',
      inputSchema: { type: 'object', properties: { taskId: { type: 'string' } }, required: ['taskId'], additionalProperties: false },
      outputSchema: { type: 'object', properties: { task: {}, plan: {}, reviews: { type: 'array' }, decisions: { type: 'array' }, artifacts: { type: 'array' }, blackboard: { type: 'array' } }, required: ['task', 'reviews', 'decisions', 'artifacts', 'blackboard'], additionalProperties: true },
      async execute({ args }) {
        return {
          task: teamStore.getTaskById(args.taskId),
          plan: teamStore.getLatestPlanByTask(args.taskId),
          reviews: teamStore.listReviewsByTask(args.taskId),
          decisions: teamStore.listDecisionsByTask(args.taskId),
          artifacts: teamStore.listArtifactsByTask({ taskId: args.taskId, limit: 200 }),
          blackboard: teamStore.listBlackboardEntries({ taskId: args.taskId, limit: 200 }),
        };
      },
    },
    {
      id: 'team.task.create',
      title: 'Create task',
      description: 'Create a new task in the team store.',
      inputSchema: { type: 'object', properties: { teamId: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, priority: { type: 'integer' }, state: { type: 'string' }, metadata: { type: 'object' } }, required: ['teamId', 'title'], additionalProperties: false },
      outputSchema: { type: 'object', properties: { task: { type: 'object' } }, required: ['task'], additionalProperties: true },
      async execute({ args }) {
        const task = teamStore.createTask({ taskId: makeId('task'), teamId: args.teamId, title: args.title, description: args.description || '', priority: Number(args.priority || 0), state: args.state || 'pending', metadata: asObject(args.metadata, {}) });
        return { task };
      },
    },
    {
      id: 'team.task.update_state',
      title: 'Update task state',
      description: 'Update task state and optional owner.',
      inputSchema: { type: 'object', properties: { taskId: { type: 'string' }, state: { type: 'string' }, ownerMemberId: { type: 'string' } }, required: ['taskId', 'state'], additionalProperties: false },
      outputSchema: { type: 'object', properties: { task: { type: 'object' } }, required: ['task'], additionalProperties: true },
      async execute({ args }) { return { task: teamStore.updateTaskState(args) }; },
    },
  ];
}

function buildAgentTools({ teamStore, rolesConfig }) {
  return [
    {
      id: 'team.agent.roles',
      title: 'List roles',
      description: 'List declared team roles and deployments.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      outputSchema: { type: 'object', properties: { roles: { type: 'array' }, count: { type: 'integer' } }, required: ['roles', 'count'], additionalProperties: true },
      async execute() {
        const roles = Object.values(rolesConfig.roles || {});
        return { roles, count: roles.length };
      },
    },
    {
      id: 'team.agent.members',
      title: 'List members',
      description: 'List team members by team id.',
      inputSchema: { type: 'object', properties: { teamId: { type: 'string' } }, required: ['teamId'], additionalProperties: false },
      outputSchema: { type: 'object', properties: { members: { type: 'array' }, count: { type: 'integer' } }, required: ['members', 'count'], additionalProperties: true },
      async execute({ args }) {
        const members = teamStore.listMembersByTeam(args.teamId);
        return { members, count: members.length };
      },
    },
    {
      id: 'team.agent.add_member',
      title: 'Add team member',
      description: 'Register a member in a team.',
      inputSchema: { type: 'object', properties: { teamId: { type: 'string' }, role: { type: 'string' }, agentRef: { type: 'string' }, capabilities: { type: 'array' }, status: { type: 'string' }, metadata: { type: 'object' } }, required: ['teamId', 'role'], additionalProperties: false },
      outputSchema: { type: 'object', properties: { member: { type: 'object' } }, required: ['member'], additionalProperties: true },
      async execute({ args }) {
        const member = teamStore.createMember({ memberId: makeId('member'), teamId: args.teamId, role: args.role, agentRef: args.agentRef || args.role, capabilities: asArray(args.capabilities), status: args.status || 'idle', metadata: asObject(args.metadata, {}) });
        return { member };
      },
    },
  ];
}

function buildCollabTools({ teamStore }) {
  return [
    {
      id: 'team.mailbox.list',
      title: 'List mailbox',
      description: 'List team mailbox messages.',
      inputSchema: { type: 'object', properties: { teamId: { type: 'string' }, limit: { type: 'integer' } }, required: ['teamId'], additionalProperties: false },
      outputSchema: { type: 'object', properties: { items: { type: 'array' }, count: { type: 'integer' } }, required: ['items', 'count'], additionalProperties: true },
      async execute({ args }) {
        const items = teamStore.listMailboxMessages({ teamId: args.teamId, limit: Number(args.limit || 100) });
        return { items, count: items.length };
      },
    },
    {
      id: 'team.mailbox.append',
      title: 'Append mailbox message',
      description: 'Append a mailbox message for a team.',
      inputSchema: { type: 'object', properties: { teamId: { type: 'string' }, taskId: { type: 'string' }, threadId: { type: 'string' }, kind: { type: 'string' }, fromMemberId: { type: 'string' }, toMemberId: { type: 'string' }, broadcast: { type: 'boolean' }, payload: { type: 'object' } }, required: ['teamId', 'kind', 'fromMemberId'], additionalProperties: false },
      outputSchema: { type: 'object', properties: { message: { type: 'object' } }, required: ['message'], additionalProperties: true },
      async execute({ args }) {
        const message = teamStore.appendMailboxMessage({ messageId: makeId('mailbox'), ...args, payload: asObject(args.payload, {}), status: 'queued' });
        return { message };
      },
    },
  ];
}

export async function createMcpToolRegistry({ rootDir = process.cwd(), config = {} } = {}) {
  const toolsConfigPath = path.resolve(rootDir, 'config/team/tools.json');
  const outputDir = path.resolve(rootDir, 'tmp/mcp');
  await ensureDir(outputDir);
  const teamDbPath = path.resolve(rootDir, config.teamDbPath || 'data/team.db');
  const teamStore = openTeamStore(teamDbPath);
  const rolesConfig = loadTeamRolesConfig(path.resolve(rootDir, 'config/team/roles.json'));
  const baseRuntime = await createBaseRuntime({ rootDir, toolsConfigPath, outputDir });
  const extraTools = [
    ...buildTaskTools({ teamStore }),
    ...buildAgentTools({ teamStore, rolesConfig }),
    ...buildCollabTools({ teamStore }),
  ];
  for (const tool of extraTools) baseRuntime.registerTool(tool);

  const remoteTools = new Map();
  const remoteClients = new Map();

  function hasLocalTool(name = '') {
    return !!baseRuntime.resolveTool(String(name || '').trim());
  }

  async function formatLocalCall(name, args = {}, context = {}) {
    const result = await baseRuntime.callTool(name, args, context);
    if (!result?.ok) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ ok: false, tool: name, error: result?.result || result }, null, 2) }],
        structuredContent: { ok: false, tool: name, error: result?.result || result },
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result.result, null, 2) }],
      structuredContent: result.result,
    };
  }

  async function formatRemoteCall(name, args = {}, context = {}) {
    const remote = remoteTools.get(String(name || '').trim());
    if (!remote?.client) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ ok: false, tool: name, error: 'remote_tool_not_found' }, null, 2) }],
        structuredContent: { ok: false, tool: name, error: 'remote_tool_not_found' },
      };
    }
    try {
      const result = await remote.client.callRemoteTool(name, args, context);
      return {
        content: [{ type: 'text', text: JSON.stringify(result?.structuredContent ?? result, null, 2) }],
        structuredContent: result?.structuredContent ?? result,
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ ok: false, tool: name, error: String(error?.message || error) }, null, 2) }],
        structuredContent: { ok: false, tool: name, error: String(error?.message || error) },
      };
    }
  }

  return {
    rootDir,
    teamStore,
    rolesConfig,
    runtime: baseRuntime,
    registerRemoteTool(tool = {}, client = null) {
      const normalized = mapToolToMcp({
        id: tool.name,
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
      });
      normalized.source = { ...(tool.source || {}), type: 'remote-mcp' };
      normalized.remoteName = String(tool.remoteName || tool.name || '').trim();
      remoteTools.set(normalized.name, { tool: normalized, client, source: normalized.source });
      if (client?.state?.name) remoteClients.set(client.state.name, client);
      return normalized;
    },
    listTools() {
      const locals = baseRuntime.listTools({ includePrivate: false }).map(mapToolToMcp);
      const remotes = [...remoteTools.values()].map((entry) => ({ ...entry.tool }));
      return [...locals, ...remotes];
    },
    hasTool(name = '') { return hasLocalTool(name) || remoteTools.has(String(name || '').trim()); },
    async callTool(name, args = {}, context = {}) {
      if (hasLocalTool(name)) return formatLocalCall(name, args, context);
      if (remoteTools.has(String(name || '').trim())) return formatRemoteCall(name, args, context);
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ ok: false, tool: name, error: 'tool_not_supported' }, null, 2) }],
        structuredContent: { ok: false, tool: name, error: 'tool_not_supported' },
      };
    },
    describe() {
      return {
        generatedAt: nowIso(),
        toolCount: this.listTools().length,
        localToolCount: baseRuntime.listTools({ includePrivate: false }).length,
        remoteToolCount: remoteTools.size,
        remoteClients: [...remoteClients.keys()],
        sources: ['tool-runtime', 'team-store', 'calendar-provider', 'email-provider', 'remote-mcp'],
      };
    },
  };
}
