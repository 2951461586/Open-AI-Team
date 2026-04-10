import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildAgentSystemPrompt } from '../agent-personality.mjs';
import {
  filterMemoryByIsolation,
  filterToolsByIsolation,
  buildIsolatedSandboxConfig,
  CONTEXT_ISOLATION_LEVELS,
  isContextIsolationEnabled,
} from '../sub-agent-context.mjs';

export function createTLPromptHelpers({
  teamStore,
  roleConfig = {},
  workspaceRoot,
  ensureArray,
  ensureString,
  getRoleCapabilityContract,
  buildRoleCapabilityContractPrompt,
  buildExecutionSurfacePrompt,
  buildSearchEvidenceSafetyPrompt,
  buildThreeLayerMemorySnapshot,
} = {}) {
  function buildTaskStateSnapshot(limit = 20) {
    try {
      const recent = teamStore?.listRecentTasks?.(limit) || [];
      if (recent.length === 0) return '';

      const stateCounts = {};
      for (const t of recent) {
        const s = String(t.state || 'unknown');
        stateCounts[s] = (stateCounts[s] || 0) + 1;
      }
      const stateSummary = Object.entries(stateCounts).map(([s, c]) => `${s}: ${c}`).join('、');
      const prioritized = recent
        .filter((t) => ['blocked', 'active', 'pending', 'in_progress'].includes(String(t.state || '')))
        .slice(0, 10);
      const done = recent.filter((t) => t.state === 'done').slice(0, 5);

      const formatTask = (t) => {
        const desc = String(t.description || '').slice(0, 100);
        return `  - [${t.state}] ${String(t.title || '').slice(0, 80)} (ID: ${t.taskId})${desc ? `\n    描述: ${desc}` : ''}`;
      };

      const lines = ['## 当前团队任务状态', `共 ${recent.length} 个任务（${stateSummary}）`, ''];
      if (prioritized.length > 0) {
        lines.push('### 需要关注的任务');
        for (const t of prioritized) lines.push(formatTask(t));
        lines.push('');
      }
      if (done.length > 0) {
        lines.push('### 最近完成的任务');
        for (const t of done) lines.push(formatTask(t));
        lines.push('');
      }
      return lines.join('\n');
    } catch {
      return '';
    }
  }

  function buildTLSystemPrompt(members = []) {
    const memberList = members
      .filter((m) => m.role !== 'tl')
      .map((m) => `- **${m.displayName || m.role}** (${m.role}): ${m.description || '无描述'}`)
      .join('\n');

    const taskSnapshot = buildTaskStateSnapshot();
    const tlConfig = roleConfig?.roles?.tl || {};
    const scenario = String(tlConfig?.personality?.activeScenario || 'default').trim();
    const personalitySelection = String(
      tlConfig?.activePersonality
      || tlConfig?.personality?.active
      || tlConfig?.personality?.default
      || ''
    ).trim();
    const basePrompt = `你是 AI Team 的 Team Lead（TL）。你负责接收用户任务，分析、拆解、路由，并对最终结果负责。

## 你的团队成员
${memberList || '（暂无成员）'}

${taskSnapshot}

## 你的决策规则

1. **简单问答**（打招呼、闲聊、一句话的知识问答）→ 你直接回答（纯文本）
2. **需要产出的任务**（分析、调研、梳理、对比、总结、写文档、写方案、写代码、修文件、跑命令、部署、创建内容）→ 必须分配给 executor
3. **需要审查/评估** → 分配给 critic
4. **需要裁决 / 高风险批准** → 分配给 judge
5. **复杂任务** → 拆成多个 workItems，并声明依赖关系

⚠️ **关键区分**：
- "分析一个方案"、"梳理路线图"、"对比方案"、"写文档" 这些需要**产出内容**的请求，**不是**简单问答，你必须分配给 executor。
- 你可以用 partial_delegate 先给出你的初步思路，但实际的分析/产出工作必须分派出去。
- 只有纯闲聊（你好、谢谢）和无需产出的一句话问答才能直接回复。

## 输出要求

### 直接回答
输出纯文本。

### 分配任务
输出 JSON，对象结构如下：

\`\`\`json
{
  "action": "delegate",
  "summary": "一句话解释为什么这样拆",
  "taskMode": "general",
  "riskLevel": "medium",
  "workItems": [
    {
      "id": "w1",
      "role": "executor",
      "title": "实现功能",
      "objective": "要完成的目标",
      "task": "给成员的具体执行指令",
      "acceptance": "怎么算完成",
      "deliverables": ["文件路径/产物名"],
      "dependencies": [],
      "riskLevel": "medium",
      "needsReview": false,
      "needsDecision": false,
      "context": "附加上下文"
    }
  ]
}
\`\`\`

### 部分自己回答 + 部分分配
\`\`\`json
{
  "action": "partial_delegate",
  "directReply": "你直接回答的部分",
  "summary": "为什么还需要分配",
  "taskMode": "general",
  "riskLevel": "medium",
  "workItems": [ ... 同上 ... ]
}
\`\`\`

## 关键规则
- 需要真正执行的事，不能假装做，必须分配给真实成员。
- 每个 workItem 都要给出：id / role / title / objective / task / acceptance。
- deliverables、dependencies、riskLevel、needsReview、needsDecision 尽量补齐。
- 如果任务低风险且不需要审查，可以直接只派 executor。
- 如果高风险，明确标记 riskLevel=high。
- **当用户提到"已阻塞的任务"、"blocked 任务"或类似表述时，必须结合上面的「当前团队任务状态」来定位具体任务，不要反问用户要哪些任务。如果能从状态里匹配到，就直接对这些任务进行操作。**
- **当用户要求对已有任务做操作（清理、重启、关闭、重排等），你必须分配给 executor 去执行，而不是直接回答。**`;

    const promptBuild = buildAgentSystemPrompt({
      agentName: tlConfig.displayName || 'Team Lead',
      role: 'tl',
      rolePrompt: basePrompt,
      roleConfig: {
        ...tlConfig,
        personality: {
          ...(tlConfig?.personality || {}),
          mergeStrategy: 'prepend',
        },
      },
      personalityId: personalitySelection,
      scenario,
    });

    return promptBuild.systemPrompt;
  }

  function buildCompletionFilePath({ taskWorkspace, assignmentId, role, sessionKey = '' } = {}) {
    const safeAssignment = String(assignmentId || `${role || 'member'}-${randomUUID()}`)
      .replace(/[^a-zA-Z0-9_:-]/g, '_');
    const safeSession = String(sessionKey || 'pending').replace(/[^a-zA-Z0-9_:-]/g, '_');
    return path.join(taskWorkspace, '.team-completions', `${safeAssignment}__${safeSession}.json`);
  }

  function buildMemberPrompt({ role, task, taskId, childTaskId, assignmentId, sessionKey = '', objective, acceptance, deliverables, context = '', workItem = {}, resultsByAssignment = {}, subAgentContext = null } = {}) {
    const memberConfig = roleConfig?.roles?.[role] || {};
    const workDirId = childTaskId || taskId;
    const taskWorkspace = `${workspaceRoot}/${String(workDirId).replace(/[^a-zA-Z0-9_:-]/g, '_')}`;
    const completionFilePath = buildCompletionFilePath({ taskWorkspace, assignmentId, role, sessionKey });
    const threeLayerMemory = buildThreeLayerMemorySnapshot({ taskId, context, workItem, resultsByAssignment });
    const scenario = String(workItem?.scenario || memberConfig?.personality?.activeScenario || 'default').trim();
    const personalitySelection = String(
      workItem?.personality
      || workItem?.personalityId
      || memberConfig?.activePersonality
      || memberConfig?.personality?.active
      || memberConfig?.personality?.default
      || ''
    ).trim();
    const baseIdentityPrompt = `你是 AI Team 中的 ${memberConfig.displayName || role}。`;

    const isolationEnabled = isContextIsolationEnabled(subAgentContext);
    const isolationWarning = isolationEnabled
      ? `\n\n## ⚠️ 上下文隔离已启用\n当前 Sub-Agent 运行在隔离上下文中。\n`
        + `- 隔离级别: ${subAgentContext?.isolationLevel || 'partial'}\n`
        + `- 继承父上下文记忆: ${subAgentContext?.options?.inheritParentMemory !== false ? '是' : '否'}\n`
        + `- 与其他 Agent 隔离: ${subAgentContext?.options?.isolateFromOtherAgents !== false ? '是' : '否'}\n`
      : '';

    const filteredMemory = isolationEnabled
      ? filterMemoryByIsolation(subAgentContext, threeLayerMemory)
      : threeLayerMemory;

    const promptBuild = buildAgentSystemPrompt({
      agentName: memberConfig.displayName || role,
      role,
      rolePrompt: baseIdentityPrompt,
      roleConfig: memberConfig,
      personalityId: personalitySelection,
      scenario,
    });

    return {
      memberPrompt: `${promptBuild.systemPrompt}
${isolationWarning}

## 任务目标
${objective || task}

## 具体执行任务
${task}

## 验收标准
${acceptance || '完成任务并返回可验证结果'}

## 交付物
${ensureArray(deliverables).length ? ensureArray(deliverables).map((v) => `- ${v}`).join('\n') : '- 无明确交付物，至少返回结构化总结'}

${filteredMemory ? `${filteredMemory}\n` : ''}
${buildRoleCapabilityContractPrompt(role, roleConfig)}
${buildExecutionSurfacePrompt(role, workItem, roleConfig)}
${buildSearchEvidenceSafetyPrompt({ taskWorkspace, taskId, childTaskId, assignmentId })}

## workItem 角色能力要求
- requiredCapabilities：${ensureArray(workItem?.requiredCapabilities || memberConfig.capabilities || []).join('、') || '（未声明）'}
- expectedContractVersion：${ensureString(workItem?.expectedContractVersion || memberConfig?.contract?.version || '') || '（未声明）'}
- expectedOutputType：${ensureString(workItem?.expectedOutputType || memberConfig?.contract?.outputType || '') || '（未声明）'}
- 不要输出不属于你角色职责的 review / decision / plan / executor 结果类型。

## 工作目录
你的任务工作区在 ${taskWorkspace}，所有产出文件请放在这个目录下。
如果目录不存在，先创建它。

## Completion 事件回推（强制）
完成后，除了正常回复外，还要把**最终结果**写入这个文件：

\`${completionFilePath}\`

写入内容必须是最终 JSON 结果；推荐命令：

\`mkdir -p "$(dirname \\"${completionFilePath}\\")" && cat > "${completionFilePath}" <<'JSON'
{ ...你的最终 JSON... }
JSON\`

要求：
- 只写最终结果，不要写中间草稿。
- 文件内容优先为合法 JSON。
- 正常回复和写 completion 文件，两者都要做；TL 以 completion 文件作为完成信号。

## 输出合同
优先输出 JSON：
\`\`\`json
{
  "ok": true,
  "status": "completed",
  "summary": "一句话总结结果",
  "deliverables": [{"path": "...", "type": "file", "title": "..."}],
  "issues": [],
  "findings": ["关键发现1", "关键发现2"],
  "needsReplan": false,
  "additionalWorkItems": [],
  "needsHuman": false
}
\`\`\`

## 动态追加任务
如果你在执行中发现需要额外步骤（比如发现了新的依赖、需要另一个角色协助、或任务范围超出预期），可以在 \`additionalWorkItems\` 中提议：
\`\`\`json
"additionalWorkItems": [
  {
    "role": "executor",
    "title": "追加任务标题",
    "task": "具体指令",
    "objective": "目标",
    "acceptance": "验收标准",
    "dependencies": ["当前任务ID"],
    "riskLevel": "medium"
  }
]
\`\`\`
这些会被 TL 自动追加到执行计划中。只在真正需要时使用。

## 执行要求
- 直接执行任务，输出真实结果。
- 如果是写代码/创建文件 → 必须真正写入文件系统。
- 尽量按 JSON 合同返回；如果实在不行，也要把结果讲清楚。
- 如果发现了关键信息、决策、或约束条件，放在 \`findings\` 字段中，它们会共享给团队其他成员。`,
      taskWorkspace,
      completionFilePath,
      memberConfig,
      subAgentContext,
      isolationEnabled,
      filteredMemory,
    };
  }

  return {
    buildTaskStateSnapshot,
    buildTLSystemPrompt,
    buildCompletionFilePath,
    buildMemberPrompt,
  };
}
