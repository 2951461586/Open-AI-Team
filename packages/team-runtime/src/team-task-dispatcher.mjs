/**
 * team-task-dispatcher.mjs
 *
 * 任务分拣器：识别消息是「任务 / 普通聊天 / 命令 / 讨论」并在需要时创建 team task。
 *
 * 目标：让 Dashboard 的"对话"更像 QQ 群聊：
 * - 普通聊天：直接回复（不建任务）
 * - 任务指令：创建任务并推进 team-runtime
 * - 命令：/help /tasks /task /chat /discuss
 * - 讨论：不建任务，输出多视角建议，并提示如何转任务
 */

import { randomUUID } from 'node:crypto';

/**
 * @typedef {'chat'|'task'|'command'|'discuss'|'confirm_task'} DispatchAction
 */

const STATE_LABELS = {
  pending: '待接入',
  planning: '规划中',
  plan_review: '待审查',
  approved: '已批准',
  revision_requested: '待修订',
  done: '已完成',
  blocked: '阻塞',
  cancelled: '已取消',
};

function normalizeText(text = '') {
  return String(text || '').trim();
}

function safeInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function parseCommand(text = '') {
  const trimmed = normalizeText(text);
  if (!trimmed.startsWith('/')) return null;
  const body = trimmed.slice(1).trim();
  const [nameRaw, ...rest] = body.split(/\s+/g);
  const name = String(nameRaw || '').toLowerCase();
  const args = rest.join(' ').trim();
  if (!name) return null;
  return { name, args, raw: trimmed };
}

function isLikelyDiscuss(text = '') {
  const t = normalizeText(text);
  if (!t) return false;
  return /(讨论|辩论|评估|怎么选|对比|利弊|取舍|trade-?off|pros?\s*and\s*cons?|review一下|帮我看看哪个更好)/i.test(t);
}

function isLikelyStatusQuery(text = '') {
  const t = normalizeText(text);
  if (!t) return false;
  // 包含 UUID 或 task:xxx 格式的 ID + 状态查询关键词
  const hasTaskId = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(t)
    || /task[\s:：]*[0-9a-f-]{6,}/i.test(t);
  const hasStatusWord = /(查看|查一下|查[询看]|怎么样了|什么情况|进展|进度|状态|结果|执行情况|完成没|跑完没)/i.test(t);
  return hasTaskId && hasStatusWord;
}

/** 从文本中提取可能的 taskId 片段 */
function extractTaskIdFromText(text = '') {
  const t = normalizeText(text);
  // 优先匹配完整 UUID
  const uuidMatch = t.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuidMatch) return uuidMatch[0];
  // task: 前缀 + hex 片段
  const taskMatch = t.match(/task[\s:：]*([0-9a-f-]{6,})/i);
  if (taskMatch) return taskMatch[1];
  return '';
}

function isLikelyTaskByPrefix(text = '') {
  const t = normalizeText(text);
  return /^(任务\s*[:：]|task\s*[:：]|todo\s*[:：]|issue\s*[:：])/.test(t);
}

function stripTaskPrefix(text = '') {
  return normalizeText(text).replace(/^(任务\s*[:：]|task\s*[:：]|todo\s*[:：]|issue\s*[:：])\s*/i, '').trim();
}

/**
 * 判断消息类型。
 *
 * @param {object} params
 * @param {string} params.text
 * @param {object} params.metadata
 * @returns {{
 *   action: DispatchAction,
 *   isTask: boolean,
 *   confidence: number,
 *   reason: string,
 *   taskInfo?: { title: string, description: string, priority: number, taskMode: string },
 *   command?: { name: string, args: string, raw: string },
 * }}
 */
