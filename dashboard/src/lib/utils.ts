import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { TaskState } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Shared labels ──────────────────────────────────────────────────

export const NODE_LABELS: Record<string, string> = {
  'node-a': 'Node A',
  'node-b': 'Node B',
  'node-c': 'Node C',
  // Legacy fallback keys — remove once API consumers fully migrate
  laoda: 'Node A',
  authority: 'Node A',
  violet: 'Node B',
  observer: 'Node B',
  lebang: 'Node C',
  reviewer: 'Node C',
}

export function probeLabel(probe?: string): string {
  const map: Record<string, string> = {
    local_http: '本机服务探活',
    control_http: '控制面探活',
    relay_ssh: 'SSH 中继探活',
  }
  return map[String(probe || '')] || probe || '未知探测'
}

export function nodeServiceStatusLabel(opts?: { reachable?: boolean; probe?: string; controlPlaneStatus?: string }) {
  if (opts?.reachable) return '服务可达'
  if (String(opts?.controlPlaneStatus || '').toLowerCase() === 'unreachable') return '服务不可达'
  return '服务状态未知'
}

export function nodeHostStatusLabel(host?: string): string {
  return host ? '主机在线' : '主机状态未知'
}

export function probeLatencyLabel(latencyMs?: number): string {
  if (typeof latencyMs !== 'number') return '--'
  return `${latencyMs}ms`
}

export function roleLabel(role?: string): string {
  const raw = String(role || '').trim()
  const lower = raw.toLowerCase()
  const normalized = lower.split(/[.:]/)[0] || lower
  const map: Record<string, string> = {
    planner: '规划师',
    critic: '评审官',
    judge: '裁决官',
    assistant: '助理',
    executor: '执行者',
    output: '交付播报',
    runtime: '运行时',
    system: '系统',
    tl: '总控',
  }
  return map[normalized] || raw || '未分配'
}

export function threadPhaseLabel(phase?: string): string {
  const map: Record<string, string> = {
    task: '任务协作中',
    workspace: '主对话',
    planning: '规划中',
    plan_review: '评审中',
    approved: '已批准',
    revision_requested: '需修订',
    blocked: '已阻塞',
    done: '已完成',
    cancelled: '已取消',
  }
  return map[String(phase || '').trim()] || (phase ? String(phase).replaceAll('_', ' ') : '进行中')
}

export function rawPathLabel(path?: string): string {
  const value = String(path || '').trim()
  if (!value) return '未挂载'
  if (value.startsWith('/workspace/project/')) return `workspace/${value.slice('/workspace/project/'.length)}`
  if (value.startsWith('/workspace/project')) return 'workspace/'
  if (value.startsWith('/root/.openclaw/workspace/')) return `workspace/${value.slice('/root/.openclaw/workspace/'.length)}`
  if (value.startsWith('/root/.openclaw/workspace')) return 'workspace/'
  return '已挂载工作区'
}

export function nodeLabel(key: string): string {
  return NODE_LABELS[String(key || '').toLowerCase()] || key || ''
}

export function degradedReasonLabel(reason?: string): string {
  const raw = String(reason || '').trim()
  const map: Record<string, string> = {
    executor_watchdog_timeout: '远端执行超时，系统已自动切换到可用执行路径',
    executor_fallback: '原执行路径不可用，系统已自动切换到备用执行路径',
    executor_completion_not_observed_in_time: '执行结果超时未回传，系统已进入保护性降级',
  }
  if (!raw) return '—'
  if (map[raw]) return map[raw]
  if (raw.startsWith('control_spawn_fallback:')) {
    const [, node = '', detail = ''] = raw.split(':')
    return `远端会话拉起失败，已切换到 ${nodeLabel(node)} 的备用路径${detail ? `（${detail}）` : ''}`
  }
  if (raw.startsWith('gateway_spawn_fallback:')) {
    const [, node = '', detail = ''] = raw.split(':')
    return `远端网关拉起失败，已切换到 ${nodeLabel(node)} 的备用路径${detail ? `（${detail}）` : ''}`
  }
  return raw.replaceAll('_', ' ')
}

