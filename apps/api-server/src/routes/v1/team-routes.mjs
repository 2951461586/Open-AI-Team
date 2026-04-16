import { Hono } from 'hono';
import { requireOrchAuth, requireDashboardAuth } from '../../middleware/auth.mjs';
import { buildEnvelope, buildErrorEnvelope } from '../../middleware/response.mjs';
import { dispatchDashboardChat } from '../team-route-dispatch-v2.mjs';

export function createTeamRoutes(ctx = {}) {
  const app = new Hono();
  const { teamStore, tlRuntime, nativeChat, sendJson, handleJsonBody } = ctx;

  app.post('/chat', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const out = await dispatchDashboardChat(body, { teamStore, tlRuntime, nativeChat });
    if (!out?.ok) console.error('[api/v1/team/chat] error:', out?.error);
    return c.json(out);
  });

  app.post('/chat/task', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const taskId = String(body?.taskId || '').trim();
    const text = String(body?.text || '').trim();
    if (!taskId) return c.json({ ok: false, error: 'taskId_required' }, 400);
    if (!text) return c.json({ ok: false, error: 'text_required' }, 400);

    if (!tlRuntime?.handleTaskChat) {
      return c.json({ ok: false, error: 'task_chat_not_available' }, 500);
    }

    const result = await tlRuntime.handleTaskChat({
      taskId,
      text,
      target: String(body?.target || '').trim() || undefined,
      intent: String(body?.intent || '').trim() || undefined,
      targetRole: String(body?.targetRole || '').trim() || undefined,
      assignmentId: String(body?.assignmentId || '').trim() || undefined,
      childTaskId: String(body?.childTaskId || '').trim() || undefined,
    });
    return c.json(result);
  });

  app.post('/tasks/:taskId/control', async (c) => {
    const unauthorized = requireDashboardAuth(c);
    if (unauthorized) return unauthorized;

    const taskId = c.req.param('taskId');
    const body = await c.req.json().catch(() => ({}));
    const action = String(body?.action || '').trim();
    const reason = String(body?.reason || body?.comment || '').trim();

    if (!action) return c.json({ ok: false, error: 'action_required' }, 400);

    const validActions = ['approve', 'reject', 'rerun_review', 'rerun_judge', 'reset_to_planning', 'manual_done', 'manual_block', 'manual_cancel'];
    if (!validActions.includes(action)) {
      return c.json({ ok: false, error: 'invalid_action' }, 400);
    }

    return c.json({ ok: true, taskId, action, reason, message: `${action} action received` });
  });

  app.get('/tasks/:taskId/files', async (c) => {
    const taskId = c.req.param('taskId');
    const task = teamStore?.getTaskById?.(taskId);
    if (!task) return c.json({ ok: false, error: 'task_not_found' }, 404);

    const { readdirSync, statSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const taskWorkspaceRoot = String(process.env.TEAM_TASK_WORKSPACE_ROOT || resolve(process.cwd(), 'task_workspaces'));
    const wsDir = resolve(taskWorkspaceRoot, taskId.replace(/[^a-zA-Z0-9_:-]/g, '_'));

    try {
      const files = readdirSync(wsDir).map(name => {
        try {
          const st = statSync(`${wsDir}/${name}`);
          return { name, size: st.size, mtime: st.mtimeMs };
        } catch { return { name }; }
      });
      return c.json({ ok: true, taskId, workspace: wsDir, files });
    } catch {
      return c.json({ ok: true, taskId, workspace: wsDir, files: [] });
    }
  });

  app.get('/config/roles', async (c) => {
    const { loadTeamRolesConfig, getTeamRolesConfigStatus } = await import('@ai-team/team-runtime');
    const config = loadTeamRolesConfig();
    const status = getTeamRolesConfigStatus();
    return c.json(buildEnvelope({
      route: 'config/roles',
      resourceKind: 'team_config',
      payload: {
        ok: true,
        config: {
          version: config.version,
          defaults: config.defaults,
          routing: config.routing,
          nodeMap: config.nodeMap,
          roles: config.roles,
        },
        configStatus: status,
      },
    }));
  });

  app.post('/config/roles/reload', async (c) => {
    const unauthorized = requireOrchAuth(c);
    if (unauthorized) return unauthorized;

    const { reloadTeamRolesConfig } = await import('@ai-team/team-runtime');
    reloadTeamRolesConfig();
    return c.json({ ok: true, message: 'roles config reloaded' });
  });

  return app;
}
