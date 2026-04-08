function hasReplanMarker(workItem = {}) {
  return String(workItem?.id || '').includes('replan') || String(workItem?.metadata?.replanKind || '').trim() === 'memory_retrieval';
}

function summarizeHits(hits = []) {
  return (Array.isArray(hits) ? hits : []).map((hit) => `- [${hit.scope}] ${hit.title} (score=${hit.score})`).join('\n') || '- none';
}

function splitChunks(text = '', maxLen = 120) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const lines = raw.split('\n').filter(Boolean);
  const chunks = [];
  let current = '';
  for (const line of lines) {
    if (!current) {
      current = line;
      continue;
    }
    if ((current + '\n' + line).length > maxLen) {
      chunks.push(current);
      current = line;
    } else {
      current += `\n${line}`;
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [raw];
}

async function emitStream({ role = '', label = '', text = '', onChunk = null, eventBus = null } = {}) {
  const chunks = splitChunks(text, 140);
  if (chunks.length === 0) return 0;
  for (let index = 0; index < chunks.length; index += 1) {
    const delta = chunks[index];
    const payload = { type: 'stream.chunk', role, label, delta, index: index + 1, total: chunks.length };
    if (eventBus?.emit) eventBus.emit(payload);
    if (typeof onChunk === 'function') {
      await onChunk({ role, label, delta, index: index + 1, total: chunks.length });
    }
  }
  if (eventBus?.emit) eventBus.emit({ type: 'stream.done', role, label, total: chunks.length });
  return chunks.length;
}

export function createLocalRuntimeAdapter({ agentRegistry = [], toolProvider = null, memoryProvider = null, eventBus = null, artifactStore = null, modelProvider = null } = {}) {
  const sessionHistory = new Map();

  function remember(sessionKey = '', role = '', content = '') {
    const items = sessionHistory.get(sessionKey) || [];
    items.push({ role: 'assistant', content: String(content || ''), actor: role, ts: Date.now() });
    sessionHistory.set(sessionKey, items);
  }

  async function runTool(tool = '', args = {}) {
    if (!toolProvider?.execute) return { ok: false, error: 'tool_provider_unavailable' };
    return toolProvider.execute(tool, args);
  }

  async function probeRole(role = '') {
    return {
      ok: true,
      provider: 'local-demo',
      role,
      selectedNode: 'local',
      deployment: {
        selectedNode: 'local',
        executionMode: 'local_demo_adapter',
        outwardIdentity: `demo:${role}`,
      },
      sessionCount: 0,
      status: 200,
      error: '',
    };
  }

  async function spawnForRole({ role = '', task = '', objective = '', acceptance = '', deliverables = [], workspaceDir = '', context = {}, toolRegistry = [], skillRegistry = [], memory = {}, onChunk = null } = {}) {
    const normalizedRole = String(role || '').trim().toLowerCase();
    const sessionKey = `demo:${normalizedRole}:local`;
    const workItem = context?.workItem || {};
    const previousSummaries = Array.isArray(context?.upstreamResults)
      ? context.upstreamResults.map((item) => `- ${item.role}: ${item.summary || item.title || item.id || ''}`).join('\n')
      : '';
    const effectiveToolRegistry = Array.isArray(toolRegistry) && toolRegistry.length > 0
      ? toolRegistry
      : (toolProvider?.listTools?.() || []);
    const toolList = Array.isArray(effectiveToolRegistry) ? effectiveToolRegistry.map((t) => t.id || t.name || '').filter(Boolean) : [];
    const skillList = Array.isArray(skillRegistry) ? skillRegistry.map((s) => s.id || s.name || '').filter(Boolean) : [];
    const effectiveDurableArtifacts = memoryProvider?.durableArtifacts || memory?.durableArtifacts || [];
    const durableArtifacts = Array.isArray(effectiveDurableArtifacts) ? effectiveDurableArtifacts : [];

    const base = {
      ok: true,
      provider: 'local-demo',
      role: normalizedRole,
      sessionKey,
      childSessionKey: sessionKey,
      runId: `demo-run:${normalizedRole}`,
      via: 'local_runtime_adapter',
      requestedNode: 'local',
      _routedNode: 'local',
      workspaceDir,
    };

    if (normalizedRole === 'planner') {
      const artifactRel = 'artifacts/PLAN.md';
      const planBody = `# Plan\n\n- objective: ${objective || task}\n- acceptance: ${acceptance || '-'}\n\n## Tool Registry\n${toolList.map((x) => `- ${x}`).join('\n') || '- none'}\n\n## Skill Registry\n${skillList.map((x) => `- ${x}`).join('\n') || '- none'}\n\n## Upstream Context\n${previousSummaries || '- none yet'}\n`;
      if (eventBus?.emit) eventBus.emit({ type: 'artifact.plan.writing', role: normalizedRole, path: artifactRel });
      await emitStream({ role: normalizedRole, label: 'plan.thinking', text: `开始规划：${objective || task}\n将输出 PLAN.md。`, onChunk, eventBus });
      const written = await runTool('fs.write_text', { path: artifactRel, content: planBody });
      await runTool('workspace.snapshot', {});
      await emitStream({ role: normalizedRole, label: 'plan.result', text: planBody, onChunk, eventBus });
      const artifactPath = written?.result?.path || artifactRel;
      const reply = JSON.stringify({
        summary: `已完成规划：${objective || task}`,
        deliverables: [artifactPath],
        findings: ['拆分为 planner → executor → critic → judge'],
        blackboardUpdate: { planning_status: 'ready', planned_roles: ['planner', 'executor', 'critic', 'judge'] },
      });
      remember(sessionKey, normalizedRole, reply);
      return { ...base, artifactPath, reply };
    }

    if (normalizedRole === 'executor' && !hasReplanMarker(workItem)) {
      const planRead = await runTool('fs.read_text', { path: 'artifacts/PLAN.md' });
      const snapshot = await runTool('fs.list', { path: 'artifacts', recursive: true });
      const pwdExec = await runTool('command.exec', { command: 'pwd', args: [], cwd: workspaceDir });
      const lsExec = await runTool('command.exec', { command: 'ls', args: ['-1', 'artifacts'], cwd: workspaceDir });
      const bridgeRoute = await runTool('bridge.route', { role: normalizedRole, routeKey: 'telegram-scaffold', text: `deliverable-ready:${objective || task}` });
      const deliverableRel = 'artifacts/DELIVERABLE.md';
      const body = `# Deliverable\n\n## Objective\n${objective || task}\n\n## Based On Plan\n${String(planRead?.result?.text || previousSummaries || '- none').slice(0, 1200)}\n\n## Produced Output\n- minimal runnable sample\n- local runtime adapter\n- standalone bootstrap\n- run report\n\n## Available Tools\n${toolList.map((x) => `- ${x}`).join('\n') || '- none'}\n\n## Command Runtime Evidence\n- pwd => ${String(pwdExec?.result?.stdout || '').trim() || '-'}\n- ls artifacts => ${String(lsExec?.result?.stdout || '').trim() || '-'}\n\n## Artifact Snapshot\n${(snapshot?.result?.items || []).map((x) => `- ${x.path}`).join('\n') || '- none'}\n`;
      if (eventBus?.emit) eventBus.emit({ type: 'artifact.deliverable.writing', role: normalizedRole, path: deliverableRel });
      await emitStream({ role: normalizedRole, label: 'deliverable.thinking', text: `开始执行：${objective || task}\n先交付主结果，暂不补 retrieval evidence。`, onChunk, eventBus });
      const written = await runTool('fs.write_text', { path: deliverableRel, content: body });
      await runTool('text.search', { path: 'artifacts', query: 'Plan' });
      await emitStream({ role: normalizedRole, label: 'deliverable.result', text: body, onChunk, eventBus });
      const artifactPath = written?.result?.path || deliverableRel;
      const reply = JSON.stringify({
        summary: `已完成执行：${objective || task}`,
        deliverables: [...(Array.isArray(deliverables) ? deliverables : []), artifactPath],
        issues: [],
        findings: ['workspace/artifact 已通过真实工具链落盘', 'bridge route injected capability 已实际执行', '当前故意未补 memory retrieval 证据，留给 critic 审查触发 replan'],
        nextSteps: ['critic review', 'judge decision'],
        blackboardUpdate: { execution_status: 'done', deliverable_path: artifactPath },
      });
      remember(sessionKey, normalizedRole, reply);
      return { ...base, artifactPath, reply };
    }

    if (normalizedRole === 'executor' && hasReplanMarker(workItem)) {
      const retrieval = await runTool('memory.retrieve', {
        query: workItem?.metadata?.retrievalQuery || 'standalone harness provider registry runtime adapter workspace sandbox memory retrieval replan',
        limit: 5,
      });
      const lifecycleSnapshot = await runTool('lifecycle.snapshot', { role: normalizedRole });
      const shellInspect = await runTool('shell.inspect', { role: normalizedRole });
      const hits = retrieval?.result?.hits || [];
      const addendumRel = 'artifacts/RETRIEVAL-ADDENDUM.md';
      const addendumBody = `# Retrieval Addendum\n\n## Query\n${retrieval?.result?.query || ''}\n\n## Hits\n${summarizeHits(hits)}\n\n## Why This Matters\n- provider registry should be visible in memory retrieval\n- sandbox / tool runtime evidence should be retrievable\n- lifecycle / shell injected tools should be observable\n- judge should see retrieval-backed completion evidence\n\n## Injected Tool Evidence\n- lifecycle state => ${lifecycleSnapshot?.result?.available ? 'available' : 'missing'}\n- shell state => ${shellInspect?.result?.available ? 'available' : 'missing'}\n`;
      await emitStream({ role: normalizedRole, label: 'replan.thinking', text: `收到 critic revise，开始 retrieval-based replan。`, onChunk, eventBus });
      const addendumWrite = await runTool('fs.write_text', { path: addendumRel, content: addendumBody });
      await runTool('fs.append_text', {
        path: 'artifacts/DELIVERABLE.md',
        content: `\n\n## Memory Retrieval\n${summarizeHits(hits)}\n`,
      });
      await runTool('text.search', { path: 'artifacts', query: 'Memory Retrieval' });
      await emitStream({ role: normalizedRole, label: 'replan.result', text: addendumBody, onChunk, eventBus });
      const artifactPath = addendumWrite?.result?.path || addendumRel;
      const reply = JSON.stringify({
        summary: `已完成补充执行：${objective || task}`,
        deliverables: [artifactPath, 'artifacts/DELIVERABLE.md'],
        issues: [],
        findings: ['已从 blackboard / durable memory 做 retrieval', `retrieval hits=${hits.length}`],
        retrievalHitsCount: hits.length,
        nextSteps: ['critic re-review', 'judge decision'],
        blackboardUpdate: {
          retrieval_status: 'done',
          retrieval_hits: hits.length,
          retrieval_addendum_path: artifactPath,
        },
      });
      remember(sessionKey, normalizedRole, reply);
      return { ...base, artifactPath, reply };
    }

    if (normalizedRole === 'critic') {
      const deliverableRead = await runTool('fs.read_text', { path: 'artifacts/DELIVERABLE.md' });
      const retrievalProbe = await runTool('memory.retrieve', {
        query: 'provider registry runtime adapter workspace sandbox memory retrieval',
        limit: 4,
      });
      const hasMemorySection = /## Memory Retrieval/i.test(String(deliverableRead?.result?.text || ''));
      const isReReview = hasReplanMarker(workItem);
      const verdict = (!hasMemorySection && !isReReview) ? 'revise' : 'approve_with_notes';
      const needsReplan = verdict === 'revise';
      const reviewRel = isReReview ? 'artifacts/REVIEW-REPLAN.md' : 'artifacts/REVIEW.md';
      const grepExec = await runTool('command.exec', { command: 'grep', args: ['-n', 'Memory Retrieval', 'artifacts/DELIVERABLE.md'], cwd: workspaceDir });
      const body = `# Review\n\n## Review Target\n${String(deliverableRead?.result?.text || previousSummaries || '- none').slice(0, 1200)}\n\n## Verdict\n${verdict}\n\n## Retrieval Probe\n${summarizeHits(retrievalProbe?.result?.hits || [])}\n\n## Command Probe\n${String(grepExec?.result?.stdout || grepExec?.result?.stderr || '-').slice(0, 400)}\n\n## Notes\n${needsReplan
        ? '- deliverable 缺少 Memory Retrieval 章节，需要补 retrieval 证据并 replan'
        : '- sample 已包含 retrieval-backed evidence，可通过'}\n`;
      if (eventBus?.emit) eventBus.emit({ type: 'artifact.review.writing', role: normalizedRole, path: reviewRel, verdict });
      await emitStream({ role: normalizedRole, label: 'review.thinking', text: `开始审查 deliverable。\n当前 verdict=${verdict}`, onChunk, eventBus });
      const written = await runTool('fs.write_text', { path: reviewRel, content: body });
      await emitStream({ role: normalizedRole, label: 'review.result', text: body, onChunk, eventBus });
      const artifactPath = written?.result?.path || reviewRel;
      const reply = JSON.stringify({
        summary: verdict === 'revise' ? `已完成审查：发现缺口，需要 replan` : `已完成复审：retrieval 证据已补齐`,
        verdict,
        needsReplan,
        replanReason: needsReplan ? 'deliverable 缺少 memory retrieval 证据' : '',
        issues: needsReplan ? ['missing_memory_retrieval_section'] : [],
        deliverables: [artifactPath],
        findings: needsReplan
          ? ['sample 主链可用，但缺 retrieval-backed evidence']
          : ['sample 已具备 harness 骨架，且 retrieval/replan 已真实发生'],
        blackboardUpdate: {
          review_status: verdict,
          review_path: artifactPath,
          needs_replan: needsReplan,
        },
      });
      remember(sessionKey, normalizedRole, reply);
      return { ...base, artifactPath, reply };
    }

    if (normalizedRole === 'judge') {
      const reviewRead = await runTool('fs.read_text', { path: 'artifacts/REVIEW-REPLAN.md' });
      const snapshot = await runTool('workspace.snapshot', {});
      const countExec = await runTool('command.exec', { command: 'wc', args: ['-l', 'artifacts/DELIVERABLE.md'], cwd: workspaceDir });
      const decisionRel = 'artifacts/DECISION.md';
      const body = `# Decision\n\n## Inputs\n${String(reviewRead?.result?.text || previousSummaries || '- none').slice(0, 1200)}\n\n## Decision\napprove\n\n## Reason\nThe sample demonstrates core + adapter + workspace sandbox + tool runtime + memory retrieval + replan + review loop skeleton.\n\n## Command Runtime Evidence\n${String(countExec?.result?.stdout || '-').trim() || '-'}\n\n## Durable Artifacts Count\n${durableArtifacts.length}\n\n## Workspace Files\n${(snapshot?.result?.items || []).slice(0, 16).map((x) => `- ${x.path}`).join('\n') || '- none'}\n`;
      if (eventBus?.emit) eventBus.emit({ type: 'artifact.decision.writing', role: normalizedRole, path: decisionRel });
      await emitStream({ role: normalizedRole, label: 'decision.thinking', text: '开始最终裁决。', onChunk, eventBus });
      const written = await runTool('fs.write_text', { path: decisionRel, content: body });
      await emitStream({ role: normalizedRole, label: 'decision.result', text: body, onChunk, eventBus });
      const artifactPath = written?.result?.path || decisionRel;
      const reply = JSON.stringify({
        summary: `已完成裁决：${objective || task}`,
        decision: 'approve',
        deliverables: [artifactPath],
        findings: ['sample 可作为独立最小开源 harness 样板，且包含真实 memory retrieval + replan'],
        blackboardUpdate: { decision_status: 'approved', decision_path: artifactPath },
      });
      remember(sessionKey, normalizedRole, reply);
      return { ...base, artifactPath, reply };
    }

    const genericRel = `artifacts/${normalizedRole || 'worker'}.md`;
    await emitStream({ role: normalizedRole, label: 'generic.thinking', text: `处理通用任务：${objective || task}`, onChunk, eventBus });
    const written = await runTool('fs.write_text', { path: genericRel, content: `# ${normalizedRole}\n\n${objective || task}\n` });
    const artifactPath = written?.result?.path || genericRel;
    const reply = JSON.stringify({
      summary: `已完成：${objective || task}`,
      deliverables: [artifactPath],
    });
    remember(sessionKey, normalizedRole, reply);
    return { ...base, artifactPath, reply };
  }

  async function sendToSession({ sessionKey = '', message = '' } = {}) {
    const items = sessionHistory.get(sessionKey) || [];
    items.push({ role: 'user', content: String(message || ''), ts: Date.now() });
    sessionHistory.set(sessionKey, items);
    return { ok: true, sessionKey, reply: `ACK: ${String(message || '').slice(0, 120)}` };
  }

  async function listSessionsForSession({ sessionKey = '' } = {}) {
    return { ok: true, sessionKey, sessions: sessionKey ? [{ sessionKey }] : Array.from(sessionHistory.keys()).map((key) => ({ sessionKey: key })) };
  }

  async function getSessionHistory({ sessionKey = '' } = {}) {
    return { ok: true, sessionKey, messages: sessionHistory.get(sessionKey) || [] };
  }

  return {
    provider: 'local-demo',
    kind: 'runtime_adapter',
    probeRole,
    spawnForRole,
    sendToSession,
    listSessionsForSession,
    getSessionHistory,
  };
}
