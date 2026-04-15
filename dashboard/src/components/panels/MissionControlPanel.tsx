'use client'

import { useEffect, useMemo, useState } from 'react'
import { Brain, Shield, Scale, Bot, PackageOpen, AlertTriangle, Clock3, Sparkles, FileOutput, Activity, GitBranch, Layers3, ArrowRight } from 'lucide-react'
import { ChatMessage, FocusTarget, LiveFlowEvent, TaskCard as TaskCardType, TimelineEntry } from '@/lib/types'
import { fetchTimeline } from '@/lib/api'
import { formatDateTime, formatExactTime, roleLabel, stateLabel, nextBestActionLabel, interventionStatusLabel, artifactTypeLabel, nodeLabel } from '@/lib/utils'
import { StageTimeline } from '@/components/StageTimeline'
import { PanelEmptyState, PanelErrorState, PanelLoadingState } from '@/components/ui/panel-states'
import { focusAssignmentId, focusChildTaskId, focusSummaryLabel, hasTaskFocus, makeTaskFocusTarget, pickTaskFocusRef, withFocusOpenTab } from '@/lib/task-focus'

interface Props {
  task: TaskCardType | null
  liveEvents?: LiveFlowEvent[]
  messages?: ChatMessage[]
  taskId?: string | null
  focusTarget?: FocusTarget | null
  onFocusTarget?: (target: FocusTarget | null) => void
}

type LaneKey = 'planner' | 'critic' | 'judge' | 'executor' | 'output'

const laneOrder: LaneKey[] = ['planner', 'critic', 'judge', 'executor', 'output']

const laneConfig: Record<LaneKey, { label: string; icon: typeof Brain; accent: string; soft: string }> = {
  planner: { label: '规划师', icon: Brain, accent: 'text-[var(--accent)]', soft: 'bg-[var(--accent-soft)] border-[var(--accent)]/30' },
  critic: { label: '评审官', icon: Shield, accent: 'text-[var(--warning)]', soft: 'bg-[var(--warning-soft)] border-[var(--warning)]/30' },
  judge: { label: '裁决官', icon: Scale, accent: 'text-[var(--node-violet)]', soft: 'bg-[var(--node-violet)]/10 border-[var(--node-violet)]/30' },
  executor: { label: '执行者', icon: Bot, accent: 'text-[var(--success)]', soft: 'bg-[var(--success)]/10 border-[var(--success)]/30' },
  output: { label: '交付', icon: FileOutput, accent: 'text-[var(--success)]', soft: 'bg-[var(--success)]/10 border-[var(--success)]/30' },
}

const kindLabels: Record<string, string> = {
  'task.create': '任务创建',
  'task.assign': '任务分配',
  'routing.decided': '分配执行路径',
  'plan.submit': '提交方案',
  'review.request': '发起评审',
  'review.result': '给出评审结果',
  'decision.request': '请求裁决',
  'decision.final': '完成裁决',
  'execute.request': '进入执行',
  'executor.result': '产出结果',
  'planner.session.started': '开始规划',
  'reroute.requested': '调整执行路径',
  'reroute.consumed': '切换完成',
  'decision.escalate_human': '转人工处理',
  'agent.message': '智能体消息',
  'task.replan.result': '局部重排',
}

function confidenceLabel(level?: string) {
  if (level === 'verified') return '已验证'
  if (level === 'template') return '模板/回退'
  if (level === 'inferred') return '推断'
  return '运行中'
}

function confidenceTone(level?: string) {
  if (level === 'verified') return 'text-[var(--success)] bg-[var(--success-soft)]'
  if (level === 'template') return 'text-[var(--warning)] bg-[var(--warning-soft)]'
  if (level === 'inferred') return 'text-[var(--fg-secondary)] bg-[var(--surface-muted)]'
  return 'text-[var(--fg-secondary)] bg-[var(--surface-muted)]'
}

function detectRole(raw?: string): LaneKey | null {
  const value = String(raw || '').toLowerCase()
  if (!value) return null
  if (value.includes('planner')) return 'planner'
  if (value.includes('critic')) return 'critic'
  if (value.includes('judge')) return 'judge'
  if (value.includes('executor')) return 'executor'
  if (value.includes('output')) return 'output'
  return null
}

