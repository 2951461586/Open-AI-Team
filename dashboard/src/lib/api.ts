const DEFAULT_LOCAL_API_BASE = 'http://127.0.0.1:19090'

export const API_BASE = String(process.env.NEXT_PUBLIC_API_BASE || '').trim() || DEFAULT_LOCAL_API_BASE

const DASHBOARD_TOKEN = process.env.NEXT_PUBLIC_DASHBOARD_TOKEN || ''

function authHeaders(): Record<string, string> {
  if (!DASHBOARD_TOKEN) return {}
  return {
    'Authorization': `Bearer ${DASHBOARD_TOKEN}`,
    'x-dashboard-token': DASHBOARD_TOKEN,
  }
}

export function getAuthHeaders(): Record<string, string> {
  return authHeaders()
}

export function getWsUrl(): string {
  const realtimeEnabled = String(process.env.NEXT_PUBLIC_ENABLE_REALTIME || '').trim() === '1'
  if (!realtimeEnabled) return ''
  const explicit = String(process.env.NEXT_PUBLIC_WS_URL || '').trim()
  if (!explicit) return ''
  if (!DASHBOARD_TOKEN) return explicit
  const sep = explicit.includes('?') ? '&' : '?'
  return `${explicit}${sep}token=${encodeURIComponent(DASHBOARD_TOKEN)}`
}

type TaskState =
  | 'pending'
  | 'planning'
  | 'plan_review'
  | 'approved'
  | 'revision_requested'
  | 'done'
  | 'cancelled'
  | 'blocked'

function normalizeTaskState(state?: string): TaskState {
  const raw = String(state || '').trim()
  const allowed: TaskState[] = ['pending', 'planning', 'plan_review', 'approved', 'revision_requested', 'done', 'cancelled', 'blocked']
  return (allowed as string[]).includes(raw) ? (raw as TaskState) : 'pending'
}

function normalizeTaskCard(raw: any) {
  return {
    taskId: String(raw?.taskId || raw?.id || '').trim(),
    teamId: String(raw?.teamId || ''),
    title: String(raw?.title || '未命名任务'),
    state: normalizeTaskState(raw?.state),
    updatedAt: Number(raw?.updatedAt || raw?.createdAt || 0),
    currentDriver: String(raw?.currentDriver || raw?.ownerMemberId || ''),
    currentMemberKey: String(raw?.currentMemberKey || ''),
    nextBestAction: String(raw?.nextBestAction || ''),
    latestReviewVerdict: raw?.latestReviewVerdict || null,
    latestDecisionType: raw?.latestDecisionType || null,
    artifactCount: Number(raw?.artifactCount || 0),
    evidenceCount: Number(raw?.evidenceCount || 0),
    issueCount: Number(raw?.issueCount || 0),
    deliverableReady: Boolean(raw?.deliverableReady),
    humanInterventionReady: Boolean(raw?.humanInterventionReady),
    deliveryStatus: String(raw?.deliveryStatus || ''),
    interventionStatus: String(raw?.interventionStatus || ''),
    requestedNode: String(raw?.requestedNode || ''),
    actualNode: String(raw?.actualNode || ''),
    degradedReason: String(raw?.degradedReason || ''),
    sessionMode: String(raw?.sessionMode || ''),
    sessionPersistent: typeof raw?.sessionPersistent === 'boolean' ? raw.sessionPersistent : undefined,
    sessionFallbackReason: String(raw?.sessionFallbackReason || ''),
    planSummary: String(raw?.planSummary || ''),
    executiveSummary: String(raw?.executiveSummary || ''),
    protocolSource: String(raw?.protocolSource || ''),
    acceptanceState: String(raw?.acceptanceState || ''),
    recommendedSurface: String(raw?.recommendedSurface || ''),
  }
}

function normalizeNodeStats(raw: any = {}) {
  return {
    ...raw,
    controlPlaneOk: typeof raw?.controlPlaneOk === 'boolean' ? raw.controlPlaneOk : raw?.openclawOk,
    controlPlaneStatus: String(raw?.controlPlaneStatus || raw?.openclawStatus || ''),
  }
}

function normalizeConnectivity(raw: any = {}) {
  return {
    ...raw,
    controlBaseUrl: String(raw?.controlBaseUrl || raw?.gatewayBaseUrl || ''),
    controlHost: String(raw?.controlHost || raw?.gatewayHost || ''),
    controlPort: Number(raw?.controlPort || raw?.gatewayPort || 0) || undefined,
  }
}

export async function fetchDashboard(limit = 50, cursor = 0): Promise<Response> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor > 0) params.set('cursor', String(cursor))
  try {
    return await fetch(`${API_BASE}/state/team/dashboard?${params}`, {
      cache: 'no-store',
      mode: 'cors',
      headers: authHeaders(),
    })
  } catch (error) {
    console.error('Dashboard fetch error:', error)
    throw error
  }
}