export function classifyMessage({ text = '', metadata = {} } = {}) {
  const trimmed = normalizeText(text);
  const strictTaskMode = !!metadata?.strictTaskMode;

  if (!trimmed) {
    return { action: 'chat', isTask: false, confidence: 1.0, reason: 'empty_message' };
  }

  // 0) 命令优先
  const cmd = parseCommand(trimmed);
  if (cmd) {
    return {
      action: 'command',
      isTask: false,
      confidence: 1.0,
      reason: 'command',
      command: cmd,
    };
  }

  // 1) 明确任务前缀优先
  if (isLikelyTaskByPrefix(trimmed)) {
    const body = stripTaskPrefix(trimmed);
    return {
      action: 'task',
      isTask: true,
      confidence: 0.95,
      reason: 'explicit_task_prefix',
      taskInfo: {
        title: extractTaskTitle(body),
        description: body,
        priority: inferPriority(body),
        taskMode: inferTaskMode(body),
      },
    };
  }

  // 2) 严格模式下：先识别讨论（避免把"评估/对比"当任务）
  if (strictTaskMode && isLikelyDiscuss(trimmed)) {
    return { action: 'discuss', isTask: false, confidence: 0.85, reason: 'strict_discuss' };
  }

  // 2b) 状态查询意图（优先于任务触发，避免把"查 task:xxx 情况"误建新任务）
  if (isLikelyStatusQuery(trimmed)) {
    return {
      action: 'status_query',
      isTask: false,
      confidence: 0.92,
      reason: 'status_query_detected',
      taskInfo: { taskIdHint: extractTaskIdFromText(trimmed) },
    };
  }

  // 3) 任务触发关键词
  // NOTE: \b does NOT work with Chinese characters in JS (Chinese = \W, not \w).
  // We simply match the prefix without boundary — Chinese task prefixes are long
  // enough (3+ chars) that false positives are negligible.
  const strictTaskTriggers = [
    /^(请|帮我|帮我做|帮我写|帮我实现|帮我完成|帮我分析|帮我设计)/i,
    /^(开发|实现|编写|创建|构建|部署|修复|优化|重构)/i,
    /^@?牢大\s+(请|帮我|开发|实现|写|做|分析)/i,
  ];

  const looseTaskTriggers = [
    ...strictTaskTriggers,
    /^(任务|task|todo|issue)\b/i,
    // 宽松模式：技术关键词（可能误判）
    /代码|功能|模块|接口|API|组件|页面|服务|数据库|配置/,
    /bug|问题|错误|异常|修复|调试/,
    /文档|测试|部署|发布/,
    /分析|评估|调研|方案|设计|规划/,
  ];

  const triggers = strictTaskMode ? strictTaskTriggers : looseTaskTriggers;
  for (const pattern of triggers) {
    if (pattern.test(trimmed)) {
      // Dashboard 严格模式：不要"自动建任务"，而是先二次确认
      if (strictTaskMode) {
        return {
          action: 'confirm_task',
          isTask: false,
          confidence: 0.8,
          reason: 'strict_task_trigger_confirm',
          taskInfo: {
            title: extractTaskTitle(trimmed),
            description: trimmed,
            priority: inferPriority(trimmed),
            taskMode: inferTaskMode(trimmed),
          },
        };
      }

      return {
        action: 'task',
        isTask: true,
        confidence: 0.88,
        reason: 'matched_task_pattern',
        taskInfo: {
          title: extractTaskTitle(trimmed),
          description: trimmed,
          priority: inferPriority(trimmed),
          taskMode: inferTaskMode(trimmed),
        },
      };
    }
  }

  // 4) 闲聊触发关键词
  const chatTriggers = [
    /^(你好|hi|hello|嗨|哈喽|早上好|晚上好|晚安)/i,
    /^(怎么样|如何|什么|为什么|谁|哪里)/,
    /(哈哈|呵呵|嘿嘿|笑死|笑死我了|太搞了)/,
    /^(谢谢|感谢|thanks|thx)/i,
    /(天气|吃饭|睡觉|无聊|累|忙)/,
  ];
  for (const pattern of chatTriggers) {
    if (pattern.test(trimmed)) {
      return { action: 'chat', isTask: false, confidence: 0.8, reason: 'matched_chat_pattern' };
    }
  }

  // 5) Dashboard 严格模式：对"看起来像任务但不够明确"的输入，先二次确认
  // - 避免：长技术描述直接建任务
  if (strictTaskMode) {
    const looksTechnical = /(代码|bug|异常|报错|接口|API|部署|配置|数据库|WebSocket|WSS|CORS|CloudBase)/i.test(trimmed);
    if (looksTechnical && trimmed.length >= 20) {
      return {
        action: 'confirm_task',
        isTask: false,
        confidence: 0.7,
        reason: 'strict_confirm_needed',
        taskInfo: {
          title: extractTaskTitle(trimmed),
          description: trimmed,
          priority: inferPriority(trimmed),
          taskMode: inferTaskMode(trimmed),
        },
      };
    }
  }

  // 6) 默认：短消息更像聊天；长消息（非 strict）更像任务
  if (trimmed.length < 10) {
    return { action: 'chat', isTask: false, confidence: 0.6, reason: 'short_message' };
  }

  if (!strictTaskMode && trimmed.length > 60) {
    return {
      action: 'task',
      isTask: true,
      confidence: 0.65,
      reason: 'long_message_loose',
      taskInfo: {
        title: extractTaskTitle(trimmed),
        description: trimmed,
        priority: inferPriority(trimmed),
        taskMode: inferTaskMode(trimmed),
      },
    };
  }

  if (isLikelyDiscuss(trimmed)) {
    return { action: 'discuss', isTask: false, confidence: 0.65, reason: 'discuss_default' };
  }

  return { action: 'chat', isTask: false, confidence: 0.55, reason: 'default_chat' };
}