function humanEventLabel(event: LiveFlowEvent): string {
  const kind = String(event.eventKind || event.type || '')
  const role = detectRole(event.role)
  const roleText = role ? laneConfig[role].label : roleLabel(event.role || 'system')
  if (kind === 'task.created') return '任务进入团队'
  if (kind === 'role.started') return `${roleText}已接手`
  if (kind === 'role.completed') return `${roleText}已完成当前阶段`
  if (kind === 'role.handoff') return `${roleText}已交棒`
  if (kind === 'artifact.produced') return `产出${artifactTypeLabel(event.artifactType)}`
  if (kind === 'execution.progress') {
    const elapsed = event.elapsedMs ? `${Math.round(event.elapsedMs / 1000)}s` : ''
    return `${roleText}执行中${elapsed ? ` · ${elapsed}` : ''}`
  }
  if (kind === 'execution.layer.started') return event.title || '新执行层开始'
  if (kind === 'execution.layer.completed') return event.title || '执行层完成'
  if (kind === 'task.followup.requested') return `${event.intent === 'retry' ? '已请求重试' : event.intent === 'replan' ? '已请求重排' : '已发起子任务跟进'}`
  if (kind === 'task.followup.accepted') return `${event.intent === 'retry' ? '重试请求已接住' : event.intent === 'replan' ? '重排请求已接住' : '跟进请求已接住'}`
  if (kind === 'task.followup.routed') return event.title || '跟进请求已转交成员'
  if (kind === 'task.followup.completed') return event.title || '跟进已完成'
  if (kind === 'task.followup.failed') return event.title || '跟进处理失败'
  if (kind === 'tl.analyzed') return '总控完成分析'
  if (kind === 'tl.decision') return '总控做出决策'
  if (kind === 'task.completed') return '任务完成'
  if (kind === 'subtask.update') {
    const prefix = event.subtaskId ? `子任务 ${event.subtaskId}` : '子任务'
    const state = event.status === 'done' ? '完成' : event.status === 'failed' ? '失败' : event.status === 'retrying' ? '重试中' : '执行中'
    return `${prefix}${state ? ` · ${state}` : ''}`
  }
  if (kind === 'stream.start') return `${roleText}开始输出`
  if (kind === 'stream.end') return `${roleText}完成输出`
  if (kind === 'output.visible') return '已生成可见交付'
  if (kind === 'agent.reply') return `${roleText}最新播报`
  if (kind === 'task.state') return '阶段推进'
  return event.title || event.content || kind || '运行事件'
}

function shortText(text?: string, limit = 120) {
  const value = String(text || '').trim()
  if (!value) return ''
  return value.length > limit ? `${value.slice(0, limit)}…` : value
}

function readableSummary(kind: string, payload: any): string {
  if (!payload) return ''
  if (typeof payload?.summary === 'string') return payload.summary
  if (typeof payload?.message === 'string') return payload.message
  if (typeof payload?.content === 'string') return payload.content
  if (kind === 'decision.final') return payload?.decisionType ? `裁决结果：${payload.decisionType}` : ''
  if (kind === 'review.result') return payload?.verdict ? `评审结果：${payload.verdict}` : ''
  if (kind === 'task.create') return payload?.taskMode ? `模式：${payload.taskMode}` : ''
  if (kind === 'task.replan.result') {
    const pieces = [
      typeof payload?.summary === 'string' ? payload.summary : '',
      payload?.workItemCount ? `新增 ${payload.workItemCount} 个执行项` : '',
      Array.isArray(payload?.titles) && payload.titles.length ? `涉及：${payload.titles.join('，')}` : '',
    ].filter(Boolean)
    return pieces.join(' · ')
  }
  return ''
}