export async function fetchNodes(): Promise<Response> {
  try {
    const res = await fetch(`${API_BASE}/state/team/nodes`, {
      cache: 'no-store',
      mode: 'cors',
    })
    if (!res.ok) return res
    const json = await res.json().catch(() => null)
    if (!json || typeof json !== 'object') {
      return new Response(JSON.stringify(json), {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      })
    }
    const payload = json?.payload || json
    const nodes = payload?.nodes && typeof payload.nodes === 'object'
      ? Object.fromEntries(Object.entries(payload.nodes).map(([key, value]: [string, any]) => {
          if (key === 'ts' || !value || typeof value !== 'object') return [key, value]
          return [key, {
            ...value,
            stats: normalizeNodeStats(value?.stats || {}),
            connectivity: normalizeConnectivity(value?.connectivity || {}),
          }]
        }))
      : payload?.nodes
    const normalized = {
      ...json,
      payload: {
        ...payload,
        nodes,
      },
    }
    return new Response(JSON.stringify(normalized), {
      status: res.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  } catch (error) {
    console.error('Nodes fetch error:', error)
    throw error
  }
}

export async function fetchContracts(): Promise<Response> {
  try {
    return await fetch(`${API_BASE}/state/team/contracts`, {
      cache: 'no-store',
      mode: 'cors',
      headers: authHeaders(),
    })
  } catch (error) {
    console.error('Contracts fetch error:', error)
    throw error
  }
}

export async function fetchTaskArtifacts(taskId: string, limit = 200): Promise<Response> {
  try {
    return await fetch(`${API_BASE}/state/team/artifacts?taskId=${encodeURIComponent(taskId)}&limit=${limit}`, {
      cache: 'no-store',
      mode: 'cors',
      headers: authHeaders(),
    })
  } catch (error) {
    console.error('Artifacts fetch error:', error)
    throw error
  }
}

export async function fetchTaskArtifactFile(artifactId: string): Promise<Response> {
  try {
    return await fetch(`${API_BASE}/state/team/artifact-file?artifactId=${encodeURIComponent(artifactId)}`, {
      cache: 'no-store',
      mode: 'cors',
      headers: authHeaders(),
    })
  } catch (error) {
    console.error('Artifact file fetch error:', error)
    throw error
  }
}

export async function fetchWorkbench(taskId: string): Promise<Response> {
  try {
    return await fetch(`${API_BASE}/state/team/workbench?taskId=${encodeURIComponent(taskId)}`, {
      cache: 'no-store',
      mode: 'cors',
      headers: authHeaders(),
    })
  } catch (error) {
    console.error('Workbench fetch error:', error)
    throw error
  }
}

export async function fetchSummary(taskId: string): Promise<Response> {
  try {
    return await fetch(`${API_BASE}/state/team/summary?taskId=${encodeURIComponent(taskId)}`, {
      cache: 'no-store',
      mode: 'cors',
      headers: authHeaders(),
    })
  } catch (error) {
    console.error('Summary fetch error:', error)
    throw error
  }
}

export async function fetchControl(taskId: string): Promise<Response> {
  try {
    return await fetch(`${API_BASE}/state/team/control?taskId=${encodeURIComponent(taskId)}`, {
      cache: 'no-store',
      mode: 'cors',
      headers: authHeaders(),
    })
  } catch (error) {
    console.error('Control fetch error:', error)
    throw error
  }
}

export async function fetchPipeline(taskId: string): Promise<Response> {
  try {
    return await fetch(`${API_BASE}/state/team/pipeline?taskId=${encodeURIComponent(taskId)}`, {
      cache: 'no-store',
      mode: 'cors',
      headers: authHeaders(),
    })
  } catch (error) {
    console.error('Pipeline fetch error:', error)
    throw error
  }
}

export async function fetchArchive(limit = 100): Promise<Response> {
  try {
    return await fetch(`${API_BASE}/state/team/archive?limit=${limit}`, {
      cache: 'no-store',
      mode: 'cors',
      headers: authHeaders(),
    })
  } catch (error) {
    console.error('Archive fetch error:', error)
    throw error
  }
}

export async function fetchTaskEvidence(taskId: string, limit = 200): Promise<Response> {
  try {
    return await fetch(`${API_BASE}/state/team/evidence?taskId=${encodeURIComponent(taskId)}&limit=${limit}`, {
      cache: 'no-store',
      mode: 'cors',
      headers: authHeaders(),
    })
  } catch (error) {
    console.error('Evidence fetch error:', error)
    throw error
  }
}

export async function fetchTimeline(taskId: string, limit = 100): Promise<Response> {
  try {
    return await fetch(`${API_BASE}/state/team/mailbox?taskId=${encodeURIComponent(taskId)}&limit=${limit}`, {
      cache: 'no-store',
      mode: 'cors',
      headers: authHeaders(),
    })
  } catch (error) {
    console.error('Timeline fetch error:', error)
    throw error
  }
}

export async function postTaskAction(taskId: string, action: string, reason = ''): Promise<Response> {
  try {
    return await fetch(`${API_BASE}/api/dashboard/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ taskId, action, reason }),
    })
  } catch (error) {
    console.error('Task action error:', error)
    throw error
  }
}

export async function fetchResidents(teamId: string): Promise<Response> {
  try {
    return await fetch(`${API_BASE}/state/team/residents?teamId=${encodeURIComponent(teamId)}&ensure=true`, {
      cache: 'no-store',
      mode: 'cors',
      headers: authHeaders(),
    })
  } catch (error) {
    console.error('Residents fetch error:', error)
    throw error
  }
}

export async function sendTaskChat(
  taskId: string,
  text: string,
  target?: string,
  options?: {
    intent?: 'followup' | 'retry' | 'replan'
    targetRole?: string
    assignmentId?: string
    childTaskId?: string
  }
): Promise<Response> {
  try {
    const body: Record<string, string> = { taskId, text }
    if (target) body.target = target
    if (options?.intent) body.intent = options.intent
    if (options?.targetRole) body.targetRole = options.targetRole
    if (options?.assignmentId) body.assignmentId = options.assignmentId
    if (options?.childTaskId) body.childTaskId = options.childTaskId
    return await fetch(`${API_BASE}/api/chat/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    })
  } catch (error) {
    console.error('Task chat error:', error)
    throw error
  }
}

export async function fetchTaskFiles(taskId: string): Promise<Response> {
  try {
    return await fetch(`${API_BASE}/api/task/${encodeURIComponent(taskId)}/files`, {
      cache: 'no-store',
      mode: 'cors',
      headers: authHeaders(),
    })
  } catch (error) {
    console.error('Task files fetch error:', error)
    throw error
  }
}

export async function fetchThreads(taskId?: string): Promise<Response> {
  const params = new URLSearchParams()
  if (taskId) params.set('taskId', taskId)
  const query = params.toString()
  return await fetch(`${API_BASE}/state/team/threads${query ? `?${query}` : ''}`, {
    cache: 'no-store',
    mode: 'cors',
    headers: authHeaders(),
  })
}

export async function fetchThreadSummary(threadId: string): Promise<Response> {
  return await fetch(`${API_BASE}/state/team/thread-summary?threadId=${encodeURIComponent(threadId)}`, {
    cache: 'no-store',
    mode: 'cors',
    headers: authHeaders(),
  })
}

export async function fetchWorkbenchState(taskId: string): Promise<Response> {
  return await fetch(`${API_BASE}/state/team/workbench?taskId=${encodeURIComponent(taskId)}`, {
    cache: 'no-store',
    mode: 'cors',
    headers: authHeaders(),
  })
}

export async function submitWorkbenchApproval(taskId: string, action: 'approve' | 'reject' | 'request_revision', reason = ''): Promise<Response> {
  return await fetch(`${API_BASE}/api/dashboard/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      taskId,
      action: action === 'approve' ? 'mark_done' : action === 'reject' ? 'cancel' : 'request_replan',
      reason,
    }),
  })
}

export async function fetchWorkbenchArtifacts(taskId: string): Promise<Response> {
  return fetchTaskArtifacts(taskId)
}

export async function fetchWorkbenchEvidence(taskId: string): Promise<Response> {
  return fetchTaskEvidence(taskId)
}

// ─── Agent Lifecycle ────────────────────────────────────────────────

export interface AgentInfo {
  memberId: string
  role: string
  node?: string
  preferredNode?: string
  status?: string
  taskId?: string
  teamId?: string
  childSessionKey?: string
  runId?: string
  degraded?: boolean
  degradedReason?: string
  leaseMs?: number
  leaseUntil?: number
  lastHeartbeat?: number
  mailboxKind?: string
}

export interface AgentLifecycleData {
  agents: AgentInfo[]
  stats?: {
    count: number
    activeCount: number
    drainingCount: number
    byRole: Record<string, number>
    byNode: Record<string, number>
  }
  config?: Record<string, any>
}

export async function fetchAgents(opts?: { role?: string; node?: string; activeOnly?: boolean }): Promise<Response> {
  const params = new URLSearchParams()
  if (opts?.role) params.set('role', opts.role)
  if (opts?.node) params.set('node', opts.node)
  if (opts?.activeOnly) params.set('activeOnly', 'true')
  const query = params.toString()
  try {
    return await fetch(`${API_BASE}/state/team/agents${query ? `?${query}` : ''}`, {
      cache: 'no-store',
      mode: 'cors',
      headers: authHeaders(),
    })
  } catch (error) {
    console.error('Agents fetch error:', error)
    throw error
  }
}

export async function fetchAgentLifecycle(): Promise<Response> {
  try {
    return await fetch(`${API_BASE}/state/team/agents?activeOnly=false`, {
      cache: 'no-store',
      mode: 'cors',
      headers: authHeaders(),
    })
  } catch (error) {
    console.error('Agent lifecycle fetch error:', error)
    throw error
  }
}
