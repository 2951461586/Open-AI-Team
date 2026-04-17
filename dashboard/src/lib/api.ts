import { normalizeDashboardEnvelope, normalizeNodesEnvelope } from '@ai-team/team-core'
import { API_CONFIG, buildApiUrl } from './api-config.mjs'

export const API_BASE = String(process.env.NEXT_PUBLIC_API_BASE || '').trim() || ''
const DASHBOARD_TOKEN = process.env.NEXT_PUBLIC_DASHBOARD_TOKEN || ''

const API_V1_BASE = API_BASE.replace('/api/', '/api/v1/') || API_BASE

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
  if (explicit) {
    const sep = explicit.includes('?') ? '&' : '?'
    return DASHBOARD_TOKEN ? `${explicit}${sep}token=${encodeURIComponent(DASHBOARD_TOKEN)}` : explicit
  }
  if (!API_BASE) return ''
  const wsBase = API_BASE.replace(/^http/, 'ws').replace(/^https/, 'wss')
  const wsUrl = `${wsBase}/ws/chat`
  return DASHBOARD_TOKEN ? `${wsUrl}?token=${encodeURIComponent(DASHBOARD_TOKEN)}` : wsUrl
}

function buildUrl(path: string, params: Record<string, string | number> = {}): string {
  let url = `${API_BASE}${path}`
  for (const [key, value] of Object.entries(params)) {
    url = url.replace(`:${key}`, encodeURIComponent(String(value)))
  }
  return url
}

function buildV1Url(path: string, params: Record<string, string | number> = {}): string {
  let url = `${API_V1_BASE}${path}`
  for (const [key, value] of Object.entries(params)) {
    url = url.replace(`:${key}`, encodeURIComponent(String(value)))
  }
  return url
}

export async function fetchDashboard(limit = 50, cursor = 0): Promise<Response> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor > 0) params.set('cursor', String(cursor))
  try {
    const url = `${API_V1_BASE}/state/team?${params}`
    const res = await fetch(url, {
      cache: 'no-store',
      mode: 'cors',
      headers: authHeaders(),
    })
    if (!res.ok) return res
    const json = await res.json().catch(() => null)
    if (!json || typeof json !== 'object') {
      return new Response(JSON.stringify(json), {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      })
    }
    const normalized = normalizeDashboardEnvelope(json)
    return new Response(JSON.stringify(normalized), {
      status: res.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  } catch (error) {
    console.error('Dashboard fetch error:', error)
    throw error
  }
}

export async function fetchNodes(): Promise<Response> {
  try {
    const res = await fetch(buildV1Url('/state/team/nodes'), {
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
    const normalized = normalizeNodesEnvelope(json, {
      canonicalLabels: { 'node-a': 'Local', 'node-b': 'Observer', 'node-c': 'Review' },
    })
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
    return await fetch(buildV1Url('/state/team/contracts'), {
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
    return await fetch(buildV1Url('/state/team/artifacts', { taskId }) + `&limit=${limit}`, {
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
    return await fetch(buildUrl('/state/team/artifact-file', { artifactId }), {
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
    return await fetch(buildV1Url('/state/team/workbench', { taskId }), {
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
    return await fetch(buildV1Url('/state/team/summary', { taskId }), {
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
    return await fetch(buildV1Url('/state/team/control', { taskId }), {
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
    return await fetch(buildV1Url('/state/team/pipeline', { taskId }), {
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
    return await fetch(buildV1Url('/state/team/archive') + `?limit=${limit}`, {
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
    return await fetch(buildV1Url('/state/team/evidence', { taskId }) + `&limit=${limit}`, {
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
    return await fetch(buildV1Url('/state/team/mailbox', { taskId }) + `&limit=${limit}`, {
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
    return await fetch(buildV1Url('/team/tasks/:taskId/control', { taskId }), {
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
    return await fetch(buildV1Url('/state/team/residents') + `?teamId=${encodeURIComponent(teamId)}&ensure=true`, {
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
    return await fetch(buildV1Url('/team/chat/task'), {
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
    return await fetch(buildV1Url('/team/tasks/:taskId/files', { taskId }), {
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
  const query = taskId ? `?taskId=${encodeURIComponent(taskId)}` : ''
  try {
    return await fetch(buildV1Url('/state/team/threads') + query, {
      cache: 'no-store',
      mode: 'cors',
      headers: authHeaders(),
    })
  } catch (error) {
    console.error('Threads fetch error:', error)
    throw error
  }
}

export async function fetchThreadSummary(threadId: string): Promise<Response> {
  try {
    return await fetch(buildUrl('/state/team/thread-summary', { threadId }), {
      cache: 'no-store',
      mode: 'cors',
      headers: authHeaders(),
    })
  } catch (error) {
    console.error('Thread summary fetch error:', error)
    throw error
  }
}

export async function fetchWorkbenchState(taskId: string): Promise<Response> {
  return fetchWorkbench(taskId)
}

export async function submitWorkbenchApproval(taskId: string, action: 'approve' | 'reject' | 'request_revision', reason = ''): Promise<Response> {
  return await fetch(buildV1Url('/team/tasks/:taskId/control', { taskId }), {
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
    return await fetch(buildV1Url('/state/team/agents') + (query ? `?${query}` : ''), {
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
    return await fetch(buildV1Url('/state/team/agents') + '?activeOnly=false', {
      cache: 'no-store',
      mode: 'cors',
      headers: authHeaders(),
    })
  } catch (error) {
    console.error('Agent lifecycle fetch error:', error)
    throw error
  }
}