export function MissionControlPanel({ task, liveEvents = [], messages = [], taskId = null, focusTarget = null, onFocusTarget }: Props) {
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const run = async () => {
      if (!taskId) {
        setTimelineEntries([])
        return
      }
      setTimelineLoading(true)
      setTimelineError(null)
      try {
        const res = await fetchTimeline(taskId, 200)
        if (!res.ok) throw new Error(`API error: ${res.status}`)
        const data = await res.json()
        const list: TimelineEntry[] = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
        list.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0))
        if (alive) setTimelineEntries(list)
      } catch (e: any) {
        if (alive) setTimelineError(e?.message || '加载失败')
      } finally {
        if (alive) setTimelineLoading(false)
      }
    }
    run()
    return () => { alive = false }
  }, [taskId])

  const sortedEvents = useMemo(
    () => [...liveEvents].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0)),
    [liveEvents],
  )

  const latestEvent = sortedEvents[0] || null
  const driverRole = detectRole(task?.currentDriver) || detectRole(latestEvent?.role)
  const latestHumanSummary = latestEvent?.content || task?.executiveSummary || task?.planSummary || ''

  const laneSnapshots = useMemo(() => {
    const result: Record<LaneKey, { event: LiveFlowEvent | null; artifactEvent: LiveFlowEvent | null; progressEvent: LiveFlowEvent | null }> = {
      planner: { event: null, artifactEvent: null, progressEvent: null },
      critic: { event: null, artifactEvent: null, progressEvent: null },
      judge: { event: null, artifactEvent: null, progressEvent: null },
      executor: { event: null, artifactEvent: null, progressEvent: null },
      output: { event: null, artifactEvent: null, progressEvent: null },
    }
    for (const ev of sortedEvents) {
      const lane = detectRole(ev.role) || (String(ev.lane || '').toLowerCase() as LaneKey)
      if (!lane || !(lane in result)) continue
      if (!result[lane].event) result[lane].event = ev
      if (!result[lane].artifactEvent && (ev.eventKind === 'artifact.produced' || ev.type === 'artifact_created' || ev.type === 'visible_output')) {
        result[lane].artifactEvent = ev
      }
      if (!result[lane].progressEvent && ev.eventKind === 'execution.progress') {
        result[lane].progressEvent = ev
      }
    }
    return result
  }, [sortedEvents])

  const recentTimeline = useMemo(() => sortedEvents.slice(0, 5), [sortedEvents])

  const recentArtifacts = useMemo(
    () => sortedEvents.filter((ev) => ev.eventKind === 'artifact.produced' || ev.type === 'artifact_created' || ev.type === 'visible_output').slice(0, 3),
    [sortedEvents],
  )

  const recentReplies = useMemo(
    () => sortedEvents.filter((ev) => ev.type === 'agent_reply' || ev.eventKind === 'agent.reply').slice(0, 2),
    [sortedEvents],
  )

  const layerSnapshots = useMemo(() => {
    const map = new Map<number, { index: number; started?: LiveFlowEvent; completed?: LiveFlowEvent; roles: string[]; workItems: string[] }>()
    for (const ev of [...sortedEvents].reverse()) {
      if (ev.eventKind !== 'execution.layer.started' && ev.eventKind !== 'execution.layer.completed') continue
      const inferredIndex = typeof ev.layerIndex === 'number'
        ? ev.layerIndex
        : (() => {
            const m = String(ev.title || '').match(/执行层\s*(\d+)/)
            return m ? Number(m[1]) - 1 : 0
          })()
      const key = Number.isFinite(inferredIndex) ? inferredIndex : 0
      const entry = map.get(key) || { index: key, roles: [], workItems: [] }
      const content = String(ev.content || '')
      const itemTokens = content.split(',').map(v => v.trim()).filter(Boolean)
      entry.workItems = Array.from(new Set(entry.workItems.concat(itemTokens)))
      entry.roles = Array.from(new Set(entry.roles.concat(itemTokens.map(v => v.split('(')[0]).filter(Boolean))))
      if (ev.eventKind === 'execution.layer.started') entry.started = ev
      if (ev.eventKind === 'execution.layer.completed') entry.completed = ev
      map.set(key, entry)
    }
    return Array.from(map.values()).sort((a, b) => a.index - b.index)
  }, [sortedEvents])

  const childTaskRows = useMemo(() => {
    const map = new Map<string, { childTaskId: string; assignmentId: string; role: string; lastEvent?: LiveFlowEvent; state: string; node: string; summary: string }>()
    for (const ev of sortedEvents) {
      const childTaskId = String(ev.childTaskId || ev.subtaskId || '').trim()
      if (!childTaskId) continue
      if (map.has(childTaskId)) continue
      map.set(childTaskId, {
        childTaskId,
        assignmentId: String(ev.assignmentId || '').trim(),
        role: String(ev.role || '').trim(),
        lastEvent: ev,
        state: String(ev.status || ev.state || '').trim(),
        node: String(ev.node || '').trim(),
        summary: shortText(ev.content || ev.title || '', 100),
      })
    }
    return Array.from(map.values())
  }, [sortedEvents])

  const interventionHint = task?.humanInterventionReady
    ? '当前需要人工确认或决策。'
    : task?.interventionStatus && task.interventionStatus !== 'no_intervention_needed'
      ? interventionStatusLabel(task.interventionStatus)
      : '当前无需人工介入。'

  const trustedOutput = recentArtifacts.find((ev) => ev.confidence === 'verified')
  const latestReply = recentReplies[0] || null
  const latestTaskMessages = useMemo(
    () => messages.slice(-2).reverse(),
    [messages],
  )

  const stageEntries = useMemo(() => {
    const normalized = timelineEntries.map((entry) => {
      const assignmentId = focusAssignmentId(entry?.payload as Record<string, any>)
      const childTaskId = focusChildTaskId(entry?.payload as Record<string, any>)
      const summary = readableSummary(entry.kind, entry.payload) || '有一条新的任务进展'
      const isReplan = entry.kind === 'task.replan.result'
      return {
        id: entry.messageId || `${entry.kind}-${entry.createdAt}`,
        stage: kindLabels[entry.kind] || '任务进展',
        summary,
        createdAt: Number(entry.createdAt || 0),
        focusTarget: hasTaskFocus(entry?.payload as Record<string, any>) ? makeTaskFocusTarget({
          ...pickTaskFocusRef(entry?.payload as Record<string, any>),
          openTab: 'deliverables',
          summary,
          intent: isReplan ? 'replan' : undefined,
          sourceKind: isReplan ? 'replan' : 'timeline',
          timelineMessageId: entry.messageId || undefined,
          replanCreatedAt: isReplan ? Number(entry.createdAt || 0) : undefined,
          assignmentId: assignmentId || undefined,
          childTaskId: childTaskId || undefined,
        }) : null,
      }
    })
    return normalized.sort((a, b) => b.createdAt - a.createdAt).slice(0, 8)
  }, [timelineEntries])

  const focusSummary = useMemo(() => focusSummaryLabel(focusTarget), [focusTarget])

  if (!task) {
    return <PanelEmptyState title="先选一条任务进入现场" body="这里会展示判断、阶段流、执行链和交付信号。" />
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--surface)]">
      <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--fg)]">
          <Sparkles className="h-4 w-4 text-[var(--accent)]" />
          任务现场
        </div>
        <div className="mt-0.5 text-[11px] text-[var(--fg-muted)]">先看判断，再看阶段流、交付与人工位。</div>
        {focusSummary ? <div className="mt-2 text-[11px] text-[var(--fg-ghost)]">{focusSummary}</div> : null}
      </div>

      <div className="panel-scroll flex-1 min-h-0 space-y-4 overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] md:pb-4">
        <section className="surface-card surface-card-hero p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">
              {stateLabel(task.state)}
            </span>
            <span className={`rounded-md px-2 py-1 text-[10px] font-medium ${confidenceTone(latestEvent?.confidence)}`}>
              {confidenceLabel(latestEvent?.confidence)}
            </span>
            {driverRole && (
              <span className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">
                当前负责：{laneConfig[driverRole].label}
              </span>
            )}
            {latestEvent?.node ? (
              <span className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">
                {nodeLabel(latestEvent.node)}
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold leading-snug text-[var(--fg)]">{task.title || '无标题任务'}</h3>
              <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-6 text-[var(--fg-secondary)]">
                {shortText(latestHumanSummary, 260) || '暂无可见摘要'}
              </p>
            </div>
          </div>

          <div className="surface-card-subtle mt-4 p-3">
            <StageTimeline
              state={task.state}
              lastMessage={latestEvent?.content || task.executiveSummary}
              lastRole={latestEvent?.role || task.currentDriver}
              compact
            />
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div className="info-tile">
              <div className="text-[10px] text-[var(--fg-ghost)]">当前负责人</div>
              <div className="mt-1 text-[13px] font-medium text-[var(--fg)]">{driverRole ? laneConfig[driverRole].label : '等待分配'}</div>
            </div>
            <div className="info-tile">
              <div className="text-[10px] text-[var(--fg-ghost)]">当前判断</div>
              <div className="mt-1 text-[13px] font-medium text-[var(--fg)]">{task.deliverableReady ? '建议切到交付面验收' : task.humanInterventionReady ? '建议现在介入' : '继续让团队推进'}</div>
            </div>
            <div className="info-tile">
              <div className="text-[10px] text-[var(--fg-ghost)]">事件回流</div>
              <div className="mt-1 text-[13px] font-medium text-[var(--fg)]">{sortedEvents.length} 条</div>
            </div>
            <div className="info-tile">
              <div className="text-[10px] text-[var(--fg-ghost)]">可见产出</div>
              <div className="mt-1 text-[13px] font-medium text-[var(--fg)]">{recentArtifacts.length} 条</div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="surface-card p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--fg)]">
              <Activity className="h-3.5 w-3.5 text-[var(--accent)]" />
              执行链快照
            </div>
            <div className="mt-3 space-y-2.5">
              {laneOrder.map((lane) => {
                const cfg = laneConfig[lane]
                const Icon = cfg.icon
                const laneState = laneSnapshots[lane]
                const latest = laneState.event
                const artifact = laneState.artifactEvent
                const progress = laneState.progressEvent
                const active = lane === driverRole || String(task.currentDriver || '').toLowerCase().includes(lane)
                const isExecuting = active && progress && (Date.now() - (progress.timestamp || 0) < 30000)
                const elapsedLabel = isExecuting && progress.elapsedMs ? `${Math.round(progress.elapsedMs / 1000)}s` : ''
                return (
                  <div key={lane} className={`rounded-xl border px-3 py-3 ${active ? cfg.soft : 'border-[var(--border-subtle)] bg-[var(--surface-subtle)]'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? cfg.soft : 'border border-[var(--border)] bg-[var(--surface)]'}`}>
                        <Icon className={`h-4 w-4 ${cfg.accent} ${isExecuting ? 'animate-pulse' : ''}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-[var(--fg)]">{cfg.label}</span>
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${isExecuting ? 'animate-pulse bg-[var(--accent-soft)] text-[var(--accent)]' : active ? 'bg-[var(--surface)] text-[var(--fg)]' : latest ? 'bg-[var(--surface)] text-[var(--fg-muted)]' : 'bg-[var(--surface)] text-[var(--fg-muted)]'}`}>
                            {isExecuting ? '执行中' : active ? '进行中' : latest ? '有记录' : '未出场'}
                          </span>
                          {elapsedLabel && (
                            <span className="rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--accent)]">
                              {elapsedLabel}
                            </span>
                          )}
                          {latest?.node ? (
                            <span className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">{nodeLabel(latest.node)}</span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">
                          {latest ? humanEventLabel(latest) : '暂无动作'}
                        </div>
                        <div className="mt-1 text-[12px] leading-5 text-[var(--fg-secondary)]">
                          {isExecuting && progress?.content
                            ? shortText(progress.content, 120)
                            : shortText(latest?.content || artifact?.title || artifact?.content || '等待新的协作事件', 100)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="surface-card p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--fg)]">
              <Clock3 className="h-3.5 w-3.5 text-[var(--accent)]" />
              阶段流 / 时间线
            </div>
            <div className="mt-1 text-[12px] text-[var(--fg-muted)]">从正式 timeline 事件流读，不再靠别的面板字段兜底。</div>
            {timelineLoading ? <div className="mt-3"><PanelLoadingState text="正在加载阶段流…" /></div> : null}
            {timelineError ? <div className="mt-3"><PanelErrorState text={timelineError} /></div> : null}
            <div className="mt-3 space-y-2.5">
              {stageEntries.length === 0 ? (
                <div className="text-[13px] text-[var(--fg-muted)]">当前还没有正式阶段记录。继续推进后会在这里形成阶段流。</div>
              ) : stageEntries.map((entry) => {
                const entryFocusChildTaskId = focusChildTaskId(entry.focusTarget as Record<string, any>)
                const entryFocusAssignmentId = focusAssignmentId(entry.focusTarget as Record<string, any>)
                const currentFocusChildTaskId = focusChildTaskId(focusTarget as Record<string, any>)
                const currentFocusAssignmentId = focusAssignmentId(focusTarget as Record<string, any>)
                const isFocused = Boolean(entry.focusTarget && ((entryFocusChildTaskId && entryFocusChildTaskId === currentFocusChildTaskId) || (entryFocusAssignmentId && entryFocusAssignmentId === currentFocusAssignmentId)))
                return (
                  <div key={entry.id} className={`surface-card-subtle p-3 ${isFocused ? 'border-[var(--accent)] bg-[var(--accent-soft)]/40' : ''}`}>
                    <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--fg-muted)]">
                      <span className="font-medium text-[var(--fg)]">{entry.stage}</span>
                      <span>{formatExactTime(entry.createdAt)}</span>
                    </div>
                    <div className="mt-1.5 text-[12px] leading-5 text-[var(--fg-secondary)]">{entry.summary}</div>
                    {entry.focusTarget && onFocusTarget ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onFocusTarget(withFocusOpenTab(entry.focusTarget, 'deliverables'))}
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--success)]/25 bg-[var(--success-soft)] px-3 py-1.5 text-[11px] font-medium text-[var(--success)] transition hover:opacity-90"
                        >
                          <PackageOpen className="h-3.5 w-3.5" /> 查看交付
                        </button>
                        <button
                          type="button"
                          onClick={() => onFocusTarget(withFocusOpenTab(entry.focusTarget, 'files'))}
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--fg-secondary)] transition hover:bg-[var(--surface-muted)]"
                        >
                          <ArrowRight className="h-3.5 w-3.5" /> 深入对象
                        </button>
                        {isFocused ? (
                          <button
                            type="button"
                            onClick={() => onFocusTarget(null)}
                            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--fg-secondary)] transition hover:bg-[var(--surface-muted)]"
                          >
                            清除定位
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="grid gap-3 xl:grid-cols-2">
          <div className="surface-card p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--fg)]">
              <GitBranch className="h-3.5 w-3.5 text-[var(--accent)]" />
              子任务
            </div>
            <div className="mt-3 space-y-2.5">
              {childTaskRows.length === 0 ? (
                <div className="text-[13px] text-[var(--fg-muted)]">当前还没有可识别的子任务事件。</div>
              ) : childTaskRows.map((row) => (
                <div key={row.childTaskId} className="surface-card-subtle p-3">
                  <div className="flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
                    <span className="font-medium text-[var(--fg)]">{roleLabel(row.role || 'system')}</span>
                    {row.node ? <span className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">{nodeLabel(row.node)}</span> : null}
                    <span className="ml-auto">{row.lastEvent ? formatDateTime(row.lastEvent.timestamp) : ''}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="min-w-0 flex-1 text-[12px] font-medium text-[var(--fg)]">当前子任务</div>
                    {row.state ? (
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${row.state === 'done' ? 'bg-[var(--success-soft)] text-[var(--success)]' : row.state === 'failed' ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : row.state === 'retrying' ? 'bg-[var(--warning-soft)] text-[var(--warning)]' : 'bg-[var(--accent-soft)] text-[var(--accent)]'}`}>
                        {row.state === 'done' ? '已完成' : row.state === 'failed' ? '失败' : row.state === 'retrying' ? '重试中' : '进行中'}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[12px] leading-5 text-[var(--fg-secondary)]">{row.summary || '等待新的子任务事件'}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-card p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--fg)]">
              <Layers3 className="h-3.5 w-3.5 text-[var(--accent)]" />
              执行层
            </div>
            <div className="mt-3 space-y-2.5">
              {layerSnapshots.length === 0 ? (
                <div className="text-[13px] text-[var(--fg-muted)]">当前还没有执行层记录。</div>
              ) : layerSnapshots.map((layer) => {
                const done = !!layer.completed
                return (
                  <div key={layer.index} className={`rounded-xl border p-3 ${done ? 'border-[var(--success)]/25 bg-[var(--success-soft)]/45' : 'border-[var(--accent)]/20 bg-[var(--accent-soft)]/35'}`}>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
                      <span className="font-medium text-[var(--fg)]">第 {layer.index + 1} 层</span>
                      <span className={`rounded-md px-1.5 py-0.5 ${done ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-[var(--accent-soft)] text-[var(--accent)]'}`}>{done ? '已完成' : '进行中/待完成'}</span>
                      <span className="ml-auto">{formatDateTime(layer.completed?.timestamp || layer.started?.timestamp)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {layer.workItems.map((item) => (
                        <span key={item} className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">{item}</span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="grid gap-3 xl:grid-cols-2">
          <div className="surface-card p-4">
            <div className="flex items-center justify-between gap-2 text-[13px] font-semibold text-[var(--fg)]">
              <div className="flex items-center gap-2">
                <PackageOpen className="h-3.5 w-3.5 text-[var(--accent)]" />
                最近可见产出
              </div>
              {trustedOutput ? <span className="text-[10px] font-medium text-[var(--success)]">含可信交付</span> : null}
            </div>
            <div className="mt-3 space-y-2.5">
              {recentArtifacts.length === 0 ? (
                <div className="text-[13px] text-[var(--fg-muted)]">还没有新的可见产物</div>
              ) : recentArtifacts.map((event) => (
                <div key={event.id} className="surface-card-subtle p-3">
                  <div className="flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
                    <span className="font-medium text-[var(--fg)]">{artifactTypeLabel(event.artifactType) || '产物'}</span>
                    <span className={`rounded-md px-1.5 py-0.5 ${confidenceTone(event.confidence)}`}>{confidenceLabel(event.confidence)}</span>
                    <span className="ml-auto">{formatDateTime(event.timestamp)}</span>
                  </div>
                  <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{event.title || humanEventLabel(event)}</div>
                  {event.content ? <div className="mt-1 text-[12px] leading-5 text-[var(--fg-secondary)]">{shortText(event.content, 140)}</div> : null}
                </div>
              ))}
            </div>
          </div>

          <div className="surface-card p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--fg)]">
              <AlertTriangle className="h-3.5 w-3.5 text-[var(--accent)]" />
              最近播报与任务消息
            </div>
            <div className="mt-3 space-y-2.5">
              {latestReply && (
                <div className="rounded-xl border border-[var(--accent)]/20 bg-[var(--accent-soft)] p-3">
                  <div className="flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
                    <span className="font-medium text-[var(--fg)]">最新团队播报</span>
                    <span className="soft-label border-[var(--accent)]/30 bg-[var(--surface)] text-[var(--accent)]">团队播报</span>
                    <span className="ml-auto">{formatDateTime(latestReply.timestamp)}</span>
                  </div>
                  <div className="mt-1.5 whitespace-pre-wrap break-words text-[12px] leading-5 text-[var(--fg-secondary)]">
                    {shortText(latestReply.content, 180)}
                  </div>
                </div>
              )}

              {latestTaskMessages.length === 0 ? (
                <div className="text-[13px] text-[var(--fg-muted)]">暂无协作消息</div>
              ) : latestTaskMessages.map((msg) => (
                <div key={msg.id} className="surface-card-subtle p-3">
                  <div className="flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
                    <span className="font-medium text-[var(--fg)]">{roleLabel(msg.role)}</span>
                    {msg.node ? <span className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">{nodeLabel(msg.node)}</span> : null}
                    <span className="ml-auto">{formatDateTime(msg.timestamp)}</span>
                  </div>
                  <div className="mt-1 whitespace-pre-wrap break-words text-[12px] leading-5 text-[var(--fg-secondary)]">
                    {shortText(msg.content, 150)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-3 xl:grid-cols-2">
          <div className="surface-card-subtle p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--fg)]">
              <Activity className="h-4 w-4 text-[var(--accent)]" />
              可信执行判断
            </div>
            <div className="mt-2 text-[12px] leading-6 text-[var(--fg-secondary)]">
              {trustedOutput
                ? `最近已有可信交付信号：${humanEventLabel(trustedOutput)}。`
                : latestEvent
                  ? '当前已有实时推进信号，但还没有明确的已验证交付证据。'
                  : '当前仍在等待新的推进信号。'}
            </div>
          </div>

          <div className="surface-card-subtle p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--fg)]">
              <AlertTriangle className="h-4 w-4 text-[var(--accent)]" />
              人工介入提示
            </div>
            <div className="mt-2 text-[12px] leading-6 text-[var(--fg-secondary)]">{shortText(interventionHint, 160)}</div>
            <div className="mt-3 text-[11px] text-[var(--fg-muted)]">{nextBestActionLabel(task.nextBestAction) || '继续观察现场'}</div>
          </div>
        </section>
      </div>
    </div>
  )
}