export function routeModeLabel(opts?: { requestedNode?: string; actualNode?: string; degradedReason?: string }): string {
  const requested = String(opts?.requestedNode || '').trim().toLowerCase()
  const actual = String(opts?.actualNode || '').trim().toLowerCase()
  const degraded = String(opts?.degradedReason || '').trim()
  if (!requested && !actual) return '待分配'
  if (degraded || (requested && actual && requested !== actual)) return '动态改道'
  return '直达执行'
}


export function sessionModeLabel(opts?: { sessionMode?: string; sessionPersistent?: boolean }): string {
  const mode = String(opts?.sessionMode || '').trim().toLowerCase()
  const persistent = opts?.sessionPersistent === true
  if (persistent || mode === 'session') return '持续协作'
  if (mode === 'run') return '单次执行'
  if (mode === 'legacy') return '兼容执行'
  if (mode === 'native_chat') return '即时接管'
  return mode ? mode : '待确认'
}

export function sessionCapabilityHint(opts?: { sessionMode?: string; sessionPersistent?: boolean; sessionFallbackReason?: string }): string {
  const mode = String(opts?.sessionMode || '').trim().toLowerCase()
  const persistent = opts?.sessionPersistent === true
  const reason = String(opts?.sessionFallbackReason || '').trim()
  if (persistent || mode === 'session') return '当前成员支持持续 follow-up 与多轮协作'
  if (reason.includes('thread=true is unavailable')) return '当前平台不支持 thread-bound 持续会话，后续跟进会交由总控接住'
  if (reason) return reason.replaceAll('_', ' ')
  if (mode === 'run') return '当前成员采用单次执行模式，结束后会由总控继续承接'
  return '当前未提供更多续聊能力信息'
}

// ─── Time formatting ────────────────────────────────────────────────