function extractTaskTitle(text = '') {
  const trimmed = normalizeText(text);
  let title = trimmed
    .replace(/^(请|帮我|帮我做|帮我写|帮我实现|帮我完成|帮我分析|帮我设计)\s*/i, '')
    .replace(/^(开发|实现|编写|创建|构建|部署|修复|优化|重构)\s*/i, '')
    .replace(/^@?牢大\s+/i, '')
    .trim();

  if (title.length > 48) title = title.slice(0, 48) + '…';
  return title || '待处理任务';
}

function inferPriority(text = '') {
  const t = normalizeText(text).toLowerCase();
  if (/(立即|马上|尽快|紧急|urgent|asap|立刻|现在)/.test(t)) return 100;
  if (/(今天|明天|本周|重要|important)/.test(t)) return 50;
  return 10;
}

function inferTaskMode(text = '') {
  const t = normalizeText(text).toLowerCase();
  if (/(分析|评估|调研|了解|梳理|整理)/.test(t)) return 'analysis';
  if (/(实现|开发|编写|代码|功能|模块)/.test(t)) return 'build';
  if (/(配置|设置|修改配置|config|配置变更)/.test(t)) return 'config-change';
  return 'general';
}

function formatTaskLine(task) {
  const id = String(task?.taskId || '').split(':').slice(-1)[0]?.slice(0, 8) || '';
  const title = String(task?.title || '未命名任务');
  const state = String(task?.state || 'pending');
  const stateLabel = STATE_LABELS[state] || state;
  return `- [${stateLabel}] ${title}  （${id}）`;
}

