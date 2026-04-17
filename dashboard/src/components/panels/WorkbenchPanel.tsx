'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ClipboardList, Loader2, Sparkles, CheckCircle2, PackageOpen, Archive, ExternalLink, Clock } from 'lucide-react'
import { TaskCard as TaskCardType, LiveFlowEvent, ResidentInfo, FocusTarget } from '@/lib/types'
import { API_BASE, fetchWorkbench, fetchSummary, fetchControl, fetchPipeline, fetchTimeline, fetchResidents, postTaskAction, fetchArchive } from '@/lib/api'
import { formatDateTime, roleLabel, nodeLabel, deliveryStatusLabel, interventionStatusLabel, verdictLabel, decisionTypeLabel, stateLabel, nextBestActionLabel, routeModeLabel, sessionModeLabel, sessionCapabilityHint, degradedReasonLabel } from '@/lib/utils'
import { pickTaskFocusRef } from '@/lib/task-focus'
import { StageTimeline } from '@/components/StageTimeline'
import { useTaskStore } from '@/lib/store'
import { ActionConfirmDialog, CONTROL_ACTION_META } from '@/components/panels/workbench-actions'
import { WorkbenchActionSection } from '@/components/panels/WorkbenchActionSection'
import { WorkbenchDeliveryOverviewSection } from '@/components/panels/WorkbenchDeliveryOverviewSection'
import { SummaryHeroSection } from '@/components/panels/SummaryHeroSection'
import { PanelEmptyState, PanelErrorState, PanelLoadingState, PanelWarningState } from '@/components/ui/panel-states'
import { WorkbenchChildTasksSection, WorkbenchExecutionSurfaceSection, WorkbenchLiveFeedSection, WorkbenchMemorySection, WorkbenchPeopleSection, WorkbenchReplanSection } from '@/components/panels/WorkbenchStructureSections'
import { ArtifactPreview } from '@/components/panels/ArtifactPreview'
import { DeliveryTimeline } from '@/components/panels/DeliveryTimeline'
import { useI18n } from '@/i18n/context'

function activeStageDuration(events: LiveFlowEvent[], currentState: string): string {
  if (currentState === 'done' || currentState === 'cancelled' || currentState === 'blocked') return ''
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp)
  const entry = sorted.find((e) => e.state === currentState)
  if (!entry?.timestamp) return ''
  const elapsed = Date.now() - entry.timestamp
  if (elapsed < 60000) return '不到1分钟'
  if (elapsed < 3600000) return `${Math.floor(elapsed / 60000)}分钟`
  return `${Math.floor(elapsed / 3600000)}小时 ${Math.floor((elapsed % 3600000) / 60000)}分钟`
}

interface Props {
  taskId: string | null
  teamId?: string | null
  task: TaskCardType | null
  liveEvents?: LiveFlowEvent[]
  onFocusTarget?: (target: FocusTarget) => void
}

