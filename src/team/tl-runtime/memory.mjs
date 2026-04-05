export function createTLMemoryHelpers({
  teamStore,
  nowFn,
  ensureArray,
  ensureString,
} = {}) {
  function buildBlackboardSnapshot(taskId = '', opts = {}) {
    if (!teamStore?.listBlackboardEntries) return '';
    const maxEntries = opts.maxEntries || 30;
    const maxChars = opts.maxChars || 4000;
    const title = String(opts.title || '## 📋 团队共享黑板（Blackboard）');

    try {
      const entries = teamStore.listBlackboardEntries({ taskId, limit: maxEntries });
      if (!entries || entries.length === 0) return '';

      const sectionMap = {};
      for (const entry of entries) {
        const section = String(entry.section || 'general');
        if (!sectionMap[section]) sectionMap[section] = [];
        const value = entry.value || {};
        const summary = typeof value === 'string'
          ? value
          : value.summary || value.text || value.content || JSON.stringify(value).slice(0, 500);
        sectionMap[section].push({
          key: entry.entryKey,
          summary: String(summary).slice(0, 600),
          author: entry.authorMemberId || '',
        });
      }

      const lines = [title];
      let totalChars = 0;
      for (const [section, items] of Object.entries(sectionMap)) {
        lines.push(`### ${section}`);
        for (const item of items) {
          const line = `- **${item.key}**${item.author ? ` (by ${item.author})` : ''}: ${item.summary}`;
          totalChars += line.length;
          if (totalChars > maxChars) {
            lines.push('- _(更多条目已截断)_');
            return lines.join('\n');
          }
          lines.push(line);
        }
      }
      return lines.join('\n');
    } catch {
      return '';
    }
  }

  function buildWorkingMemorySnapshot(workItem = {}, resultsByAssignment = {}) {
    const deps = ensureArray(workItem.dependencies);
    const parts = ['## ⚡ L1 即时工作记忆（当前任务 / 上游依赖）'];

    if (workItem.context) parts.push(workItem.context);

    if (deps.length === 0) {
      if (!workItem.context) parts.push('- 当前没有显式上游依赖，按当前任务目标直接推进。');
      return parts.join('\n\n');
    }

    for (const depId of deps) {
      const upstream = resultsByAssignment[depId];
      if (!upstream) {
        parts.push(`### 上游 ${depId}`);
        parts.push('- 未找到上游结果，可能尚未执行完成或执行失败。');
        continue;
      }
      const structured = upstream.structured || {};
      const summaryText = ensureString(structured.summary || upstream.summary || upstream.result || '（无输出）');
      const ok = upstream.ok ? '✅ 完成' : '❌ 失败';
      const deliverables = ensureArray(structured.deliverables);
      const issues = ensureArray(structured.issues);

      const lines = [`### 上游 ${depId}（${upstream.role}）${ok}`, `- **摘要**：${summaryText.slice(0, 1200)}`];
      if (deliverables.length > 0) {
        lines.push(`- **交付物**：${deliverables.slice(0, 5).map((d) => typeof d === 'string' ? d : (d.title || d.path || JSON.stringify(d))).join('；')}`);
      }
      if (issues.length > 0) {
        lines.push(`- **待关注问题**：${issues.slice(0, 5).map((i) => `[${i.severity || 'info'}] ${i.title || i.id || ''}: ${i.detail || i.description || ''}`).join('；')}`);
      }
      const rawText = String(upstream.result || '').trim();
      if (rawText && rawText.length > summaryText.length + 100) {
        lines.push(`- **原始输出（截断）**：${rawText.slice(0, 1200)}`);
      }
      parts.push(lines.join('\n'));
    }

    return parts.join('\n\n');
  }

  function buildDurableMemorySnapshot(taskId = '', opts = {}) {
    const title = String(opts.title || '## 🗂️ L3 持久证据记忆（Artifacts / Evidence / Decisions）');
    const lines = [title];

    try {
      const plan = teamStore?.getLatestPlanByTask?.(taskId) || null;
      const reviews = teamStore?.listReviewsByTask?.(taskId) || [];
      const decisions = teamStore?.listDecisionsByTask?.(taskId) || [];
      const artifacts = teamStore?.listArtifactsByTask?.({ taskId, limit: 12 }) || [];
      const evidence = teamStore?.listEvidenceByTask?.({ taskId, limit: 12 }) || [];
      const latestReview = reviews[0] || null;
      const latestDecision = decisions[0] || null;

      if (plan) lines.push(`- **最新 plan**：${ensureString(plan.summary || plan.title || '').slice(0, 240) || '已存在规划记录'}`);
      if (latestReview) lines.push(`- **最新 review**：verdict=${ensureString(latestReview.verdict || '') || 'unknown'}；${ensureString(latestReview.summary || '').slice(0, 220) || '已存在评审记录'}`);
      if (latestDecision) lines.push(`- **最新 decision**：type=${ensureString(latestDecision.decisionType || '') || 'unknown'}；${ensureString(latestDecision.reason || latestDecision.summary || '').slice(0, 220) || '已存在裁决记录'}`);
      if (artifacts.length > 0) {
        lines.push(`- **最近产物**：${artifacts.slice(0, 4).map((item) => `${item.artifactType || 'artifact'}:${ensureString(item.title || '').slice(0, 80) || item.artifactId || '-'}`).join('；')}`);
      }
      if (evidence.length > 0) {
        lines.push(`- **最近证据**：${evidence.slice(0, 4).map((item) => `${item.evidenceType || 'evidence'}:${ensureString(item.title || item.detail || '').slice(0, 80) || item.evidenceId || '-'}`).join('；')}`);
      }

      if (lines.length === 1) lines.push('- 当前还没有沉淀出的持久证据，后续执行结果会写入这里。');
      return lines.join('\n');
    } catch {
      return `${title}\n- 持久证据读取失败，已跳过。`;
    }
  }

  function buildThreeLayerMemorySnapshot({ taskId = '', context = '' } = {}) {
    const layers = ['## 🧠 三层 Memory 视图'];
    const workingLayer = context
      ? `## ⚡ L1 即时工作记忆（当前任务 / 上游依赖）\n${context}`
      : '## ⚡ L1 即时工作记忆（当前任务 / 上游依赖）\n- 当前没有额外上下文注入，按任务目标直接推进。';
    const sharedLayer = buildBlackboardSnapshot(taskId, { title: '## 📋 L2 任务共享记忆（Blackboard）' })
      || '## 📋 L2 任务共享记忆（Blackboard）\n- 当前黑板尚无共享条目，新的 findings / decisions 会在执行中继续沉淀。';
    const durableLayer = buildDurableMemorySnapshot(taskId, { title: '## 🗂️ L3 持久证据记忆（Artifacts / Evidence / Decisions）' });
    layers.push(workingLayer, sharedLayer, durableLayer);
    return layers.join('\n\n');
  }

  function extractAndWriteBlackboard({ teamId, taskId, assignmentId, role, result } = {}) {
    if (!teamStore?.upsertBlackboardEntry || !result) return;

    const structured = result.structured || {};
    const summary = ensureString(structured.summary || result.summary || result.result || '');
    if (!summary) return;

    try {
      teamStore.upsertBlackboardEntry({
        teamId,
        taskId,
        section: 'member_results',
        entryKey: assignmentId || `${role}:${nowFn()}`,
        value: {
          role,
          assignmentId,
          ok: result.ok,
          summary: summary.slice(0, 1500),
          deliverables: ensureArray(structured.deliverables).slice(0, 10),
          issues: ensureArray(structured.issues).slice(0, 10),
          timestamp: nowFn(),
        },
        authorMemberId: `member:${role}`,
      });

      if (structured.needsReplan) {
        teamStore.upsertBlackboardEntry({
          teamId,
          taskId,
          section: 'signals',
          entryKey: `replan:${assignmentId || role}`,
          value: {
            signal: 'needsReplan',
            reason: ensureString(structured.replanReason || 'member requested replan'),
            from: assignmentId || role,
            timestamp: nowFn(),
          },
          authorMemberId: `member:${role}`,
        });
      }

      const findings = ensureArray(structured.findings || structured.decisions || structured.keyPoints);
      for (let i = 0; i < Math.min(findings.length, 5); i += 1) {
        const finding = findings[i];
        teamStore.upsertBlackboardEntry({
          teamId,
          taskId,
          section: 'findings',
          entryKey: `${assignmentId || role}:${i}`,
          value: typeof finding === 'string' ? { text: finding } : finding,
          authorMemberId: `member:${role}`,
        });
      }
    } catch {}
  }

  function buildUpstreamContext(workItem = {}, resultsByAssignment = {}) {
    return buildWorkingMemorySnapshot(workItem, resultsByAssignment);
  }

  return {
    buildBlackboardSnapshot,
    buildWorkingMemorySnapshot,
    buildDurableMemorySnapshot,
    buildThreeLayerMemorySnapshot,
    extractAndWriteBlackboard,
    buildUpstreamContext,
  };
}