function listScopeTasks({ teamStore, scopeKey = 'dashboard', limit = 10 } = {}) {
  if (!teamStore?.listTeamsByScope || !teamStore?.listTasksByTeam) return [];
  const teams = teamStore.listTeamsByScope(String(scopeKey || '')) || [];
  const tasks = [];
  for (const team of teams) {
    const list = teamStore.listTasksByTeam(String(team.teamId || '')) || [];
    for (const t of list) tasks.push(t);
    if (tasks.length >= limit) break;
  }
  // 去重（同一个 taskId 不重复）
  const seen = new Set();
  const out = [];
  for (const t of tasks) {
    const id = String(t?.taskId || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(t);
    if (out.length >= limit) break;
  }
  // 按 updatedAt desc
  out.sort((a, b) => safeInt(b?.updatedAt, 0) - safeInt(a?.updatedAt, 0));
  return out;
}

/** 通过部分 ID 模糊查找任务 */
function findTaskByPartialId({ teamStore, partialId, scopeKey = 'dashboard' } = {}) {
  if (!partialId || !teamStore) return null;
  const needle = String(partialId).toLowerCase().replace(/[^0-9a-f-]/g, '');
  if (!needle) return null;

  // 先尝试精确匹配
  if (teamStore.getTaskById) {
    const exact = teamStore.getTaskById(partialId);
    if (exact) return exact;
  }

  // 模糊遍历
  const teams = teamStore.listTeamsByScope?.(String(scopeKey || '')) || [];
  for (const team of teams) {
    const tasks = teamStore.listTasksByTeam?.(String(team.teamId || '')) || [];
    for (const t of tasks) {
      const id = String(t?.taskId || '').toLowerCase();
      if (id.includes(needle)) return t;
    }
  }
  return null;
}

/** 格式化任务状态为可读报告 */
function formatTaskStatus(task) {
  if (!task) return '未找到该任务。';
  const id = String(task.taskId || '');
  const title = String(task.title || '无标题');
  const state = String(task.state || 'unknown');
  const stateLabel = STATE_LABELS[state] || state;
  const taskMode = String(task.metadata?.taskMode || 'general');
  const riskLevel = String(task.metadata?.riskLevel || 'low');
  const driver = String(task.metadata?.currentMemberKey || task.ownerMemberId || '—');
  const updatedAt = task.updatedAt ? new Date(Number(task.updatedAt)).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

  return [
    `📋 任务状态`,
    '',
    `📝 ${title}`,
    `🆔 ${id.slice(0, 20)}...`,
    `📊 状态：${stateLabel}`,
    `🔧 模式：${taskMode} / 风险：${riskLevel}`,
    `👤 当前驱动：${driver}`,
    `🕐 最后更新：${updatedAt}`,
  ].join('\n');
}

function buildHelpText() {
  return [
    '支持以下输入：',
    '',
    '1）普通聊天：直接发消息即可（不会自动建任务）。',
    '2）建任务：',
    '   - 以"任务："开头，或',
    '   - 用命令：/task 你的任务描述',
    '3）查任务状态：',
    '   - /status <任务ID>（或直接说"查看 task:xxx 执行情况"）',
    '4）讨论：/discuss 话题（只讨论，不建任务）。',
    '5）命令：',
    '   - /help 说明',
    '   - /tasks 查看最近任务',
    '',
    '提示：如果我问你"要不要转成任务？"，你回 /task + 原文即可一键建任务。',
  ].join('\n');
}

function buildStatusText() {
  return [
    '后端状态：',
    '- API：/health（建议）',
    '- WS：/ws/chat',
    '',
    '如果你看到"未连接"，优先无痕刷新，然后看浏览器控制台是否有 WSS / CORS 报错。',
  ].join('\n');
}

function buildDiscussText({ text = '' } = {}) {
  const topic = normalizeText(text);
  return [
    `我们先讨论，不建任务。话题：${topic || '（空）'}`,
    '',
    '【planner】我建议先把目标拆成 3 段：现象复现 → 根因定位 → 验收标准与回归点。',
    '【critic】注意边界：讨论不要落成任务流；任何自动建任务都要二次确认。',
    '【judge】先定规则：默认 chat；只有"任务：/ /task / 明确动词指令"才进任务。',
    '',
    '要把这段讨论转为任务：回复：',
    `/task ${topic || '把上面讨论转成可执行任务并落地'}`,
  ].join('\n');
}

function buildConfirmText({ taskInfo } = {}) {
  const title = String(taskInfo?.title || '这段内容');
  return [
    `我理解你在描述：${title}`,
    '',
    '这条输入看起来"像任务但不够明确"。你希望我：',
    '1）当作普通聊天继续讨论（不建任务），还是',
    '2）创建任务进入 AI Team 流程？',
    '',
    '如果要建任务：回复：',
    `/task ${String(taskInfo?.description || '').slice(0, 300)}`,
    '如果只是聊天：直接说"继续聊/先讨论"，或用 /discuss 进入讨论模式。',
  ].join('\n');
}

/**
 * 触发任务执行（使用 tlRuntime.createTeamRunFromEvent）。
 */
export async function triggerTaskExecution({ teamStore, tlRuntime, taskInfo, scopeKey, metadata = {} } = {}) {
  if (!teamStore || !tlRuntime) {
    return { ok: false, error: 'missing_dependencies' };
  }

  try {
    const evt = {
      text: String(taskInfo?.description || taskInfo?.title || ''),
      scope_key: scopeKey,
      scopeKey,
      planSeed: metadata?.planSeed,
      ...metadata,
    };

    const result = await tlRuntime.createTeamRunFromEvent?.(evt);

    if (!result?.task) {
      return { ok: false, error: 'create_team_run_failed' };
    }

    return {
      ok: true,
      task: result.task,
      team: result.team,
      members: result.members,
    };
  } catch (err) {
    return {
      ok: false,
      error: String(err?.message || err || 'trigger_execution_failed'),
    };
  }
}

function generateTaskAcceptedMessage({ task, classification } = {}) {
  const title = String(task?.title || '任务');
  const taskMode = String(task?.metadata?.taskMode || classification?.taskInfo?.taskMode || 'general');
  const modeLabel = {
    analysis: '分析',
    build: '开发',
    'config-change': '配置变更',
    general: '通用',
  }[taskMode] || '通用';
  const state = String(task?.state || 'pending');
  const stateHint = {
    pending: '任务已入队，等待开始。',
    planning: '正在由 planner 生成计划。',
    plan_review: '计划已生成，正在评审。',
    approved: '计划已批准，正在执行。',
    revision_requested: '评审要求修订，已回到规划阶段。',
    done: '任务已完成。',
    blocked: '任务已阻塞，等待处理。',
    cancelled: '任务已取消。',
  }[state] || '任务已创建。';

  return `✅ 已接收任务「${title}」\n\n📋 任务类型：${modeLabel}\n🆔 任务 ID：${String(task?.taskId || '').slice(0, 20)}...\n\n${stateHint}`;
}

async function tryNativeChatReply(nativeChat, params, timeoutMs = 12000) {
  const onChunk = params?.onChunk;
  if (onChunk && nativeChat?.generateReplyStream) {
    try {
      return await Promise.race([
        nativeChat.generateReplyStream(params),
        new Promise((resolve) => {
          setTimeout(() => resolve({ ok: false, error: 'native_chat_timeout' }), timeoutMs);
        }),
      ]);
    } catch (err) {
      return { ok: false, error: String(err?.message || err || 'native_chat_stream_failed') };
    }
  }
  if (!nativeChat?.generateReply) return null;
  try {
    return await Promise.race([
      nativeChat.generateReply(params),
      new Promise((resolve) => {
        setTimeout(() => resolve({ ok: false, error: 'native_chat_timeout' }), timeoutMs);
      }),
    ]);
  } catch (err) {
    return {
      ok: false,
      error: String(err?.message || err || 'native_chat_failed'),
    };
  }
}

/**
 * 创建完整的 Dispatcher。
 */
export function createTaskDispatcher({ teamStore, tlRuntime, outputSender, fetchImpl, nativeChat } = {}) {
  const doFetch = typeof fetchImpl === 'function' ? fetchImpl : globalThis.fetch;

  async function handleCommand({ command, scopeKey = 'dashboard' } = {}) {
    const name = String(command?.name || '').toLowerCase();
    const args = String(command?.args || '').trim();

    if (name === 'help') {
      return { ok: true, action: 'command', response: buildHelpText(), command };
    }

    if (name === 'status') {
      // /status <taskId> → 查任务状态；/status → 后端健康
      if (args) {
        const task = findTaskByPartialId({ teamStore, partialId: args, scopeKey });
        if (task) {
          return { ok: true, action: 'status_query', response: formatTaskStatus(task), command };
        }
        return { ok: true, action: 'command', response: `未找到 ID 包含「${args}」的任务。用 /tasks 查看最近任务列表。`, command };
      }
      return { ok: true, action: 'command', response: buildStatusText(), command };
    }

    if (name === 'tasks') {
      const tasks = listScopeTasks({ teamStore, scopeKey, limit: 10 });
      if (!tasks.length) {
        return { ok: true, action: 'command', response: '当前暂无任务。你可以用：\n/task 修复 WebSocket 连接提示一直未连接\n来创建一个任务。', command };
      }
      const lines = tasks.map(formatTaskLine);
      return {
        ok: true,
        action: 'command',
        response: ['最近任务：', ...lines, '', '要继续某个任务：把 taskId 发我，或直接 /task + 新指令。'].join('\n'),
        command,
      };
    }

    if (name === 'task') {
      const body = args;
      if (!body) {
        return { ok: true, action: 'command', response: '用法：/task 你的任务描述（例如：/task 修复 Dashboard WS strictTaskMode 并部署）', command };
      }
      const classification = {
        action: 'task',
        isTask: true,
        confidence: 0.99,
        reason: 'command_task',
        taskInfo: {
          title: extractTaskTitle(body),
          description: body,
          priority: inferPriority(body),
          taskMode: inferTaskMode(body),
        },
      };
      return { ok: true, action: 'task', classification, taskInfo: classification.taskInfo };
    }

    if (name === 'chat') {
      return { ok: true, action: 'chat', response: args || '行，我们当作普通聊天继续。你想聊哪块？', command };
    }

    if (name === 'discuss') {
      return { ok: true, action: 'discuss', response: buildDiscussText({ text: args }), command };
    }

    return {
      ok: true,
      action: 'command',
      response: `未知命令：/${name}\n\n` + buildHelpText(),
      command,
    };
  }

  /**
   * @returns {Promise<{ ok: boolean, action: DispatchAction, response?: string, task?: object, team?: object, members?: any[], classification?: any }>}
   */
  async function handleMessage({ text, scopeKey, metadata = {}, onChunk = null } = {}) {
    const classification = classifyMessage({ text, metadata });
    const history = Array.isArray(metadata?.history) ? metadata.history : [];

    if (classification.action === 'command') {
      const out = await handleCommand({ command: classification.command, scopeKey });
      // /task 会返回 action=task，继续触发任务执行
      if (out?.action === 'task') {
        const taskClassification = {
          action: 'task',
          isTask: true,
          confidence: 0.99,
          reason: 'command_task',
          taskInfo: out.taskInfo || out.classification?.taskInfo || {
            title: extractTaskTitle(out.command?.args || ''),
            description: out.command?.args || '',
            priority: 10,
            taskMode: 'general',
          },
        };
        Object.assign(classification, taskClassification);
      } else {
        return { ok: true, action: out.action, response: out.response || null, classification };
      }
    }

    if (classification.action === 'status_query') {
      const hint = String(classification.taskInfo?.taskIdHint || extractTaskIdFromText(text) || '');
      if (hint) {
        const task = findTaskByPartialId({ teamStore, partialId: hint, scopeKey });
        if (task) {
          return { ok: true, action: 'status_query', response: formatTaskStatus(task), task, classification };
        }
        return { ok: true, action: 'status_query', response: `未找到 ID 包含「${hint}」的任务。用 /tasks 查看最近任务列表。`, classification };
      }
      return { ok: true, action: 'chat', response: '你想查询哪个任务？请提供任务 ID，或用 /tasks 查看最近任务。', classification };
    }

    if (classification.action === 'discuss') {
      const chatFn = nativeChat?.generateReplyStream && onChunk ? nativeChat.generateReplyStream : nativeChat?.generateReply;
      if (chatFn) {
        const discussReply = await tryNativeChatReply(nativeChat, {
          text, history, mode: 'discuss',
          strictTaskMode: !!metadata?.strictTaskMode,
          scopeKey,
          ...(onChunk ? { onChunk } : {}),
        }, 15000);
        if (discussReply?.ok && discussReply.reply) {
          return {
            ok: true, action: 'discuss', response: discussReply.reply,
            classification: { ...classification, model: discussReply.model },
          };
        }
      }
      return { ok: true, action: 'discuss', response: buildDiscussText({ text }), classification };
    }

    if (classification.action === 'confirm_task') {
      if (nativeChat?.generateReply) {
        const confirmReply = await tryNativeChatReply(nativeChat, {
          text: `${text}\n\n请先不要创建任务，而是用一句自然中文问用户：这是继续讨论，还是转成任务执行？并提示可用 /task。`,
          history, mode: 'chat', strictTaskMode: true, scopeKey,
        }, 15000);
        if (confirmReply?.ok && confirmReply.reply) {
          return {
            ok: true, action: 'confirm_task', response: confirmReply.reply,
            classification: { ...classification, model: confirmReply.model },
          };
        }
      }
      return { ok: true, action: 'confirm_task', response: buildConfirmText({ taskInfo: classification.taskInfo }), classification };
    }

    // chat：流式优先
    if (!classification.isTask) {
      if (nativeChat?.generateReplyStream && onChunk) {
        const chatReply = await tryNativeChatReply(nativeChat, {
          text, history, mode: 'chat',
          strictTaskMode: !!metadata?.strictTaskMode,
          scopeKey,
          onChunk,
        }, 20000);
        if (chatReply?.ok && chatReply.reply) {
          return {
            ok: true,
            action: 'chat',
            response: chatReply.reply,
            source: String(chatReply?.source || 'native_chat'),
            classification: { ...classification, model: chatReply.model },
          };
        }
      }
      if (nativeChat?.generateReply) {
        const chatReply = await nativeChat.generateReply({
          text, history, mode: 'chat',
          strictTaskMode: !!metadata?.strictTaskMode,
          scopeKey,
        });
        if (chatReply?.ok && chatReply.reply) {
          return {
            ok: true,
            action: 'chat',
            response: chatReply.reply,
            source: String(chatReply?.source || 'native_chat'),
            classification: { ...classification, model: chatReply.model },
          };
        }
      }

      return {
        ok: true,
        action: 'chat',
        response: buildDiscussText({ text }),
        source: 'template_fallback',
        classification,
      };
    }

    // task：触发 team runtime
    const triggerResult = await triggerTaskExecution({
      teamStore,
      tlRuntime,
      taskInfo: classification.taskInfo,
      scopeKey,
      metadata: {
        ...metadata,
        classificationReason: classification.reason,
        confidence: classification.confidence,
      },
    });

    if (!triggerResult.ok) {
      return { ok: false, action: 'task', error: triggerResult.error, classification };
    }

    const response = generateTaskAcceptedMessage({ task: triggerResult.task, classification });

    return {
      ok: true,
      action: 'task',
      response,
      task: triggerResult.task,
      team: triggerResult.team,
      members: triggerResult.members,
      classification,
    };
  }

  async function notifyTaskCompletion({ taskId, result } = {}) {
    if (!outputSender) {
      return { ok: false, error: 'output_sender_not_available' };
    }

    const task = teamStore?.getTaskById?.(taskId);
    if (!task) {
      return { ok: false, error: 'task_not_found' };
    }

    return outputSender.sendVisibleOutput({
      teamId: task.teamId,
      taskId,
      title: `✅ 任务完成：${task.title}`,
      text: String(result?.summary || '任务已执行完成。'),
      metadata: {
        taskId,
        completedAt: Date.now(),
        traceCaller: 'team-task-dispatcher.notifyTaskCompletion',
      },
    });
  }

  return {
    classifyMessage,
    handleMessage,
    triggerTaskExecution,
    notifyTaskCompletion,
    // keep for future
    doFetch,
  };
}

/**
 * 兼容：保留 createTeamTask（当前主链不依赖，留给未来扩展）。
 */
export async function createTeamTask({ teamStore, taskInfo, scopeKey, metadata = {} } = {}) {
  if (!teamStore) {
    return { ok: false, error: 'team_store_not_available' };
  }

  const now = Date.now();
  const teamId = `team:${scopeKey}:${randomUUID()}`;
  const taskId = `task:${scopeKey}:${randomUUID()}`;

  try {
    // team-store 当前无 getTeamByScopeKey，暂时总是创建新 team（不影响主链）
    const team = teamStore.createTeam({
      teamId,
      scopeKey,
      mode: 'task-dispatch',
      status: 'active',
      metadata: {
        source: 'dispatcher',
        createdAt: now,
        ...metadata,
      },
    });

    const task = teamStore.createTask({
      taskId,
      teamId: team.teamId,
      title: String(taskInfo?.title || '待处理任务'),
      description: String(taskInfo?.description || ''),
      state: 'pending',
      priority: Number(taskInfo?.priority || 10),
      metadata: {
        taskMode: String(taskInfo?.taskMode || 'general'),
        source: 'dispatcher',
        scopeKey,
        createdAt: now,
        ...metadata,
      },
    });

    return { ok: true, task, team };
  } catch (err) {
    return { ok: false, error: String(err?.message || err || 'create_task_failed') };
  }
}