function SubtaskProgressPanel({ taskId }: { taskId: string }) {
  const subtaskState = useTaskStore((s) => s.subtaskState)
  const entries = Object.values(subtaskState[taskId] || {})
  if (entries.length === 0) return null

  const total = new Set(entries.map((e) => e.subtaskId)).size
  const done = entries.filter((e) => e.status === 'done').length
  const failed = entries.filter((e) => e.status === 'failed' || e.status === 'retrying').length
  const hasFailed = failed > 0

  const statusLabel = (s: string) => {
    if (s === 'done') return '完成'
    if (s === 'failed') return '失败'
    if (s === 'retrying') return '重试中'
    return '执行中'
  }

  return (
    <section className="surface-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold text-[var(--fg)]">子任务进度</div>
        <span className="text-[11px] text-[var(--fg-muted)]">
          {done}/{total} 完成{hasFailed ? ` · ${failed} 需关注` : ''}
        </span>
      </div>
      {total > 0 && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
          <div className="h-full rounded-full bg-[var(--success)] transition-all duration-500" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      )}
      <div className="mt-3 space-y-1.5">
        {entries.map((st) => (
          <div key={st.subtaskId} className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2">
            <span className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${st.status === 'done' ? 'bg-[var(--success)]' : st.status === 'failed' ? 'bg-[var(--danger)]' : st.status === 'retrying' ? 'bg-[var(--warning)]' : 'bg-[var(--accent)]'}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-medium text-[var(--fg)]">{st.subtaskId}</span>
                <span className={`rounded px-1 text-[10px] ${st.status === 'done' ? 'bg-[var(--success-soft)] text-[var(--success)]' : st.status === 'failed' ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : st.status === 'retrying' ? 'bg-[var(--warning-soft)] text-[var(--warning)]' : 'bg-[var(--accent-soft)] text-[var(--accent)]'}`}>
                  {statusLabel(st.status)}
                </span>
              </div>
              {st.summary && <div className="mt-0.5 truncate text-[11px] text-[var(--fg-muted)]">{st.summary}</div>}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function WorkbenchPanel({ taskId, teamId, task, liveEvents = [], onFocusTarget }: Props) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workbench, setWorkbench] = useState<any>(null)
  const [summaryDoc, setSummaryDoc] = useState<any>(null)
  const [controlDoc, setControlDoc] = useState<any>(null)
  const [pipeline, setPipeline] = useState<any>(null)
  const [archiveState, setArchiveState] = useState<{ count: number; items: any[] } | null>(null)
  const [mailboxEntries, setMailboxEntries] = useState<any[]>([])
  const [residents, setResidents] = useState<ResidentInfo[]>([])
  const [partialWarnings, setPartialWarnings] = useState<string[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionFeedback, setActionFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const subtaskState = useTaskStore((s) => s.subtaskState)
  const upsertTask = useTaskStore((s) => s.upsertTask)

  const loadWorkbenchData = useCallback(async () => {
    if (!taskId || !teamId) {
      setWorkbench(null)
      setSummaryDoc(null)
      setControlDoc(null)
      setPipeline(null)
      setArchiveState(null)
      setResidents([])
      setPartialWarnings([])
      return
    }
    setLoading(true)
    setError(null)
    setPartialWarnings([])
    try {
      const [wbRes, summaryRes, controlRes, pipeRes, mailboxRes, residentRes, archiveRes] = await Promise.all([
        fetchWorkbench(taskId),
        fetchSummary(taskId),
        fetchControl(taskId),
        fetchPipeline(taskId),
        fetchTimeline(taskId, 100),
        fetchResidents(teamId),
        fetchArchive(200),
      ])

      const warnings: string[] = []
      let wbJson: any = null
      if (wbRes.ok) wbJson = await wbRes.json()
      else if (wbRes.status === 401 || wbRes.status === 403) warnings.push('部分深层详情暂时不可见，先展示基础信息。')
      else warnings.push('任务详情有一部分暂时没加载出来。')

      let summaryJson: any = null
      if (summaryRes.ok) summaryJson = await summaryRes.json()
      else if (summaryRes.status === 401 || summaryRes.status === 403) warnings.push('结果汇总层暂时不可见，先展示任务现场与基础摘要。')

      let controlJson: any = null
      if (controlRes.ok) controlJson = await controlRes.json()
      else if (controlRes.status === 401 || controlRes.status === 403) warnings.push('动作控制面暂时不可见，先展示默认协作动作。')

      let pipeJson: any = null
      if (pipeRes.ok) pipeJson = await pipeRes.json()

      let mailboxJson: any = null
      if (mailboxRes.ok) mailboxJson = await mailboxRes.json()

      let residentJson: any = null
      if (residentRes.ok) residentJson = await residentRes.json()

      let archiveJson: any = null
      if (archiveRes.ok) archiveJson = await archiveRes.json()

      if (!wbJson && !summaryJson && !controlJson && !pipeJson && !mailboxJson && !residentJson && !archiveJson) throw new Error('加载任务详情失败')

      setWorkbench(wbJson)
      setSummaryDoc(summaryJson)
      setControlDoc(controlJson)
      setPipeline(pipeJson)
      setArchiveState(archiveJson?.archive || archiveJson?.payload?.archive || null)
      setMailboxEntries(Array.isArray(mailboxJson?.items) ? mailboxJson.items : [])
      setPartialWarnings(warnings)

      const residentList = Array.isArray(residentJson?.residents) ? residentJson.residents : []
      setResidents(residentList)
    } catch (e: any) {
      setError(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [taskId, teamId])

  useEffect(() => {
    void loadWorkbenchData()
  }, [loadWorkbenchData, task?.state, task?.updatedAt])

  const handleControlAction = useCallback(async (action: string) => {
    if (!taskId) return
    const meta = CONTROL_ACTION_META[action]
    if (!meta) return

    setActionFeedback(null)
    setActionLoading(action)
    try {
      const res = await postTaskAction(taskId, action, meta.reason)
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || `action_failed_${action}`)

      if (json?.task) {
        upsertTask({
          taskId: String(json.task.taskId || taskId),
          teamId: String(json.task.teamId || task?.teamId || teamId || ''),
          title: String(task?.title || ''),
          state: String(json.task.state || task?.state || 'pending') as any,
          updatedAt: Number(json.task.updatedAt || Date.now()),
          currentDriver: String(task?.currentDriver || ''),
          currentMemberKey: String(task?.currentMemberKey || ''),
          nextBestAction: String(task?.nextBestAction || ''),
          latestReviewVerdict: task?.latestReviewVerdict || null,
          latestDecisionType: action === 'manual_done' ? 'approve' : action === 'manual_block' ? 'escalate_human' : action === 'manual_cancel' ? 'cancel' : task?.latestDecisionType || null,
          artifactCount: Number(task?.artifactCount || 0),
          evidenceCount: Number(task?.evidenceCount || 0),
          issueCount: Number(task?.issueCount || 0),
          deliverableReady: action === 'manual_done' ? true : Boolean(task?.deliverableReady),
          humanInterventionReady: action === 'manual_block' ? true : false,
          deliveryStatus: action === 'manual_done' ? 'deliverable_ready' : String(task?.deliveryStatus || ''),
          interventionStatus: action === 'manual_block' ? 'human_intervention_required' : String(task?.interventionStatus || ''),
          requestedNode: String(task?.requestedNode || ''),
          actualNode: String(task?.actualNode || ''),
          degradedReason: String(task?.degradedReason || ''),
          planSummary: String(task?.planSummary || ''),
          executiveSummary: String(task?.executiveSummary || ''),
          protocolSource: String(task?.protocolSource || ''),
        })
      }

      setActionFeedback({ tone: 'success', text: t('workbench.executedAction', `已执行「${meta.label}」，工作台正在刷新到最新状态`) })
      await loadWorkbenchData()
    } catch (err: any) {
      setActionFeedback({ tone: 'error', text: `执行失败：${err?.message || '未知错误'}` })
    } finally {
      setActionLoading(null)
      setPendingAction(null)
    }
  }, [taskId, task, teamId, upsertTask, loadWorkbenchData])

  const summary = workbench?.summary || pipeline?.pipeline || {}
  const summaryPayload = summaryDoc?.payload || summaryDoc || {}
  const controlPayload = controlDoc?.payload || controlDoc || {}
  const manualActions = Array.isArray(summary?.manualActions)
    ? summary.manualActions
    : Array.isArray(controlPayload?.manualActions)
      ? controlPayload.manualActions
      : []
  const resultCounters = summaryPayload?.counters || {}
  const deliveryLinks = workbench?.summaryLinks || summaryDoc?.links || summaryDoc?.summaryLinks || {}
  const deliveryClosure = workbench?.summary?.deliveryClosure || summaryPayload?.deliveryClosure || pipeline?.pipeline?.deliveryClosure || null
  const sessionMode = String(summaryPayload?.sessionMode || summary.sessionMode || task?.sessionMode || '')
  const sessionPersistent = typeof summaryPayload?.sessionPersistent === 'boolean'
    ? summaryPayload.sessionPersistent
    : typeof summary.sessionPersistent === 'boolean'
      ? summary.sessionPersistent
      : Boolean(task?.sessionPersistent)
  const sessionFallbackReason = String(summaryPayload?.sessionFallbackReason || summary.sessionFallbackReason || task?.sessionFallbackReason || '')
  const routeMode = routeModeLabel({ requestedNode: summaryPayload?.requestedNode || task?.requestedNode, actualNode: summaryPayload?.actualNode || task?.actualNode, degradedReason: summaryPayload?.degradedReason || task?.degradedReason })
  const sessionModeText = sessionModeLabel({ sessionMode, sessionPersistent })
  const sessionHint = sessionCapabilityHint({ sessionMode, sessionPersistent, sessionFallbackReason })
  const roleResidents = useMemo(() => [...residents].sort((a, b) => String(a.role).localeCompare(String(b.role))), [residents])
  const latestLive = liveEvents[0] || null
  const currentState = String(task?.state || pipeline?.pipeline?.state || 'pending')
  const currentStageMessage = String(latestLive?.content || summary.nextBestAction || task?.nextBestAction || '')
  const stageDuration = activeStageDuration(liveEvents, currentState)
  const pendingActionMeta = pendingAction ? CONTROL_ACTION_META[pendingAction] || null : null

  const coreFacts = [
    { label: '协作阶段', value: stateLabel((task?.state || currentState) as any) },
    { label: t('workbench.currentRole', '当前角色'), value: roleLabel(summary.currentDriver || task?.currentDriver) },
    { label: '下一棒', value: nextBestActionLabel(summary.nextBestAction || task?.nextBestAction) },
    { label: '交付状态', value: deliveryStatusLabel(summary.deliveryStatus || task?.deliveryStatus) },
    { label: '人工介入', value: interventionStatusLabel(task?.interventionStatus) },
    { label: '占用时长', value: stageDuration || '刚开始或暂无记录' },
  ]

  const latestVerdict = task?.latestReviewVerdict
  const latestDecision = task?.latestDecisionType
  const currentDriverKey = String(summary.currentDriver || task?.currentDriver || '').trim().toLowerCase().split(/[.:]/)[0] || ''
  const peopleView = roleResidents.filter((r) => r.role && r.role !== 'system')
  const busyPeopleCount = peopleView.filter((r) => r.status === 'busy').length
  const artifactCount = Number(task?.artifactCount || 0)
  const evidenceCount = Number(task?.evidenceCount || 0)
  const issueCount = Number(task?.issueCount || 0)
  const sceneLeadLabel = roleLabel(summary.currentDriver || task?.currentDriver)
  const scenePulse = task?.humanInterventionReady
    ? '这条线现在需要人工接管。'
    : task?.deliverableReady
      ? '这条线已经进入交付窗口。'
      : currentStageMessage
        ? `现场当前在推进：${currentStageMessage}`
        : '现场正在组织下一步推进。'
  const bossPrompt = task?.humanInterventionReady
    ? '建议老板现在介入，优先处理当前待决问题。'
    : task?.deliverableReady
      ? '建议直接切到交付面确认是否可以收口。'
      : issueCount > 0
        ? `现场还有 ${issueCount} 个风险信号，适合先看播报和脉络。`
        : '这条线暂时不需要你频繁打断，适合让团队继续推进。'
  const acceptancePulse = task?.deliverableReady
    ? (issueCount > 0 ? `结果已基本成形，但还有 ${issueCount} 个提醒要带着一起验。` : '结果已成形，当前更适合直接验收与收口。')
    : issueCount > 0
      ? `当前还不能直接收，需要先处理 ${issueCount} 个风险信号。`
      : '当前还在铺路推进，先让团队把过程跑完整。'

  const subtaskEntries = taskId ? Object.values(subtaskState[taskId] || {}) : []
  const archiveItems = Array.isArray(archiveState?.items) ? archiveState.items : []
  const archiveHit = archiveItems.find((item) => String(item?.taskId || '') === String(taskId || '')) || null
  const isTerminalState = ['done', 'blocked', 'cancelled'].includes(currentState)
  const terminalTone = currentState === 'done'
    ? 'border-[var(--success)]/20 bg-[var(--success-soft)] text-[var(--success)]'
    : currentState === 'blocked'
      ? 'border-[var(--warning)]/20 bg-[var(--warning-soft)] text-[var(--warning)]'
      : 'border-[var(--danger)]/20 bg-[var(--danger-soft)] text-[var(--danger)]'
  const terminalHeadline = currentState === 'done'
    ? '这条线已经收口完成。'
    : currentState === 'blocked'
      ? '这条线已经被明确挂起。'
      : '这条线已经被明确终止。'
  const terminalActionHint = currentState === 'done'
    ? '现在更重要的是确认结果是否足够可复查、可交付、可归档。'
    : currentState === 'blocked'
      ? '现在更重要的是把阻塞原因、下一步接管方式、以及恢复入口说清楚。'
      : '现在更重要的是把取消原因、保留资产、以及后续是否重开说清楚。'
  const terminalSummary = actionFeedback?.tone === 'success' && actionFeedback?.text
    ? actionFeedback.text
    : summaryPayload?.executiveSummary || summary.executiveSummary || task?.executiveSummary || task?.planSummary || ''
  const archiveCount = Number(archiveState?.count || archiveItems.length || 0)
  const deliveryArchiveLink = String(deliveryLinks?.archive || '')
  const deliveryArchiveHref = deliveryArchiveLink
    ? `${API_BASE}${deliveryArchiveLink.startsWith('/') ? deliveryArchiveLink : `/${deliveryArchiveLink}`}`
    : ''

  const latestReplanResult = useMemo(() => {
    const mailbox = Array.isArray(mailboxEntries) ? mailboxEntries : []
    return mailbox.find((item: any) => String(item?.kind || '') === 'task.replan.result') || null
  }, [mailboxEntries])

  const latestReplanMap = useMemo(() => {
    const replan = workbench?.board?.latestReplanMap
    return replan && typeof replan === 'object' ? replan : null
  }, [workbench])

  const focusableChildTasks = useMemo(() => {
    const map = new Map<string, FocusTarget & { role?: string; node?: string; timestamp?: number; failed?: boolean; retrying?: boolean; requestState?: string; requestIntent?: string }>()

    for (const st of subtaskEntries) {
      map.set(st.subtaskId, {
        childTaskId: st.subtaskId,
        targetRole: String(st.role || '').trim() || undefined,
        summary: String(st.summary || '').trim(),
        role: String(st.role || '').trim(),
        failed: st.status === 'failed',
        retrying: st.status === 'retrying',
        timestamp: Number(st.timestamp || 0),
      })
    }

    for (const ev of liveEvents) {
      const childTaskId = String(ev.childTaskId || ev.subtaskId || '').trim()
      if (!childTaskId) continue
      const prev = map.get(childTaskId) || {}
      const eventKind = String(ev.eventKind || '')
      const requestState = eventKind === 'task.followup.requested'
        ? 'requested'
        : eventKind === 'task.followup.accepted'
          ? 'accepted'
          : eventKind === 'task.followup.routed'
            ? 'routed'
            : eventKind === 'task.followup.completed'
              ? 'completed'
              : eventKind === 'task.followup.failed'
                ? 'failed'
                : prev.requestState
      map.set(childTaskId, {
        ...prev,
        childTaskId,
        assignmentId: prev.assignmentId || String(ev.assignmentId || '').trim(),
        targetRole: prev.targetRole || String(ev.role || '').trim() || undefined,
        summary: String(ev.content || ev.title || '').trim() || prev.summary,
        role: prev.role || String(ev.role || '').trim(),
        node: prev.node || String(ev.node || '').trim(),
        timestamp: Number(ev.timestamp || 0) || prev.timestamp,
        requestState,
        requestIntent: String(ev.intent || '').trim() || prev.requestIntent,
        failed: eventKind === 'task.followup.failed' ? true : prev.failed,
        retrying: eventKind === 'task.followup.requested' && String(ev.intent || '') === 'retry' ? true : prev.retrying,
      })
    }

    return Array.from(map.values())
  }, [liveEvents, subtaskEntries])

  const replanStructureRows = useMemo<Array<{
    index: number
    itemId: string
    itemRole: string
    itemTitle: string
    objective: string
    acceptance: string
    deliverables: string[]
    dependencies: string[]
    matchedChild: (FocusTarget & { role?: string; node?: string; timestamp?: number; failed?: boolean; retrying?: boolean; requestState?: string; requestIntent?: string }) | null
    matchState: 'attached' | 'pending_attach'
  }>>(() => {
    const workItems = Array.isArray(latestReplanMap?.workItems) ? latestReplanMap.workItems : []
    if (workItems.length === 0) return []

    return workItems.map((item: any, index: number) => {
      const itemId = String(item?.id || '').trim()
      const itemRole = String(item?.role || '').trim()
      const itemTitle = String(item?.title || '').trim()
      const matchedChild = focusableChildTasks.find((child) => {
        const childAssignmentId = String(child.assignmentId || '').trim()
        const childRole = String(child.targetRole || child.role || '').trim()
        const childSummary = String(child.summary || '').trim()
        if (itemId && childAssignmentId && childAssignmentId === itemId) return true
        if (itemRole && childRole && itemRole === childRole && itemTitle && childSummary && (childSummary.includes(itemTitle) || itemTitle.includes(childSummary))) return true
        return false
      })

      return {
        index,
        itemId,
        itemRole,
        itemTitle,
        objective: String(item?.objective || '').trim(),
        acceptance: String(item?.acceptance || '').trim(),
        deliverables: Array.isArray(item?.deliverables) ? item.deliverables : [],
        dependencies: Array.isArray(item?.dependencies) ? item.dependencies : [],
        matchedChild: matchedChild || null,
        matchState: matchedChild ? 'attached' : 'pending_attach',
      }
    })
  }, [latestReplanMap, focusableChildTasks])

  const executionSurfaceRows = useMemo(() => {
    const rows = Array.isArray(pipeline?.childTasks) ? pipeline.childTasks : []
    return rows.map((item: any) => ({
      taskId: String(item?.taskId || '').trim(),
      assignmentId: String(item?.assignmentId || '').trim(),
      title: String(item?.title || '').trim(),
      role: String(item?.role || '').trim(),
      state: String(item?.state || '').trim(),
      acceptance: String(item?.acceptance || '').trim(),
      requiredSkills: Array.isArray(item?.executionSurface?.requiredSkills) ? item.executionSurface.requiredSkills : [],
      requiredTools: Array.isArray(item?.executionSurface?.requiredTools) ? item.executionSurface.requiredTools : [],
      requiredMcpServers: Array.isArray(item?.executionSurface?.requiredMcpServers) ? item.executionSurface.requiredMcpServers : [],
    }))
  }, [pipeline])

  const executionSurfaceSummary = (workbench?.summary?.executionSurface || pipeline?.executionSurface || {}) as {
    childTaskCount?: number
    skillBoundCount?: number
    toolBoundCount?: number
    mcpBoundCount?: number
  }
  const memoryLayers = (workbench?.summary?.memoryLayers || workbench?.board?.memoryLayers || summaryPayload?.memoryLayers || pipeline?.memoryLayers || {}) as any
  const deliveryHistory = Array.isArray(workbench?.task?.metadata?.workbench?.history)
    ? workbench.task.metadata.workbench.history
    : Array.isArray(workbench?.board?.deliveryHistory)
      ? workbench.board.deliveryHistory
      : []
  const currentSubmission = workbench?.task?.metadata?.workbench?.currentSubmission || deliveryHistory[0] || null
  const previewArtifacts = Array.isArray(currentSubmission?.artifacts) ? currentSubmission.artifacts : []

  return (
    <>
      <ActionConfirmDialog
        open={Boolean(pendingActionMeta)}
        meta={pendingActionMeta}
        busy={Boolean(actionLoading)}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => pendingAction && void handleControlAction(pendingAction)}
      />
      <div className="flex h-full min-h-0 flex-col bg-[var(--surface)]">
      <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-[var(--fg)]">操作现场</div>
          </div>
          {task && (
            <div className="flex flex-wrap gap-1.5">
              <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">产物 {artifactCount}</span>
              <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">证据 {evidenceCount}</span>
              <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">风险 {issueCount}</span>
            </div>
          )}
        </div>
      </div>

      <div className="panel-scroll flex-1 min-h-0 space-y-3 overflow-y-auto p-3 md:p-4">
        {!taskId && (
          <PanelEmptyState
            icon={ClipboardList}
            title={t('workbench.pleaseSelectTask', '先从左侧选一条任务')}
            body={t('workbench.tip', '工作台会按交付、动作、结构三层给你收口')}
          />
        )}

        {taskId && loading && <PanelLoadingState text={t('workbench.loadingWorkbench', '正在加载工作台...')} />}

        {taskId && error && <PanelErrorState text={error} />}

        {taskId && !loading && !error && (
          <>
            <PanelWarningState title="有少量信息暂时不可见" items={partialWarnings} />

            <SummaryHeroSection
              stateText={stateLabel((task?.state || currentState) as any)}
              latestVerdictText={latestVerdict ? verdictLabel(latestVerdict) : null}
              deliverableReady={task?.deliverableReady}
              title={task?.title}
              executiveSummary={summary.executiveSummary || task?.executiveSummary || task?.planSummary}
              sceneLeadLabel={sceneLeadLabel}
              bossPrompt={bossPrompt}
              coreFacts={coreFacts.slice(0, 3)}
              artifactCount={artifactCount}
              evidenceCount={evidenceCount}
              issueCount={issueCount}
            />

            <WorkbenchDeliveryOverviewSection
              deliverableReady={deliveryClosure?.deliverableReady ?? task?.deliverableReady}
              humanInterventionReady={deliveryClosure?.humanInterventionReady ?? task?.humanInterventionReady}
              deliveryStatus={deliveryClosure?.deliveryStatus || summaryPayload?.deliveryStatus || summary.deliveryStatus || task?.deliveryStatus}
              interventionStatus={deliveryClosure?.interventionStatus || summaryPayload?.interventionStatus || task?.interventionStatus}
              executiveSummary={deliveryClosure?.executiveSummary || summaryPayload?.executiveSummary || summary.executiveSummary || task?.executiveSummary || task?.planSummary}
              resultCounters={{
                artifactCount: Number(deliveryClosure?.artifactCount || resultCounters?.artifactCount || task?.artifactCount || 0),
                evidenceCount: Number(deliveryClosure?.evidenceCount || resultCounters?.evidenceCount || task?.evidenceCount || 0),
                issueCount: Number(deliveryClosure?.issueCount || resultCounters?.issueCount || task?.issueCount || 0),
                revisionCount: Number(deliveryClosure?.revisionCount || resultCounters?.revisionCount || 0),
              }}
              nextBestAction={deliveryClosure?.nextBestAction || summaryPayload?.nextBestAction || summary.nextBestAction || task?.nextBestAction}
              currentMemberKey={summaryPayload?.currentMemberKey || summary.currentMemberKey || task?.currentMemberKey}
              currentDriver={summary.currentDriver || task?.currentDriver}
              sessionModeText={sessionModeText}
              sessionPersistent={sessionPersistent}
            />

            {isTerminalState && (
              <section className="surface-card surface-card-hero p-4 md:p-5">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--fg)]">
                  <Archive className="h-3.5 w-3.5 text-[var(--accent)]" /> 收口结果
                </div>

                <div className={`mt-3 rounded-2xl border p-4 ${terminalTone}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="soft-label border-current/20 bg-white/60 text-current">{stateLabel((task?.state || currentState) as any)}</span>
                    {archiveHit ? <span className="soft-label border-current/20 bg-white/60 text-current">已进入归档</span> : <span className="soft-label border-current/20 bg-white/60 text-current">归档待确认</span>}
                    <span className="soft-label border-current/20 bg-white/60 text-current">更新于 {formatDateTime(task?.updatedAt)}</span>
                  </div>
                  <div className="mt-3 text-[15px] font-semibold leading-6 text-[var(--fg)]">{terminalHeadline}</div>
                  <div className="mt-1 text-[12px] leading-5 text-[var(--fg-secondary)]">{terminalActionHint}</div>
                  <div className="mt-3 rounded-xl border border-current/15 bg-white/55 p-3 text-[12px] leading-5 text-[var(--fg-secondary)]">
                    {terminalSummary || '—'}
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="info-tile bg-[var(--surface-subtle)]">
                    <div className="text-[10px] text-[var(--fg-ghost)]">收口状态</div>
                    <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{stateLabel((task?.state || currentState) as any)}</div>
                  </div>
                  <div className="info-tile bg-[var(--surface-subtle)]">
                    <div className="text-[10px] text-[var(--fg-ghost)]">交付判断</div>
                    <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{deliveryStatusLabel(summaryPayload?.deliveryStatus || summary.deliveryStatus || task?.deliveryStatus)}</div>
                  </div>
                  <div className="info-tile bg-[var(--surface-subtle)]">
                    <div className="text-[10px] text-[var(--fg-ghost)]">人工结论</div>
                    <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{latestDecision ? decisionTypeLabel(latestDecision) : '已进入收口态'}</div>
                  </div>
                  <div className="info-tile bg-[var(--surface-subtle)]">
                    <div className="text-[10px] text-[var(--fg-ghost)]">归档状态</div>
                    <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{archiveHit ? `已命中（归档总数 ${archiveCount}）` : `未命中（归档总数 ${archiveCount}）`}</div>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <div className="info-tile bg-[var(--surface-subtle)]">
                    <div className="text-[10px] text-[var(--fg-ghost)]">建议查看</div>
                    <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{currentState === 'done' ? '交付内容与归档命中' : currentState === 'blocked' ? '阻塞原因与恢复入口' : '取消原因与保留资产'}</div>
                  </div>
                  <div className="info-tile bg-[var(--surface-subtle)]">
                    <div className="text-[10px] text-[var(--fg-ghost)]">风险提醒</div>
                    <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{issueCount > 0 ? `${issueCount} 个提醒仍可复查` : '没有额外风险提醒'}</div>
                  </div>
                  <div className="info-tile bg-[var(--surface-subtle)]">
                    <div className="text-[10px] text-[var(--fg-ghost)]">快捷入口</div>
                    <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{currentState === 'done' ? '优先去交付面验内容' : '优先看时间线与控制面'}</div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onFocusTarget?.({ openTab: 'deliverables', summary: terminalSummary })}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--success)]/25 bg-[var(--success-soft)] px-3 py-1.5 text-[11px] font-medium text-[var(--success)] transition hover:opacity-90"
                  >
                    <PackageOpen className="h-3.5 w-3.5" /> 查看交付
                  </button>
                  <button
                    type="button"
                    onClick={() => onFocusTarget?.({ openTab: 'timeline', summary: terminalSummary })}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-3 py-1.5 text-[11px] font-medium text-[var(--accent)] transition hover:opacity-90"
                  >
                    <Clock className="h-3.5 w-3.5" /> 查看进展
                  </button>
                  {deliveryArchiveHref ? (
                    <a
                      href={deliveryArchiveHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--fg-secondary)] transition hover:bg-[var(--surface-muted)]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> 打开归档
                    </a>
                  ) : null}
                </div>
              </section>
            )}

            <WorkbenchActionSection
              manualActions={manualActions}
              actionFeedback={actionFeedback}
              actionLoading={actionLoading}
              onPickAction={(action) => setPendingAction(action)}
              nextBestAction={summaryPayload?.nextBestAction || summary.nextBestAction || task?.nextBestAction}
              currentMemberKey={summaryPayload?.currentMemberKey || summary.currentMemberKey || task?.currentMemberKey}
              currentDriver={summary.currentDriver || task?.currentDriver}
              deliverableReady={task?.deliverableReady}
              humanInterventionReady={task?.humanInterventionReady}
              sessionModeText={sessionModeText}
              sessionPersistent={sessionPersistent}
            />

            <section className="surface-card p-4 md:p-5">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--fg)]">
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" /> 接力进展
              </div>
              <div className="mt-3">
                <StageTimeline state={currentState} lastMessage={currentStageMessage} lastRole={String(latestLive?.role || '')} />
              </div>
              {task?.state === 'done' && (
                <div className="mt-3 rounded-xl border border-[var(--success)] bg-[var(--success-soft)] p-3">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--success)]">
                    <CheckCircle2 className="h-4 w-4" /> 任务已收口
                  </div>
                  <div className="mt-1 text-[12px] leading-5 text-[var(--fg-secondary)]">
                    {latestDecision ? decisionTypeLabel(latestDecision) : '已完成'} · {formatDateTime(task?.updatedAt)}
                  </div>
                </div>
              )}
            </section>

            <WorkbenchReplanSection
              latestReplanResult={latestReplanResult}
              latestReplanMap={latestReplanMap}
              replanStructureRows={replanStructureRows}
              onFocusTarget={onFocusTarget}
            />

            <WorkbenchChildTasksSection
              focusableChildTasks={focusableChildTasks}
              onFocusTarget={onFocusTarget}
            />

            <WorkbenchMemorySection memoryLayers={memoryLayers} />

            <WorkbenchExecutionSurfaceSection
              executionSurfaceRows={executionSurfaceRows}
              executionSurfaceSummary={executionSurfaceSummary}
            />

            <SubtaskProgressPanel taskId={taskId} />

            <DeliveryTimeline history={deliveryHistory} />

            {previewArtifacts.length > 0 && (
              <section className="surface-card p-4 md:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] font-semibold text-[var(--fg)]">交付物预览</div>
                  <div className="text-[11px] text-[var(--fg-muted)]">当前版本 v{currentSubmission?.version || 0}</div>
                </div>
                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  {previewArtifacts.slice(0, 4).map((artifact: any) => (
                    <ArtifactPreview key={artifact.artifactId || artifact.title} artifact={artifact} />
                  ))}
                </div>
              </section>
            )}

            <section className="surface-card p-4 md:p-5">
              <div className="text-[13px] font-semibold text-[var(--fg)]">审批操作</div>
              <div className="mt-2 text-[12px] text-[var(--fg-muted)]">使用上方动作区进行 approve / reject / request-revision，原因会随控制动作一起写回。</div>
              {currentSubmission?.review && (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="info-tile bg-[var(--surface-subtle)]">
                    <div className="text-[10px] text-[var(--fg-ghost)]">Evidence 检查</div>
                    <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{currentSubmission.review.evidenceCheck?.ok ? '通过' : '待补齐'}</div>
                  </div>
                  <div className="info-tile bg-[var(--surface-subtle)]">
                    <div className="text-[10px] text-[var(--fg-ghost)]">Artifact 验证</div>
                    <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{currentSubmission.review.artifactCheck?.ok ? '通过' : '待补齐'}</div>
                  </div>
                  <div className="info-tile bg-[var(--surface-subtle)]">
                    <div className="text-[10px] text-[var(--fg-ghost)]">契约对照</div>
                    <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{currentSubmission.review.contractCheck?.ok ? '通过' : '未达标'}</div>
                  </div>
                </div>
              )}
            </section>

            <WorkbenchPeopleSection
              peopleView={peopleView}
              currentDriverKey={currentDriverKey}
            />

            <WorkbenchLiveFeedSection liveEvents={liveEvents} />

          </>
        )}
      </div>
      </div>
    </>
  )
}
