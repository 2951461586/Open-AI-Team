/**
 * team-route-dispatch-v2.mjs — TL-driven dispatch
 *
 * Routing rules:
 *   All messages → TL runtime (TL decides: direct reply vs delegate to members)
 *   /task command → extract task text → TL
 *   Other commands (/help, /tasks, /status) → dispatcher handles directly
 *
 * Key invariant: nativeChat is a retired stub; TL is the sole reply authority.
 */

import path from 'node:path';
import { createTaskDispatcher } from '../team/team-task-dispatcher.mjs';

export async function dispatchDashboardChat(body = {}, ctx = {}) {
  const text = String(body?.text || '').trim();
  const scope = String(body?.scope || body?.scopeKey || 'dashboard').trim();
  const history = Array.isArray(body?.history) ? body.history : [];
  const metadata = (body?.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)) ? body.metadata : {};
  const onChunk = typeof body?.onChunk === 'function' ? body.onChunk : null;

  if (!text) return { ok: false, error: 'text_required' };

  const { teamStore, tlRuntime, nativeChat } = ctx;

  // Step 1: Classify ONLY (no execution yet)
  const dispatcher = createTaskDispatcher({ teamStore, tlRuntime, nativeChat });
  const classification = dispatcher.classifyMessage({ text, metadata: { ...metadata, strictTaskMode: true } });

  // ─── /task command → extract task text → TL ───────────────────
  if (classification.action === 'command') {
    const cmdName = String(classification.command?.name || '').toLowerCase();

    if (cmdName === 'task' && tlRuntime) {
      // /task <description> — route directly to TL, skip dispatcher entirely
      const taskText = String(classification.command?.args || '').trim();
      if (!taskText) {
        return {
          ok: true, action: 'command',
          replySource: 'dispatcher',
          summary: '用法：/task 你的任务描述（例如：/task 修复 WebSocket 连接）',
        };
      }
      return await dispatchToTL({ text: taskText, scope, history, metadata, onChunk, tlRuntime });
    }

    // Non-task commands (/help, /tasks, /status) — let dispatcher handle
    // Use handleMessage but it won't hit task execution because it's not /task
    const cmdResult = await dispatcher.handleMessage({
      text, scopeKey: scope,
      metadata: { ...metadata, strictTaskMode: true, history },
      ...(onChunk ? { onChunk } : {}),
    });

    return {
      ok: true,
      action: cmdResult?.action || 'command',
      classification: cmdResult?.classification || classification,
      replySource: 'dispatcher',
      summary: cmdResult?.response || '（空回复）',
    };
  }

  // ─── Explicit task (classifier high confidence) → TL ──────────
  if (classification.action === 'task' && classification.isTask && tlRuntime) {
    return await dispatchToTL({ text, scope, history, metadata, onChunk, tlRuntime, classification });
  }

  // ─── confirm_task (looks like work but classifier unsure) → TL ──
  // In TL-driven architecture, let TL decide instead of falling back to nativeChat.
  // TL can either create a task or reply directly — it's the right authority.
  if (classification.action === 'confirm_task' && tlRuntime) {
    return await dispatchToTL({ text, scope, history, metadata, onChunk, tlRuntime, classification });
  }

  // ─── TL handles everything when available ──────────────────────
  // Post pipeline-retirement, nativeChat is a stub. All messages — including
  // greetings and simple chat — route through TL. TL's system prompt already
  // instructs it to reply directly for simple queries.
  if (tlRuntime) {
    return await dispatchToTL({ text, scope, history, metadata, onChunk, tlRuntime, classification });
  }

  // ─── No TL available: fallback to dispatcher ──────────────────
  const chatResult = await dispatcher.handleMessage({
    text, scopeKey: scope,
    metadata: {
      source: 'dashboard_chat', surface: 'dashboard', channel: 'dashboard',
      strictTaskMode: true, history,
      ...metadata,
    },
    ...(onChunk ? { onChunk } : {}),
  });

  if (!chatResult?.ok) {
    return { ok: false, error: String(chatResult?.error || 'chat_dispatch_failed') };
  }

  return {
    ok: true,
    action: chatResult.action || 'chat',
    classification: chatResult.classification || classification,
    replySource: String(chatResult?.source || 'fallback'),
    summary: chatResult?.response || '（空回复）',
  };
}

/**
 * Route an explicit task to the TL-driven runtime.
 */