export function formatTime(timestamp?: number): string {
  if (!timestamp) return '--'
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

/** Exact time (HH:MM) for message bubbles, timeline entries, etc. */
export function formatExactTime(timestamp?: number): string {
  if (!timestamp) return '--'
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

/** Full datetime for workbench / artifacts panels */
export function formatDateTime(timestamp?: number): string {
  if (!timestamp) return '--'
  return new Date(timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ─── Task state ─────────────────────────────────────────────────────

export function stateLabel(state: TaskState): string {
  const labels: Record<TaskState, string> = {
    pending: '待处理',
    planning: '规划中',
    plan_review: '评审中',
    approved: '已批准',
    revision_requested: '需修订',
    done: '已完成',
    blocked: '已阻塞',
    cancelled: '已取消',
  }
  return labels[state] || state
}

// ─── Internal field → human friendly ────────────────────────────────

/** nextBestAction — 后端 health-state 模块定义的行动建议 */
export function nextBestActionLabel(action?: string): string {
  const map: Record<string, string> = {
    wait_for_plan: '等待规划',
    run_critic_review: '评审中',
    run_judge_decision: '裁决中',
    revise_plan: '修订计划',
    human_intervention: '需人工介入',
    deliver_or_archive: '交付或归档',
    deliver_output: '交付产物',
    judge_with_notes: '附注裁决',
    inspect_evidence: '审查证据',
    observe: '观察中',
  }
  return map[String(action || '')] || action || '观察中'
}

/** deliveryStatus — 产物交付状态 */
export function deliveryStatusLabel(status?: string): string {
  const map: Record<string, string> = {
    deliverable_ready: '产物就绪',
    deliver_or_archive: '交付或归档',
    deliver_output: '交付产物',
    done_but_artifact_thin: '产物不足',
    pending_delivery: '待交付',
    awaiting_judge_delivery: '等待裁决交付',
    not_ready: '未就绪',
    waiting_approval: '等待审批',
    auto_skip_low_risk: '已自动跳过',
    auto_skip_judge_non_high_risk: '已跳过裁决',
    runtime: '运行时',
  }
  return map[String(status || '')] || status || '未就绪'
}

/** artifactType 标签 */
export function artifactTypeLabel(type?: string): string {
  const map: Record<string, string> = {
    deliverable: '交付产物',
    plan: '计划',
    review: '评审',
    decision: '裁决',
    executor_result: '执行结果',
    executor_artifact: '执行产物',
    output: '输出',
    model_output: '模型输出',
  }
  return map[String(type || '')] || type || '产物'
}

export function interventionStatusLabel(status?: string): string {
  const map: Record<string, string> = {
    human_intervention_required: '需要人工介入',
    human_intervention_recommended: '建议人工介入',
    no_intervention_needed: '无需介入',
    intervention_in_progress: '介入处理中',
  }
  return map[String(status || '')] || status || '未知'
}

export function acceptanceStateLabel(state?: string): string {
  const map: Record<string, string> = {
    ready_for_acceptance: '可直接验收',
    needs_human_decision: '待人工裁决',
    needs_issue_resolution: '需先处理问题',
    in_progress: '推进中',
  }
  return map[String(state || '')] || state || '推进中'
}

export function verdictLabel(verdict?: string): string {
  const map: Record<string, string> = {
    approve: '通过',
    approve_with_notes: '附注通过',
    revise: '需要修订',
  }
  return map[String(verdict || '')] || verdict || '未知'
}

export function decisionTypeLabel(decision?: string): string {
  const map: Record<string, string> = {
    approve: '批准',
    revise: '修订',
    cancel: '取消',
    escalate_human: '升级人工',
  }
  return map[String(decision || '')] || decision || '未知'
}

export function protocolLabel(protocol?: string): string {
  if (!protocol) return '--'
  // e.g. "planner.plan.v2" → "Planner Plan v2"
  const parts = protocol.split('.')
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

// ─── Subtask progress extraction ────────────────────────────────────

export interface SubtaskEntry {
  id: string
  status: 'done' | 'failed' | 'running' | 'retrying'
  summary: string
  timestamp: number
  round: number
}

export function extractSubtaskEntries(events: Array<{ content: string; timestamp: number }>): SubtaskEntry[] {
  const entries = new Map<string, SubtaskEntry>()
  for (const ev of events) {
    const content = String(ev.content || '')
    // Match: "子任务 st2 ✅ 完成：..." or "子任务 st3 ❌ 失败：..."
    const doneMatch = content.match(/子任务\s+(\S+)\s+(✅|完成)[:：]?\s*(.*)/)
    const failMatch = content.match(/子任务\s+(\S+)\s+(❌|失败|错误)[:：]?\s*(.*)/)
    const retryMatch = content.match(/子任务\s+(\S+)\s+🔄\s*(重试|retry)[:：]?\s*(.*)/i)

    if (doneMatch) {
      entries.set(doneMatch[1], {
        id: doneMatch[1], status: 'done',
        summary: doneMatch[3] || '', timestamp: ev.timestamp, round: 1,
      })
    } else if (failMatch) {
      entries.set(failMatch[1], {
        id: failMatch[1], status: 'failed',
        summary: failMatch[3] || '', timestamp: ev.timestamp, round: 1,
      })
    } else if (retryMatch) {
      const prev = entries.get(retryMatch[1])
      entries.set(retryMatch[1], {
        id: retryMatch[1], status: 'retrying',
        summary: retryMatch[3] || '', timestamp: ev.timestamp,
        round: (prev?.round || 0) + 1,
      })
    }
  }
  return Array.from(entries.values()).sort((a, b) => a.timestamp - b.timestamp)
}

export function extractSubtaskSummary(events: Array<{ content: string }>): { total: number; done: number; failed: number } {
  const seen = new Set<string>()
  let done = 0, failed = 0
  for (const ev of events) {
    const content = String(ev.content || '')
    const m = content.match(/子任务\s+(\S+)\s/)
    if (!m) continue
    const id = m[1]
    if (content.includes('完成')) { seen.add(id); done++ }
    else if (content.includes('失败') || content.includes('错误')) { seen.add(id); failed++ }
  }
  return { total: seen.size, done, failed }
}
