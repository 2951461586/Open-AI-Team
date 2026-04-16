import { Hono } from 'hono';
import { requireDashboardAuth } from '../../middleware/auth.mjs';
import { buildEnvelope } from '../../middleware/response.mjs';

export function createStateRoutes(ctx = {}) {
  const app = new Hono();
  const { teamStore, sendJson } = ctx;

  app.get('/team', async (c) => {
    const view = String(c.req.query('view') || 'active').toLowerCase();
    const activeOnlyParam = String(c.req.query('activeOnly') || '').toLowerCase();
    const activeOnly = activeOnlyParam === '' ? view !== 'all' : activeOnlyParam !== 'false';
    const limit = Number(c.req.query('limit') || 20);

    const tasks = teamStore.listRecentTasks ? teamStore.listRecentTasks(Math.max(limit, 20)) : [];
    const filteredTasks = tasks.filter((task) => {
      const state = String(task?.state || '').toLowerCase();
      if (!activeOnly) return true;
      return !['done', 'cancelled', 'archived'].includes(state);
    }).slice(0, limit);

    const items = filteredTasks.map((task) => ({
      taskId: String(task.taskId || ''),
      teamId: String(task.teamId || ''),
      title: String(task.title || ''),
      state: String(task.state || ''),
      updatedAt: task.updatedAt || null,
    }));

    return c.json(buildEnvelope({
      route: 'state/team',
      resourceKind: 'team_collection',
      payload: {
        ok: true,
        stats: teamStore.stats?.() || {},
        items,
      },
      query: { view, activeOnly, limit },
    }));
  });

  app.get('/team/dashboard', async (c) => {
    const unauthorized = requireDashboardAuth(c);
    if (unauthorized) return unauthorized;

    return c.json(buildEnvelope({
      route: 'state/team/dashboard',
      resourceKind: 'dashboard_data',
      payload: {
        ok: true,
        stats: teamStore.stats?.() || {},
      },
    }));
  });

  app.get('/team/nodes', async (c) => {
    return c.json(buildEnvelope({
      route: 'state/team/nodes',
      resourceKind: 'node_list',
      payload: { ok: true, nodes: [] },
    }));
  });

  app.get('/team/agents', async (c) => {
    const role = c.req.query('role');
    const node = c.req.query('node');
    const activeOnlyParam = String(c.req.query('activeOnly') || '').toLowerCase();
    const activeOnly = activeOnlyParam === '' ? true : activeOnlyParam !== 'false';

    return c.json(buildEnvelope({
      route: 'state/team/agents',
      resourceKind: 'agent_list',
      payload: {
        ok: true,
        agents: [],
        filters: { role, node, activeOnly },
      },
    }));
  });

  app.get('/team/summary', async (c) => {
    const taskId = c.req.query('taskId');
    if (!taskId) return c.json({ ok: false, error: 'taskId_required' }, 400);

    const task = teamStore?.getTaskById?.(taskId);
    if (!task) return c.json({ ok: false, error: 'task_not_found' }, 404);

    return c.json(buildEnvelope({
      route: 'state/team/summary',
      resourceKind: 'task_summary',
      payload: {
        ok: true,
        taskId,
        task,
      },
    }));
  });

  app.get('/team/workbench', async (c) => {
    const taskId = c.req.query('taskId');
    if (!taskId) return c.json({ ok: false, error: 'taskId_required' }, 400);

    return c.json(buildEnvelope({
      route: 'state/team/workbench',
      resourceKind: 'task_workbench',
      payload: { ok: true, taskId, artifacts: [] },
    }));
  });

  app.get('/team/pipeline', async (c) => {
    const taskId = c.req.query('taskId');
    return c.json(buildEnvelope({
      route: 'state/team/pipeline',
      resourceKind: 'task_pipeline',
      payload: { ok: true, taskId, stages: [] },
    }));
  });

  app.get('/team/control', async (c) => {
    const taskId = c.req.query('taskId');
    return c.json(buildEnvelope({
      route: 'state/team/control',
      resourceKind: 'task_control',
      payload: { ok: true, taskId, actions: [] },
    }));
  });

  app.get('/team/artifacts', async (c) => {
    const taskId = c.req.query('taskId');
    const limit = Number(c.req.query('limit') || 200);
    const items = teamStore.listArtifactsByTask ? teamStore.listArtifactsByTask({ taskId, limit }) : [];

    return c.json(buildEnvelope({
      route: 'state/team/artifacts',
      resourceKind: 'artifact_list',
      payload: { ok: true, taskId, items },
      query: { taskId, limit },
    }));
  });

  app.get('/team/evidence', async (c) => {
    const taskId = c.req.query('taskId');
    const limit = Number(c.req.query('limit') || 200);
    const items = teamStore.listEvidenceByTask ? teamStore.listEvidenceByTask({ taskId, limit }) : [];

    return c.json(buildEnvelope({
      route: 'state/team/evidence',
      resourceKind: 'evidence_list',
      payload: { ok: true, taskId, items },
      query: { taskId, limit },
    }));
  });

  app.get('/team/threads', async (c) => {
    const unauthorized = requireDashboardAuth(c);
    if (unauthorized) return unauthorized;

    const taskId = c.req.query('taskId');
    const limit = Number(c.req.query('limit') || 200);

    return c.json(buildEnvelope({
      route: 'state/team/threads',
      resourceKind: 'thread_list',
      payload: { ok: true, taskId, items: [] },
      query: { taskId, limit },
    }));
  });

  app.get('/team/mailbox', async (c) => {
    const unauthorized = requireDashboardAuth(c);
    if (unauthorized) return unauthorized;

    const teamId = c.req.query('teamId');
    const taskId = c.req.query('taskId');
    const limit = Number(c.req.query('limit') || 100);

    let items = teamStore.listMailboxMessages ? teamStore.listMailboxMessages({ teamId, limit }) : [];
    if (taskId) items = items.filter((item) => String(item.taskId || '') === String(taskId || ''));

    return c.json(buildEnvelope({
      route: 'state/team/mailbox',
      resourceKind: 'mailbox_list',
      payload: { ok: true, teamId, taskId, items },
      query: { teamId, taskId, limit },
    }));
  });

  app.get('/team/archive', async (c) => {
    const limit = Number(c.req.query('limit') || 20);
    return c.json(buildEnvelope({
      route: 'state/team/archive',
      resourceKind: 'archive_list',
      payload: { ok: true, items: [] },
      query: { limit },
    }));
  });

  app.get('/team/residents', async (c) => {
    const teamId = c.req.query('teamId');
    return c.json(buildEnvelope({
      route: 'state/team/residents',
      resourceKind: 'resident_registry',
      payload: { ok: true, teamId, residents: [] },
      query: { teamId },
    }));
  });

  app.get('/team/blackboard', async (c) => {
    const taskId = c.req.query('taskId');
    const limit = Number(c.req.query('limit') || 200);
    const items = teamStore.listBlackboardEntries ? teamStore.listBlackboardEntries({ taskId, limit }) : [];

    return c.json(buildEnvelope({
      route: 'state/team/blackboard',
      resourceKind: 'blackboard_list',
      payload: { ok: true, taskId, items },
      query: { taskId, limit },
    }));
  });

  app.get('/team/inbox', async (c) => {
    const teamId = c.req.query('teamId');
    const memberId = c.req.query('memberId');
    const taskId = c.req.query('taskId');
    const limit = Number(c.req.query('limit') || 100);

    return c.json(buildEnvelope({
      route: 'state/team/inbox',
      resourceKind: 'member_inbox',
      payload: { ok: true, teamId, memberId, taskId, items: [] },
      query: { teamId, memberId, taskId, limit },
    }));
  });

  app.get('/team/contracts', async (c) => {
    const { TEAM_ROLE_CONTRACTS } = await import('@ai-team/team-runtime');
    return c.json(buildEnvelope({
      route: 'state/team/contracts',
      resourceKind: 'contract_catalog',
      payload: {
        ok: true,
        contracts: TEAM_ROLE_CONTRACTS || {},
      },
    }));
  });

  return app;
}
