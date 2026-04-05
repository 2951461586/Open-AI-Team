import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function nowMs() {
  return Date.now();
}

function safeJsonParse(s, fallback) {
  try { return JSON.parse(String(s || '')); } catch { return fallback; }
}

function toJson(v, fallback = {}) {
  try { return JSON.stringify(v ?? fallback); } catch { return JSON.stringify(fallback); }
}

export function openTeamStore(dbPath) {
  const abs = path.resolve(dbPath);
  const dir = path.dirname(abs);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new DatabaseSync(abs);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 10000;

    CREATE TABLE IF NOT EXISTS teams (
      team_id TEXT PRIMARY KEY,
      scope_key TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_teams_scope ON teams(scope_key, created_at DESC);

    CREATE TABLE IF NOT EXISTS team_members (
      member_id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      agent_ref TEXT NOT NULL,
      role TEXT NOT NULL,
      capabilities_json TEXT NOT NULL,
      status TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id, role);

    CREATE TABLE IF NOT EXISTS team_tasks (
      task_id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      parent_task_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      state TEXT NOT NULL,
      owner_member_id TEXT NOT NULL DEFAULT '',
      priority INTEGER NOT NULL DEFAULT 0,
      dependencies_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_team_tasks_team ON team_tasks(team_id, state, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_team_tasks_owner ON team_tasks(owner_member_id, state, updated_at DESC);

    CREATE TABLE IF NOT EXISTS team_task_claims (
      claim_id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      lease_until INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_team_task_claims_task ON team_task_claims(task_id, status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS team_plans (
      plan_id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      author_member_id TEXT NOT NULL,
      member_key TEXT NOT NULL DEFAULT '',
      contract_version TEXT NOT NULL DEFAULT '',
      output_type TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL,
      summary TEXT NOT NULL,
      steps_json TEXT NOT NULL,
      subtasks_json TEXT NOT NULL DEFAULT '[]',
      risks_json TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_team_plans_task ON team_plans(task_id, version DESC);

    CREATE TABLE IF NOT EXISTS team_reviews (
      review_id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      reviewer_member_id TEXT NOT NULL,
      member_key TEXT NOT NULL DEFAULT '',
      contract_version TEXT NOT NULL DEFAULT '',
      output_type TEXT NOT NULL DEFAULT '',
      score REAL NOT NULL DEFAULT 0,
      verdict TEXT NOT NULL,
      issues_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_team_reviews_task ON team_reviews(task_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_team_reviews_target ON team_reviews(target_type, target_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS team_decisions (
      decision_id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      judge_member_id TEXT NOT NULL,
      member_key TEXT NOT NULL DEFAULT '',
      contract_version TEXT NOT NULL DEFAULT '',
      output_type TEXT NOT NULL DEFAULT '',
      decision_type TEXT NOT NULL,
      reason TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_team_decisions_task ON team_decisions(task_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS team_mailbox (
      message_id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      task_id TEXT NOT NULL DEFAULT '',
      thread_id TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL,
      from_member_id TEXT NOT NULL,
      to_member_id TEXT NOT NULL DEFAULT '',
      broadcast INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      delivered_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_team_mailbox_team ON team_mailbox(team_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_team_mailbox_task ON team_mailbox(task_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_team_mailbox_to ON team_mailbox(to_member_id, status, created_at DESC);

    CREATE TABLE IF NOT EXISTS team_blackboard (
      entry_id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      section TEXT NOT NULL,
      entry_key TEXT NOT NULL,
      value_json TEXT NOT NULL,
      version INTEGER NOT NULL,
      author_member_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_team_blackboard_key ON team_blackboard(task_id, section, entry_key, version);
    CREATE INDEX IF NOT EXISTS idx_team_blackboard_task ON team_blackboard(task_id, section, updated_at DESC);

    CREATE TABLE IF NOT EXISTS team_artifacts (
      artifact_id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      role TEXT NOT NULL,
      ref_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      body_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_team_artifacts_task ON team_artifacts(task_id, artifact_type, updated_at DESC);

    CREATE TABLE IF NOT EXISTS team_evidence (
      evidence_id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      evidence_type TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      detail_json TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_team_evidence_task ON team_evidence(task_id, evidence_type, created_at DESC);
  `);

  try { db.exec("ALTER TABLE teams ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}'"); } catch {}
  try { db.exec("ALTER TABLE team_members ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}'"); } catch {}
  try { db.exec("ALTER TABLE team_plans ADD COLUMN member_key TEXT NOT NULL DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE team_plans ADD COLUMN contract_version TEXT NOT NULL DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE team_plans ADD COLUMN output_type TEXT NOT NULL DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE team_plans ADD COLUMN subtasks_json TEXT NOT NULL DEFAULT '[]'"); } catch {}
  try { db.exec("ALTER TABLE team_reviews ADD COLUMN member_key TEXT NOT NULL DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE team_reviews ADD COLUMN contract_version TEXT NOT NULL DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE team_reviews ADD COLUMN output_type TEXT NOT NULL DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE team_decisions ADD COLUMN member_key TEXT NOT NULL DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE team_decisions ADD COLUMN contract_version TEXT NOT NULL DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE team_decisions ADD COLUMN output_type TEXT NOT NULL DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE team_artifacts ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}'"); } catch {}

  // P1.2: Heartbeat / lease columns on team_members
  try { db.exec("ALTER TABLE team_members ADD COLUMN lease_until INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE team_members ADD COLUMN last_heartbeat_at INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE team_members ADD COLUMN actual_node TEXT NOT NULL DEFAULT ''"); } catch {}

  const st = {
    insertTeam: db.prepare(`
      INSERT INTO teams (team_id, scope_key, mode, status, metadata_json, created_at, updated_at)
      VALUES (@team_id, @scope_key, @mode, @status, @metadata_json, @created_at, @updated_at)
    `),
    getTeamById: db.prepare(`SELECT * FROM teams WHERE team_id = ? LIMIT 1`),
    listTeamsByScope: db.prepare(`SELECT * FROM teams WHERE scope_key = ? ORDER BY created_at DESC`),

    insertMember: db.prepare(`
      INSERT INTO team_members (member_id, team_id, agent_ref, role, capabilities_json, status, metadata_json, created_at, updated_at)
      VALUES (@member_id, @team_id, @agent_ref, @role, @capabilities_json, @status, @metadata_json, @created_at, @updated_at)
    `),
    listMembersByTeam: db.prepare(`SELECT * FROM team_members WHERE team_id = ? ORDER BY created_at ASC`),
    getMemberById: db.prepare(`SELECT * FROM team_members WHERE member_id = ? LIMIT 1`),
    updateMemberState: db.prepare(`
      UPDATE team_members
      SET status = @status,
          metadata_json = @metadata_json,
          updated_at = @updated_at
      WHERE member_id = @member_id
    `),

    insertTask: db.prepare(`
      INSERT INTO team_tasks (
        task_id, team_id, parent_task_id, title, description, state, owner_member_id,
        priority, dependencies_json, metadata_json, created_at, updated_at
      ) VALUES (
        @task_id, @team_id, @parent_task_id, @title, @description, @state, @owner_member_id,
        @priority, @dependencies_json, @metadata_json, @created_at, @updated_at
      )
    `),
    getTaskById: db.prepare(`SELECT * FROM team_tasks WHERE task_id = ? LIMIT 1`),
    listTasksByTeam: db.prepare(`SELECT * FROM team_tasks WHERE team_id = ? ORDER BY created_at DESC`),
    listRecentTasks: db.prepare(`SELECT * FROM team_tasks ORDER BY updated_at DESC LIMIT ?`),
    listRecentTasksBefore: db.prepare(`SELECT * FROM team_tasks WHERE updated_at < ? ORDER BY updated_at DESC LIMIT ?`),
    countNonChatTasks: db.prepare(`SELECT COUNT(*) as cnt FROM team_tasks WHERE team_id NOT LIKE 'team:chat:%' AND task_id NOT LIKE 'task:chat:%'`),
    updateTaskState: db.prepare(`
      UPDATE team_tasks
      SET state = @state,
          owner_member_id = COALESCE(NULLIF(@owner_member_id, ''), owner_member_id),
          updated_at = @updated_at
      WHERE task_id = @task_id
    `),
    updateTaskMetadata: db.prepare(`
      UPDATE team_tasks
      SET metadata_json = @metadata_json,
          updated_at = @updated_at
      WHERE task_id = @task_id
    `),

    insertClaim: db.prepare(`
      INSERT INTO team_task_claims (claim_id, task_id, member_id, lease_until, status, created_at, updated_at)
      VALUES (@claim_id, @task_id, @member_id, @lease_until, @status, @created_at, @updated_at)
    `),
    releaseClaimById: db.prepare(`
      UPDATE team_task_claims SET status = @status, updated_at = @updated_at WHERE claim_id = @claim_id
    `),
    getClaimById: db.prepare(`SELECT * FROM team_task_claims WHERE claim_id = ? LIMIT 1`),
    listClaimsByTask: db.prepare(`SELECT * FROM team_task_claims WHERE task_id = ? ORDER BY created_at DESC`),

    insertPlan: db.prepare(`
      INSERT INTO team_plans (plan_id, task_id, author_member_id, member_key, contract_version, output_type, version, summary, steps_json, subtasks_json, risks_json, status, created_at, updated_at)
      VALUES (@plan_id, @task_id, @author_member_id, @member_key, @contract_version, @output_type, @version, @summary, @steps_json, @subtasks_json, @risks_json, @status, @created_at, @updated_at)
    `),
    latestPlanByTask: db.prepare(`SELECT * FROM team_plans WHERE task_id = ? ORDER BY version DESC, created_at DESC LIMIT 1`),
    getPlanById: db.prepare(`SELECT * FROM team_plans WHERE plan_id = ? LIMIT 1`),

    insertReview: db.prepare(`
      INSERT INTO team_reviews (review_id, task_id, target_type, target_id, reviewer_member_id, member_key, contract_version, output_type, score, verdict, issues_json, created_at)
      VALUES (@review_id, @task_id, @target_type, @target_id, @reviewer_member_id, @member_key, @contract_version, @output_type, @score, @verdict, @issues_json, @created_at)
    `),
    listReviewsByTask: db.prepare(`SELECT * FROM team_reviews WHERE task_id = ? ORDER BY created_at DESC`),

    insertDecision: db.prepare(`
      INSERT INTO team_decisions (decision_id, task_id, judge_member_id, member_key, contract_version, output_type, decision_type, reason, payload_json, created_at)
      VALUES (@decision_id, @task_id, @judge_member_id, @member_key, @contract_version, @output_type, @decision_type, @reason, @payload_json, @created_at)
    `),
    listDecisionsByTask: db.prepare(`SELECT * FROM team_decisions WHERE task_id = ? ORDER BY created_at DESC`),

    insertMailboxMessage: db.prepare(`
      INSERT INTO team_mailbox (
        message_id, team_id, task_id, thread_id, kind, from_member_id, to_member_id,
        broadcast, payload_json, status, created_at, delivered_at
      ) VALUES (
        @message_id, @team_id, @task_id, @thread_id, @kind, @from_member_id, @to_member_id,
        @broadcast, @payload_json, @status, @created_at, @delivered_at
      )
    `),
    listMailboxByTeam: db.prepare(`SELECT * FROM team_mailbox WHERE team_id = ? ORDER BY created_at DESC LIMIT ?`),
    listMailboxByMember: db.prepare(`
      SELECT * FROM team_mailbox
      WHERE team_id = ?
        AND (
          broadcast = 1
          OR to_member_id = ?
          OR to_member_id = ''
        )
      ORDER BY created_at DESC
      LIMIT ?
    `),

    upsertBlackboard: db.prepare(`
      INSERT INTO team_blackboard (
        entry_id, team_id, task_id, section, entry_key, value_json, version, author_member_id, created_at, updated_at
      ) VALUES (
        @entry_id, @team_id, @task_id, @section, @entry_key, @value_json, @version, @author_member_id, @created_at, @updated_at
      )
      ON CONFLICT(task_id, section, entry_key, version) DO UPDATE SET
        value_json = excluded.value_json,
        author_member_id = excluded.author_member_id,
        updated_at = excluded.updated_at
    `),
    listBlackboardByTask: db.prepare(`SELECT * FROM team_blackboard WHERE task_id = ? ORDER BY updated_at DESC LIMIT ?`),

    insertArtifact: db.prepare(`
      INSERT INTO team_artifacts (artifact_id, task_id, team_id, artifact_type, role, ref_id, title, body_json, metadata_json, status, created_at, updated_at)
      VALUES (@artifact_id, @task_id, @team_id, @artifact_type, @role, @ref_id, @title, @body_json, @metadata_json, @status, @created_at, @updated_at)
    `),
    listArtifactsByTask: db.prepare(`SELECT * FROM team_artifacts WHERE task_id = ? ORDER BY updated_at DESC LIMIT ?`),
    getArtifactById: db.prepare(`SELECT * FROM team_artifacts WHERE artifact_id = ? LIMIT 1`),

    insertEvidence: db.prepare(`
      INSERT INTO team_evidence (evidence_id, task_id, team_id, evidence_type, source_type, source_id, title, detail_json, severity, created_at)
      VALUES (@evidence_id, @task_id, @team_id, @evidence_type, @source_type, @source_id, @title, @detail_json, @severity, @created_at)
    `),
    listEvidenceByTask: db.prepare(`SELECT * FROM team_evidence WHERE task_id = ? ORDER BY created_at DESC LIMIT ?`),

    countTeams: db.prepare(`SELECT COUNT(1) AS c FROM teams`),
    countTasks: db.prepare(`SELECT COUNT(1) AS c FROM team_tasks`),
    countMailbox: db.prepare(`SELECT COUNT(1) AS c FROM team_mailbox`),
    countBlackboard: db.prepare(`SELECT COUNT(1) AS c FROM team_blackboard`),
    countArtifacts: db.prepare(`SELECT COUNT(1) AS c FROM team_artifacts`),
    countEvidence: db.prepare(`SELECT COUNT(1) AS c FROM team_evidence`),

    // P1.2: Heartbeat / lease statements
    renewLease: db.prepare(`
      UPDATE team_members
      SET lease_until = @lease_until,
          last_heartbeat_at = @last_heartbeat_at,
          actual_node = COALESCE(NULLIF(@actual_node, ''), actual_node),
          updated_at = @updated_at
      WHERE member_id = @member_id
    `),
    expireLeases: db.prepare(`
      UPDATE team_members
      SET status = 'expired',
          updated_at = @now_ms
      WHERE lease_until > 0
        AND lease_until < @now_ms
        AND status NOT IN ('expired', 'offline')
    `),
    getActiveResidents: db.prepare(`
      SELECT * FROM team_members
      WHERE lease_until > @now_ms
      ORDER BY last_heartbeat_at DESC
    `),
    getActiveResidentsByNode: db.prepare(`
      SELECT * FROM team_members
      WHERE lease_until > @now_ms
        AND actual_node = @node
      ORDER BY last_heartbeat_at DESC
    `),
  };

  function mapTeam(row) {
    if (!row) return null;
    return {
      teamId: row.team_id,
      scopeKey: row.scope_key,
      mode: row.mode,
      status: row.status,
      metadata: safeJsonParse(row.metadata_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function mapMember(row) {
    if (!row) return null;
    return {
      memberId: row.member_id,
      teamId: row.team_id,
      agentRef: row.agent_ref,
      role: row.role,
      capabilities: safeJsonParse(row.capabilities_json, []),
      status: row.status,
      metadata: safeJsonParse(row.metadata_json, {}),
      leaseUntil: Number(row.lease_until || 0),
      lastHeartbeatAt: Number(row.last_heartbeat_at || 0),
      actualNode: String(row.actual_node || ''),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function mapTask(row) {
    if (!row) return null;
    return {
      taskId: row.task_id,
      teamId: row.team_id,
      parentTaskId: row.parent_task_id,
      title: row.title,
      description: row.description,
      state: row.state,
      ownerMemberId: row.owner_member_id,
      priority: Number(row.priority || 0),
      dependencies: safeJsonParse(row.dependencies_json, []),
      metadata: safeJsonParse(row.metadata_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function mapClaim(row) {
    if (!row) return null;
    return {
      claimId: row.claim_id,
      taskId: row.task_id,
      memberId: row.member_id,
      leaseUntil: Number(row.lease_until || 0),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function mapPlan(row) {
    if (!row) return null;
    return {
      planId: row.plan_id,
      taskId: row.task_id,
      authorMemberId: row.author_member_id,
      memberKey: row.member_key,
      contractVersion: row.contract_version,
      outputType: row.output_type,
      version: Number(row.version || 1),
      summary: row.summary,
      steps: safeJsonParse(row.steps_json, []),
      subtasks: safeJsonParse(row.subtasks_json, []),
      risks: safeJsonParse(row.risks_json, []),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function mapReview(row) {
    if (!row) return null;
    return {
      reviewId: row.review_id,
      taskId: row.task_id,
      targetType: row.target_type,
      targetId: row.target_id,
      reviewerMemberId: row.reviewer_member_id,
      memberKey: row.member_key,
      contractVersion: row.contract_version,
      outputType: row.output_type,
      score: Number(row.score || 0),
      verdict: row.verdict,
      issues: safeJsonParse(row.issues_json, []),
      createdAt: row.created_at,
    };
  }

  function mapDecision(row) {
    if (!row) return null;
    return {
      decisionId: row.decision_id,
      taskId: row.task_id,
      judgeMemberId: row.judge_member_id,
      memberKey: row.member_key,
      contractVersion: row.contract_version,
      outputType: row.output_type,
      decisionType: row.decision_type,
      reason: row.reason,
      payload: safeJsonParse(row.payload_json, {}),
      createdAt: row.created_at,
    };
  }

  function mapMailbox(row) {
    if (!row) return null;
    return {
      messageId: row.message_id,
      teamId: row.team_id,
      taskId: row.task_id,
      threadId: row.thread_id,
      kind: row.kind,
      fromMemberId: row.from_member_id,
      toMemberId: row.to_member_id,
      broadcast: !!row.broadcast,
      payload: safeJsonParse(row.payload_json, {}),
      status: row.status,
      createdAt: row.created_at,
      deliveredAt: row.delivered_at,
    };
  }

  function mapBlackboard(row) {
    if (!row) return null;
    return {
      entryId: row.entry_id,
      teamId: row.team_id,
      taskId: row.task_id,
      section: row.section,
      entryKey: row.entry_key,
      value: safeJsonParse(row.value_json, {}),
      version: Number(row.version || 1),
      authorMemberId: row.author_member_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function mapArtifact(row) {
    if (!row) return null;
    return {
      artifactId: row.artifact_id,
      taskId: row.task_id,
      teamId: row.team_id,
      artifactType: row.artifact_type,
      role: row.role,
      refId: row.ref_id,
      title: row.title,
      body: safeJsonParse(row.body_json, {}),
      metadata: safeJsonParse(row.metadata_json, {}),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function mapEvidence(row) {
    if (!row) return null;
    return {
      evidenceId: row.evidence_id,
      taskId: row.task_id,
      teamId: row.team_id,
      evidenceType: row.evidence_type,
      sourceType: row.source_type,
      sourceId: row.source_id,
      title: row.title,
      detail: safeJsonParse(row.detail_json, {}),
      severity: row.severity,
      createdAt: row.created_at,
    };
  }

  function createTeam(input = {}) {
    const ts = nowMs();
    const row = {
      team_id: String(input.teamId || input.team_id || ''),
      scope_key: String(input.scopeKey || input.scope_key || ''),
      mode: String(input.mode || 'general'),
      status: String(input.status || 'active'),
      metadata_json: toJson(input.metadata || {}),
      created_at: Number(input.createdAt || ts),
      updated_at: Number(input.updatedAt || ts),
    };
    st.insertTeam.run(row);
    return mapTeam(row);
  }

  function getTeamById(teamId) {
    return mapTeam(st.getTeamById.get(String(teamId || '')));
  }

  function listTeamsByScope(scopeKey) {
    return st.listTeamsByScope.all(String(scopeKey || '')).map(mapTeam);
  }

  function createMember(input = {}) {
    const ts = nowMs();
    const row = {
      member_id: String(input.memberId || ''),
      team_id: String(input.teamId || ''),
      agent_ref: String(input.agentRef || input.role || ''),
      role: String(input.role || ''),
      capabilities_json: toJson(input.capabilities || []),
      status: String(input.status || 'idle'),
      metadata_json: toJson(input.metadata || {}),
      created_at: Number(input.createdAt || ts),
      updated_at: Number(input.updatedAt || ts),
    };
    st.insertMember.run(row);
    return mapMember(row);
  }

  function getMemberById(memberId) {
    return mapMember(st.getMemberById.get(String(memberId || '')));
  }

  function listMembersByTeam(teamId) {
    return st.listMembersByTeam.all(String(teamId || '')).map(mapMember);
  }

  function updateMemberState(input = {}) {
    const memberId = String(input.memberId || '');
    const existing = getMemberById(memberId);
    if (!existing) return null;
    const mergedMetadata = {
      ...(existing.metadata || {}),
      ...(input.metadata || {}),
    };
    const patch = {
      member_id: memberId,
      status: String(input.status || existing.status || 'idle'),
      metadata_json: JSON.stringify(mergedMetadata),
      updated_at: Number(input.updatedAt || nowMs()),
    };
    st.updateMemberState.run(patch);
    return getMemberById(memberId);
  }

  function createTask(input = {}) {
    const ts = nowMs();
    const row = {
      task_id: String(input.taskId || input.task_id || ''),
      team_id: String(input.teamId || input.team_id || ''),
      parent_task_id: String(input.parentTaskId || input.parent_task_id || ''),
      title: String(input.title || ''),
      description: String(input.description || ''),
      state: String(input.state || 'pending'),
      owner_member_id: String(input.ownerMemberId || input.owner_member_id || ''),
      priority: Number(input.priority || 0),
      dependencies_json: toJson(input.dependencies || []),
      metadata_json: toJson(input.metadata || {}),
      created_at: Number(input.createdAt || ts),
      updated_at: Number(input.updatedAt || ts),
    };
    st.insertTask.run(row);
    return mapTask(row);
  }

  function getTaskById(taskId) {
    return mapTask(st.getTaskById.get(String(taskId || '')));
  }

  function listTasksByTeam(teamId) {
    return st.listTasksByTeam.all(String(teamId || '')).map(mapTask);
  }

  function listRecentTasks(limit = 50) {
    return st.listRecentTasks.all(Number(limit || 50)).map(mapTask);
  }

  function listRecentTasksBefore(cursor, limit = 50) {
    return st.listRecentTasksBefore.all(Number(cursor), Number(limit || 50)).map(mapTask);
  }

  function countNonChatTasks() {
    const row = st.countNonChatTasks.get();
    return row?.cnt || 0;
  }

  function updateTaskState(input = {}) {
    const patch = {
      task_id: String(input.taskId || ''),
      state: String(input.state || ''),
      owner_member_id: String(input.ownerMemberId || ''),
      updated_at: Number(input.updatedAt || nowMs()),
    };
    st.updateTaskState.run(patch);
    return getTaskById(patch.task_id);
  }

  /**
   * P2: Update task metadata (merge mode).
   * Used to persist memberKey, actualNode, and other runtime metadata.
   */
  function updateTaskMetadata(input = {}) {
    const taskId = String(input.taskId || '');
    const existing = getTaskById(taskId);
    if (!existing) return null;
    const merged = { ...(existing.metadata || {}), ...(input.metadata || {}) };
    const patch = {
      task_id: taskId,
      metadata_json: JSON.stringify(merged),
      updated_at: Number(input.updatedAt || nowMs()),
    };
    st.updateTaskMetadata.run(patch);
    return getTaskById(taskId);
  }

  function claimTask(input = {}) {
    const ts = nowMs();
    const row = {
      claim_id: String(input.claimId || ''),
      task_id: String(input.taskId || ''),
      member_id: String(input.memberId || ''),
      lease_until: Number(input.leaseUntil || ts),
      status: String(input.status || 'active'),
      created_at: Number(input.createdAt || ts),
      updated_at: Number(input.updatedAt || ts),
    };
    st.insertClaim.run(row);
    return row;
  }

  function getClaimById(claimId) {
    return mapClaim(st.getClaimById.get(String(claimId || '')));
  }

  function listClaimsByTask(taskId) {
    return st.listClaimsByTask.all(String(taskId || '')).map(mapClaim);
  }

  function releaseTask(input = {}) {
    const patch = {
      claim_id: String(input.claimId || ''),
      status: String(input.status || 'released'),
      updated_at: Number(input.updatedAt || nowMs()),
    };
    st.releaseClaimById.run(patch);
    return getClaimById(patch.claim_id) || mapClaim({
      claim_id: patch.claim_id,
      task_id: '',
      member_id: '',
      lease_until: 0,
      status: patch.status,
      created_at: patch.updated_at,
      updated_at: patch.updated_at,
    });
  }

  function insertPlan(input = {}) {
    const ts = nowMs();
    const prev = st.latestPlanByTask.get(String(input.taskId || ''));
    const nextVersion = Number(input.version || ((prev?.version || 0) + 1) || 1);
    const row = {
      plan_id: String(input.planId || ''),
      task_id: String(input.taskId || ''),
      author_member_id: String(input.authorMemberId || ''),
      member_key: String(input.memberKey || ''),
      contract_version: String(input.contractVersion || ''),
      output_type: String(input.outputType || ''),
      version: nextVersion,
      summary: String(input.summary || ''),
      steps_json: toJson(input.steps || []),
      subtasks_json: toJson(input.subtasks || []),
      risks_json: toJson(input.risks || []),
      status: String(input.status || 'submitted'),
      created_at: Number(input.createdAt || ts),
      updated_at: Number(input.updatedAt || ts),
    };
    st.insertPlan.run(row);
    return mapPlan(row);
  }

  function getLatestPlanByTask(taskId) {
    return mapPlan(st.latestPlanByTask.get(String(taskId || '')));
  }

  function getPlanById(planId) {
    return mapPlan(st.getPlanById.get(String(planId || '')));
  }

  function insertReview(input = {}) {
    const row = {
      review_id: String(input.reviewId || ''),
      task_id: String(input.taskId || ''),
      target_type: String(input.targetType || ''),
      target_id: String(input.targetId || ''),
      reviewer_member_id: String(input.reviewerMemberId || ''),
      member_key: String(input.memberKey || ''),
      contract_version: String(input.contractVersion || ''),
      output_type: String(input.outputType || ''),
      score: Number(input.score || 0),
      verdict: String(input.verdict || ''),
      issues_json: toJson(input.issues || []),
      created_at: Number(input.createdAt || nowMs()),
    };
    st.insertReview.run(row);
    return mapReview(row);
  }

  function listReviewsByTask(taskId) {
    return st.listReviewsByTask.all(String(taskId || '')).map(mapReview);
  }

  function insertDecision(input = {}) {
    const decisionId = String(input.decisionId || '').trim();
    if (!decisionId) {
      throw new Error('decision_id_required');
    }
    const row = {
      decision_id: decisionId,
      task_id: String(input.taskId || ''),
      judge_member_id: String(input.judgeMemberId || ''),
      member_key: String(input.memberKey || ''),
      contract_version: String(input.contractVersion || ''),
      output_type: String(input.outputType || ''),
      decision_type: String(input.decisionType || ''),
      reason: String(input.reason || ''),
      payload_json: toJson(input.payload || {}),
      created_at: Number(input.createdAt || nowMs()),
    };
    st.insertDecision.run(row);
    return mapDecision(row);
  }

  function listDecisionsByTask(taskId) {
    return st.listDecisionsByTask.all(String(taskId || '')).map(mapDecision);
  }

  function appendMailboxMessage(input = {}) {
    const ts = nowMs();
    const row = {
      message_id: String(input.messageId || ''),
      team_id: String(input.teamId || ''),
      task_id: String(input.taskId || ''),
      thread_id: String(input.threadId || ''),
      kind: String(input.kind || ''),
      from_member_id: String(input.fromMemberId || ''),
      to_member_id: String(input.toMemberId || ''),
      broadcast: input.broadcast ? 1 : 0,
      payload_json: toJson(input.payload || {}),
      status: String(input.status || 'queued'),
      created_at: Number(input.createdAt || ts),
      delivered_at: Number(input.deliveredAt || 0),
    };
    st.insertMailboxMessage.run(row);
    return mapMailbox(row);
  }

  function listMailboxMessages({ teamId, limit = 100 } = {}) {
    return st.listMailboxByTeam.all(String(teamId || ''), Number(limit || 100)).map(mapMailbox);
  }

  function listMailboxMessagesForMember({ teamId, memberId = '', limit = 100 } = {}) {
    return st.listMailboxByMember
      .all(String(teamId || ''), String(memberId || ''), Number(limit || 100))
      .map(mapMailbox);
  }

  function upsertBlackboardEntry(input = {}) {
    const ts = nowMs();
    const taskId = String(input.taskId || '');
    const section = String(input.section || '');
    const entryKey = String(input.entryKey || '');
    const version = Number(input.version || 1);
    const derivedEntryId = `bb:${taskId}:${section}:${entryKey}:${version}`;
    const row = {
      entry_id: String(input.entryId || derivedEntryId),
      team_id: String(input.teamId || ''),
      task_id: taskId,
      section,
      entry_key: entryKey,
      value_json: toJson(input.value || {}),
      version,
      author_member_id: String(input.authorMemberId || ''),
      created_at: Number(input.createdAt || ts),
      updated_at: Number(input.updatedAt || ts),
    };
    st.upsertBlackboard.run(row);
    return mapBlackboard(row);
  }

  function listBlackboardEntries({ taskId, limit = 200 } = {}) {
    return st.listBlackboardByTask.all(String(taskId || ''), Number(limit || 200)).map(mapBlackboard);
  }

  function insertArtifact(input = {}) {
    const ts = nowMs();
    const row = {
      artifact_id: String(input.artifactId || ''),
      task_id: String(input.taskId || ''),
      team_id: String(input.teamId || ''),
      artifact_type: String(input.artifactType || ''),
      role: String(input.role || ''),
      ref_id: String(input.refId || ''),
      title: String(input.title || ''),
      body_json: toJson(input.body || {}),
      metadata_json: toJson(input.metadata || {}),
      status: String(input.status || 'ready'),
      created_at: Number(input.createdAt || ts),
      updated_at: Number(input.updatedAt || ts),
    };
    st.insertArtifact.run(row);
    return mapArtifact(row);
  }

  function listArtifactsByTask({ taskId, limit = 200 } = {}) {
    return st.listArtifactsByTask.all(String(taskId || ''), Number(limit || 200)).map(mapArtifact);
  }

  function getArtifactById(artifactId) {
    const row = st.getArtifactById.get(String(artifactId || ''));
    return mapArtifact(row);
  }

  function insertEvidence(input = {}) {
    const row = {
      evidence_id: String(input.evidenceId || ''),
      task_id: String(input.taskId || ''),
      team_id: String(input.teamId || ''),
      evidence_type: String(input.evidenceType || ''),
      source_type: String(input.sourceType || ''),
      source_id: String(input.sourceId || ''),
      title: String(input.title || ''),
      detail_json: toJson(input.detail || {}),
      severity: String(input.severity || 'info'),
      created_at: Number(input.createdAt || nowMs()),
    };
    st.insertEvidence.run(row);
    return mapEvidence(row);
  }

  function listEvidenceByTask({ taskId, limit = 200 } = {}) {
    return st.listEvidenceByTask.all(String(taskId || ''), Number(limit || 200)).map(mapEvidence);
  }

  function stats() {
    return {
      teams: Number(st.countTeams.get()?.c || 0),
      tasks: Number(st.countTasks.get()?.c || 0),
      mailbox: Number(st.countMailbox.get()?.c || 0),
      blackboard: Number(st.countBlackboard.get()?.c || 0),
      artifacts: Number(st.countArtifacts.get()?.c || 0),
      evidence: Number(st.countEvidence.get()?.c || 0),
    };
  }

  // P1.2: Heartbeat / lease API functions
  function renewLease({ memberId, leaseUntil, lastHeartbeatAt, actualNode = '' } = {}) {
    const ts = nowMs();
    st.renewLease.run({
      member_id: String(memberId || ''),
      lease_until: Number(leaseUntil || 0),
      last_heartbeat_at: Number(lastHeartbeatAt || ts),
      actual_node: String(actualNode || ''),
      updated_at: ts,
    });
    return getMemberById(memberId);
  }

  function expireLeases(nowTimestamp) {
    const ts = Number(nowTimestamp || nowMs());
    return st.expireLeases.run({ now_ms: ts });
  }

  function getActiveResidents(nowTimestamp) {
    const ts = Number(nowTimestamp || nowMs());
    return st.getActiveResidents.all({ now_ms: ts }).map(mapMember);
  }

  function getActiveResidentsByNode(node, nowTimestamp) {
    const ts = Number(nowTimestamp || nowMs());
    return st.getActiveResidentsByNode.all({ now_ms: ts, node: String(node || '') }).map(mapMember);
  }

  return {
    dbPath: abs,
    db,
    createTeam,
    getTeamById,
    listTeamsByScope,
    createMember,
    getMemberById,
    listMembersByTeam,
    updateMemberState,
    createTask,
    getTaskById,
    listTasksByTeam,
    listRecentTasks,
    listRecentTasksBefore,
    countNonChatTasks,
    updateTaskState,
    updateTaskMetadata,
    claimTask,
    getClaimById,
    listClaimsByTask,
    releaseTask,
    insertPlan,
    getPlanById,
    getLatestPlanByTask,
    insertReview,
    listReviewsByTask,
    insertDecision,
    listDecisionsByTask,
    appendMailboxMessage,
    listMailboxMessages,
    listMailboxMessagesForMember,
    upsertBlackboardEntry,
    listBlackboardEntries,
    insertArtifact,
    listArtifactsByTask,
    getArtifactById,
    insertEvidence,
    listEvidenceByTask,
    stats,
    // P1.2: Heartbeat / lease
    renewLease,
    expireLeases,
    getActiveResidents,
    getActiveResidentsByNode,
  };
}