async function dispatchToTL({ text, scope, history, metadata, onChunk, tlRuntime, classification } = {}) {
  try {
    const result = await tlRuntime.handleTeamRun(
      { text, scopeKey: scope, history, ...metadata },
      { onChunk }
    );

    if (!result?.ok) {
      return { ok: false, error: String(result?.error || 'tl_runtime_failed') };
    }

    if (result.action === 'tl_direct') {
      return {
        ok: true,
        action: 'chat',
        classification: classification || { action: 'chat', reason: 'tl_direct' },
        replySource: 'tl_direct',
        summary: result.reply || '',
      };
    }

    return {
      ok: true,
      action: 'task',
      classification: classification || { action: 'task', reason: 'tl_delegate' },
      replySource: 'tl_delegate',
      taskId: result.task?.taskId || '',
      teamId: result.team?.teamId || '',
      task: result.task || null,
      summary: result.reply || '',
      memberResults: result.memberResults || [],
    };
  } catch (err) {
    console.error('[tl_dispatch] error:', err?.message || err);
    return { ok: false, error: String(err?.message || err || 'tl_dispatch_failed') };
  }
}

export function tryHandleTeamDispatchRoute(req, res, ctx = {}) {
  const {
    isOrchAuthorized,
    sendJson,
    handleJsonBody,
    teamStore,
    tlRuntime,
    nativeChat,
  } = ctx;

  if (req.method === 'POST' && req.url === '/internal/team/dispatch') {
    if (!isOrchAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return true;
    }
    handleJsonBody(req, res, async (body) => {
      const text = String(body?.text || '').trim();
      const scopeKey = String(body?.scopeKey || body?.scope || '').trim();
      if (!text) return { ok: false, error: 'text_required' };
      if (!scopeKey) return { ok: false, error: 'scope_key_required' };
      const dispatcher = createTaskDispatcher({ teamStore, tlRuntime, nativeChat });
      return dispatcher.handleMessage({ text, scopeKey, metadata: body?.metadata || {} });
    });
    return true;
  }

  if (req.method === 'POST' && req.url === '/internal/team/dispatch/classify') {
    handleJsonBody(req, res, async (body) => {
      const text = String(body?.text || '').trim();
      const dispatcher = createTaskDispatcher({ teamStore });
      const classification = dispatcher.classifyMessage({ text, metadata: body?.metadata || {} });
      return { ok: true, classification };
    });
    return true;
  }

  if (req.method === 'POST' && req.url === '/api/chat/create') {
    handleJsonBody(req, res, async (body) => {
      const out = await dispatchDashboardChat(body, { teamStore, tlRuntime, nativeChat });
      if (!out?.ok) console.error('[api/chat/create] error:', out?.error);
      return out;
    });
    return true;
  }

  // ── P2: Task-scoped chat via bound agent session ──────────────
  if (req.method === 'POST' && req.url === '/api/chat/task') {
    handleJsonBody(req, res, async (body) => {
      const taskId = String(body?.taskId || '').trim();
      const text = String(body?.text || '').trim();
      if (!taskId) return { ok: false, error: 'taskId_required' };
      if (!text) return { ok: false, error: 'text_required' };

      if (!tlRuntime?.handleTaskChat) {
        return { ok: false, error: 'task_chat_not_available' };
      }

      // P6: Support structured task-chat contract
      const target = String(body?.target || '').trim() || undefined;
      const intent = String(body?.intent || '').trim() || undefined;
      const targetRole = String(body?.targetRole || '').trim() || undefined;
      const assignmentId = String(body?.assignmentId || '').trim() || undefined;
      const childTaskId = String(body?.childTaskId || '').trim() || undefined;
      const result = await tlRuntime.handleTaskChat({
        taskId,
        text,
        target,
        intent,
        targetRole,
        assignmentId,
        childTaskId,
      });
      return result;
    });
    return true;
  }

  // ── Task workspace file listing ───────────────────────────────
  const taskFilesMatch = req.method === 'GET' && req.url?.match(/^\/api\/task\/([^/]+)\/files/);
  if (taskFilesMatch) {
    const taskId = decodeURIComponent(taskFilesMatch[1]);
    const task = teamStore?.getTaskById?.(taskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: 'task_not_found' });
      return true;
    }
    const taskWorkspaceRoot = String(process.env.TEAM_TASK_WORKSPACE_ROOT || path.resolve(process.cwd(), 'task_workspaces'));
    const wsDir = path.resolve(taskWorkspaceRoot, taskId.replace(/[^a-zA-Z0-9_:-]/g, '_'));
    import('node:fs').then(({ readdirSync, statSync }) => {
      try {
        const files = readdirSync(wsDir).map(name => {
          try {
            const st = statSync(`${wsDir}/${name}`);
            return { name, size: st.size, mtime: st.mtimeMs };
          } catch { return { name }; }
        });
        sendJson(res, 200, { ok: true, taskId, workspace: wsDir, files });
      } catch {
        sendJson(res, 200, { ok: true, taskId, workspace: wsDir, files: [] });
      }
    }).catch(() => {
      sendJson(res, 200, { ok: true, taskId, workspace: wsDir, files: [] });
    });
    return true;
  }

  return false;
}
