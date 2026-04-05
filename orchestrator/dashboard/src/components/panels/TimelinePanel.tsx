'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Clock, Activity, PackageOpen, FolderOpen } from 'lucide-react'
import { TimelineEntry, FocusTarget } from '@/lib/types'
import { fetchTimeline } from '@/lib/api'
import { formatExactTime } from '@/lib/utils'
import { focusSummaryLabel, focusAssignmentId, focusChildTaskId, hasTaskFocus, makeTaskFocusTarget, pickTaskFocusRef, withFocusOpenTab } from '@/lib/task-focus'
import { useLiveStore } from '@/lib/store'
import { EmptyState } from '@/components/EmptyState'

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

interface UnifiedEntry {
  id: string
  title: string
  summary: string
  createdAt: number
  source: 'api'
  focusTarget?: FocusTarget | null
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

export function TimelinePanel({
  taskId,
  focusTarget = null,
  onFocusTarget,
}: {
  taskId: string | null
  focusTarget?: FocusTarget | null
  onFocusTarget?: (target: FocusTarget | null) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [showAll, setShowAll] = useState(false)
  const INITIAL_LIMIT = 20

  useEffect(() => {
    let alive = true
    const run = async () => {
      if (!taskId) {
        setEntries([])
        return
      }
      setLoading(true)
      setError(null)
      try {
        const res = await fetchTimeline(taskId, 200)
        if (!res.ok) throw new Error(`API error: ${res.status}`)
        const data = await res.json()
        const list: TimelineEntry[] = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
        list.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0))

        if (alive) {
          setEntries(list)
        }
      } catch (e: any) {
        if (alive) setError(e?.message || '加载失败')
      } finally {
        if (alive) setLoading(false)
      }
    }
    run()
    return () => { alive = false }
  }, [taskId])

  useEffect(() => { setShowAll(false) }, [taskId])

  const unified: UnifiedEntry[] = []

  for (const entry of entries) {
    const assignmentId = focusAssignmentId(entry?.payload as Record<string, any>)
    const childTaskId = focusChildTaskId(entry?.payload as Record<string, any>)
    const summary = readableSummary(entry.kind, entry.payload) || '有一条新的任务进展'
    const isReplan = entry.kind === 'task.replan.result'
    unified.push({
      id: entry.messageId || `${entry.kind}-${entry.createdAt}`,
      title: kindLabels[entry.kind] || '任务进展',
      summary,
      createdAt: Number(entry.createdAt || 0),
      source: 'api',
      focusTarget: hasTaskFocus(entry?.payload as Record<string, any>) ? makeTaskFocusTarget({
        ...pickTaskFocusRef(entry?.payload as Record<string, any>),
        openTab: 'timeline',
        summary,
        intent: isReplan ? 'replan' : undefined,
        sourceKind: isReplan ? 'replan' : 'timeline',
        timelineMessageId: entry.messageId || undefined,
        replanCreatedAt: isReplan ? Number(entry.createdAt || 0) : undefined,
      }) : null,
    })
  }

  unified.sort((a, b) => b.createdAt - a.createdAt)
  const visible = showAll ? unified : unified.slice(0, INITIAL_LIMIT)
  const focusSummary = useMemo(() => focusSummaryLabel(focusTarget), [focusTarget])
  const hasMore = unified.length > INITIAL_LIMIT && !showAll
  const progressPulse = unified.some((entry) => entry.title.includes('进入执行') || entry.title.includes('产出结果'))
    ? '这条主线已经进入执行推进区。'
    : unified.some((entry) => entry.title.includes('完成裁决') || entry.title.includes('提交方案'))
      ? '这条主线已经完成前序判断，正在往执行前夜推进。'
      : unified.length > 0
        ? '这条主线已经开始滚动，但还在早期协作阶段。'
        : '这条主线暂时还没有形成可读脉络。'

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--surface)]">
      <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
        <div className="text-sm font-semibold text-[var(--fg)]">任务脉络</div>
        <div className="mt-0.5 text-[11px] text-[var(--fg-muted)]">按时间查看这条线的推进记录。</div>
        {focusSummary && <div className="mt-2 text-[11px] text-[var(--fg-ghost)]">{focusSummary}</div>}
      </div>
      <div className="panel-scroll flex-1 min-h-0 overflow-y-auto p-3 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] md:p-4 md:pb-4">
        {!taskId && <EmptyState icon={<Clock className="h-5 w-5" />} title="请选择任务" desc="从任务台选择一个任务，查看它的进展记录" tone="default" compact />}
        {taskId && loading && (
          <div className="surface-card flex items-center gap-2 p-4 text-sm text-[var(--fg-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" /> 加载中
          </div>
        )}
        {taskId && error && <div className="surface-card border-[var(--danger)] bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]">{error}</div>}
        {taskId && !loading && !error && (
          <>
            <div className="mb-3 space-y-2">
              <div className="surface-card-subtle bg-[var(--surface)]/95 px-3.5 py-3 text-[12px] leading-5 text-[var(--fg-secondary)]">
                <span className="font-medium text-[var(--fg)]">主线判断：</span>
                {progressPulse}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="info-tile bg-[var(--surface-subtle)]">
                  <div className="text-[10px] text-[var(--fg-ghost)]">记录数</div>
                  <div className="mt-1 text-sm font-semibold text-[var(--fg)]">{unified.length}</div>
                </div>
                <div className="info-tile bg-[var(--surface-subtle)]">
                  <div className="text-[10px] text-[var(--fg-ghost)]">最新更新时间</div>
                  <div className="mt-1 truncate text-sm font-semibold text-[var(--fg)]">{unified[0] ? formatExactTime(unified[0].createdAt) : '--'}</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {visible.length === 0 ? (
                <div className="py-4">
                  <EmptyState icon={<Activity className="h-5 w-5" />} title="暂无进展记录" desc="稍后再来，这里会出现任务推进过程" tone="accent" compact />
                </div>
              ) : (
                <>
                  {visible.map((entry) => {
                    const entryFocusChildTaskId = focusChildTaskId(entry.focusTarget as Record<string, any>)
                    const entryFocusAssignmentId = focusAssignmentId(entry.focusTarget as Record<string, any>)
                    const currentFocusChildTaskId = focusChildTaskId(focusTarget as Record<string, any>)
                    const currentFocusAssignmentId = focusAssignmentId(focusTarget as Record<string, any>)
                    const isFocused = Boolean(entry.focusTarget && (
                      (entryFocusChildTaskId && entryFocusChildTaskId === currentFocusChildTaskId)
                      || (entryFocusAssignmentId && entryFocusAssignmentId === currentFocusAssignmentId)
                    ))
                    return (
                      <div key={entry.id} className={`surface-card-interactive p-3 ${isFocused ? 'border-[var(--accent)] bg-[var(--accent-soft)]/40' : ''}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 text-[13px] font-medium text-[var(--fg)]">{entry.title}</div>
                          <div className="shrink-0 text-[11px] text-[var(--fg-muted)]">{formatExactTime(entry.createdAt)}</div>
                        </div>
                        <div className="mt-1 text-[12px] leading-5 text-[var(--fg-muted)]">{entry.summary}</div>
                        {entry.focusTarget && onFocusTarget && (
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
                              <FolderOpen className="h-3.5 w-3.5" /> 查看文件
                            </button>
                            {entry.focusTarget?.sourceKind === 'replan' && (
                              <button
                                type="button"
                                onClick={() => onFocusTarget(withFocusOpenTab(entry.focusTarget, 'timeline'))}
                                className="inline-flex items-center gap-1 rounded-lg border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-3 py-1.5 text-[11px] font-medium text-[var(--accent)] transition hover:opacity-90"
                              >
                                定位这次重排
                              </button>
                            )}
                            {isFocused && (
                              <button
                                type="button"
                                onClick={() => onFocusTarget(null)}
                                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--fg-secondary)] transition hover:bg-[var(--surface-muted)]"
                              >
                                清除定位
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {hasMore && (
                    <button
                      onClick={() => setShowAll(true)}
                      className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[11px] font-medium text-[var(--fg-muted)] transition hover:bg-[var(--surface-subtle)] touch-manipulation press-scale"
                    >
                      查看全部 {unified.length} 条记录
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
