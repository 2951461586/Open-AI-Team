'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, Filter, ChevronLeft, ChevronRight, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { KanbanColumn } from '@/components/KanbanColumn'
import { useTaskStore } from '@/lib/store'
import { TaskState, KANBAN_ORDER, groupTasksByState } from '@/lib/types'
import { fetchDashboard } from '@/lib/api'

const PRIMARY_STAGES: TaskState[] = ['pending', 'planning', 'plan_review', 'approved', 'revision_requested']
const SECONDARY_STAGES: TaskState[] = ['blocked', 'done', 'cancelled']
const DESKTOP_SECTION_MIN_COL_WIDTH = 420

const KANBAN_LABELS: Record<TaskState, string> = {
  pending: '待处理',
  planning: '规划中',
  plan_review: '评审中',
  approved: '已批准',
  revision_requested: '需修订',
  done: '已完成',
  blocked: '已阻塞',
  cancelled: '已取消',
}

function SectionHeader({ title, desc, count, tone = 'default' }: { title: string; desc: string; count: number; tone?: 'default' | 'accent' | 'warning' }) {
  const toneClass =
    tone === 'accent'
      ? 'border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent)]'
      : tone === 'warning'
        ? 'border-[var(--warning)]/20 bg-[var(--warning-soft)] text-[var(--warning)]'
        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]'

  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[var(--fg)]">{title}</div>
        <div className="mt-0.5 text-[11px] text-[var(--fg-muted)]">{desc}</div>
      </div>
      <div className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass}`}>{count} 项</div>
    </div>
  )
}

interface Props {
  rightPanelCollapsed?: boolean
  onToggleRightPanel?: () => void
}

export function KanbanView({ rightPanelCollapsed = false, onToggleRightPanel }: Props) {
  const { tasks, selectedTaskId, setSelectedTaskId, hasMore, cursor, totalCount } = useTaskStore()
  const onTaskSelect = useCallback((taskId: string | null) => setSelectedTaskId(taskId), [setSelectedTaskId])

  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState<TaskState | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeStage, setActiveStage] = useState<TaskState>('pending')

  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    if (!query.trim() && !stateFilter) return tasks
    let list = tasks
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((t) =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.executiveSummary || '').toLowerCase().includes(q) ||
        (t.currentDriver || '').toLowerCase().includes(q) ||
        (t.taskId || '').toLowerCase().includes(q)
      )
    }
    if (stateFilter) list = list.filter((t) => t.state === stateFilter)
    return list
  }, [tasks, query, stateFilter])

  const grouped = useMemo(() => groupTasksByState(filtered), [filtered])

  const visibleGroups = useMemo(() => {
    if (stateFilter) return [stateFilter]
    return KANBAN_ORDER
  }, [stateFilter])

  const firstNonEmptyStage = useMemo(() => {
    return visibleGroups.find((state) => (grouped[state] || []).length > 0) || visibleGroups[0] || 'pending'
  }, [grouped, visibleGroups])

  useEffect(() => {
    if (stateFilter) {
      setActiveStage(stateFilter)
      return
    }
    setActiveStage((current) => {
      if (!visibleGroups.includes(current)) return firstNonEmptyStage
      return current === 'pending' && (grouped[current] || []).length === 0 ? firstNonEmptyStage : current
    })
  }, [firstNonEmptyStage, grouped, stateFilter, visibleGroups])

  const loadMoreTasks = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const res = await fetchDashboard(100, cursor)
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const json = await res.json()
      const dashboard = json?.dashboard || json?.payload?.dashboard
      if (!dashboard || typeof dashboard !== 'object') throw new Error('Invalid dashboard payload')
      const cards = Array.isArray(dashboard.cards) ? dashboard.cards : []
      useTaskStore.getState().appendTasks(
        cards,
        Number(dashboard.cursor || 0),
        Boolean(dashboard.hasMore),
        Number(dashboard.totalCount || totalCount || cards.length)
      )
    } catch (err) {
      console.error('Load more dashboard tasks failed:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [cursor, hasMore, loadingMore, totalCount])

  const clearFilter = () => {
    setQuery('')
    setStateFilter(null)
    inputRef.current?.focus()
  }

  const hasFilter = Boolean(query.trim() || stateFilter)
  const activeStageIndex = useMemo(() => visibleGroups.indexOf(activeStage), [activeStage, visibleGroups])
  const canMoveToPrevStage = !stateFilter && activeStageIndex > 0
  const canMoveToNextStage = !stateFilter && activeStageIndex >= 0 && activeStageIndex < visibleGroups.length - 1

  const switchStageRelative = useCallback((direction: -1 | 1) => {
    if (stateFilter || visibleGroups.length === 0) return
    const baseIndex = activeStageIndex >= 0 ? activeStageIndex : 0
    const nextIndex = Math.min(visibleGroups.length - 1, Math.max(0, baseIndex + direction))
    const nextStage = visibleGroups[nextIndex]
    if (nextStage) setActiveStage(nextStage)
  }, [activeStageIndex, stateFilter, visibleGroups])

  const primaryVisibleGroups = useMemo(() => PRIMARY_STAGES.filter((state) => visibleGroups.includes(state)), [visibleGroups])
  const secondaryVisibleGroups = useMemo(() => SECONDARY_STAGES.filter((state) => visibleGroups.includes(state)), [visibleGroups])

  const primaryCount = useMemo(() => primaryVisibleGroups.reduce((sum, state) => sum + (grouped[state] || []).length, 0), [grouped, primaryVisibleGroups])
  const secondaryCount = useMemo(() => secondaryVisibleGroups.reduce((sum, state) => sum + (grouped[state] || []).length, 0), [grouped, secondaryVisibleGroups])

  const mobileStage = stateFilter || activeStage
  const mobileStageCount = (grouped[mobileStage] || []).length

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
      {/* Compact toolbar */}
      <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface)]/95 px-3 py-2.5 md:px-5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative min-w-[180px] flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--fg-ghost)]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索任务…"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1.5 pl-8 pr-8 text-[12px] text-[var(--fg)] outline-none placeholder:text-[var(--fg-ghost)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-ghost)] hover:text-[var(--fg-secondary)]">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* State filters */}
          <div className="flex flex-wrap items-center gap-1">
            {KANBAN_ORDER.map((state) => {
              const active = stateFilter === state
              const count = (grouped[state] || []).length
              return (
                <button
                  key={state}
                  onClick={() => setStateFilter(active ? null : state)}
                  className={`touch-manipulation inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium transition ${active ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-[var(--fg-muted)] hover:border-[var(--border)] hover:text-[var(--fg-secondary)]'}`}
                >
                  {KANBAN_LABELS[state]}
                  <span className={`rounded-full px-1 text-[9px] ${active ? 'text-[var(--accent)]' : 'text-[var(--fg-ghost)]'}`}>
                    {count}
                  </span>
                </button>
              )
            })}

            {hasFilter && (
              <button
                onClick={clearFilter}
                className="touch-manipulation inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-1 text-[10px] text-[var(--fg-ghost)] hover:bg-[var(--surface-subtle)]"
              >
                <Filter className="h-3 w-3" />重置
              </button>
            )}
          </div>

          {/* Right panel toggle */}
          {onToggleRightPanel && (
            <button
              type="button"
              onClick={onToggleRightPanel}
              className="hidden 2xl:inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--fg-secondary)] transition hover:bg-[var(--surface-subtle)]"
              aria-label={rightPanelCollapsed ? '显示详情' : '隐藏详情'}
            >
              {rightPanelCollapsed ? <PanelRightOpen className="h-3.5 w-3.5" /> : <PanelRightClose className="h-3.5 w-3.5" />}
              {rightPanelCollapsed ? '详情' : '收起'}
            </button>
          )}
        </div>
      </div>

      {/* Task columns */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-3 md:p-5">
          {/* Desktop */}
          <div className="hidden md:block">
            {stateFilter ? (
              <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <SectionHeader
                  title={`筛选 · ${KANBAN_LABELS[stateFilter]}`}
                  desc="当前仅展示单一阶段"
                  count={(grouped[stateFilter] || []).length}
                  tone="accent"
                />
                <div className="grid grid-cols-1 gap-4 xl:max-w-[760px]">
                  <KanbanColumn
                    state={stateFilter}
                    tasks={grouped[stateFilter] || []}
                    selectedTaskId={selectedTaskId}
                    onTaskSelect={onTaskSelect}
                  />
                </div>
              </section>
            ) : (
              <div className="space-y-4">
                {primaryVisibleGroups.length > 0 && (
                  <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                    <SectionHeader
                      title="主线"
                      desc="待处理到执行前的任务"
                      count={primaryCount}
                      tone="accent"
                    />
                    <div
                      className="grid gap-4"
                      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${DESKTOP_SECTION_MIN_COL_WIDTH}px, 1fr))` }}
                    >
                      {primaryVisibleGroups.map((state) => (
                        <KanbanColumn
                          key={`primary-${state}`}
                          state={state}
                          tasks={grouped[state] || []}
                          selectedTaskId={selectedTaskId}
                          onTaskSelect={onTaskSelect}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {secondaryVisibleGroups.length > 0 && (
                  <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                    <SectionHeader
                      title="收口"
                      desc="已完成、已阻塞、已取消"
                      count={secondaryCount}
                      tone="warning"
                    />
                    <div
                      className="grid gap-4"
                      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${DESKTOP_SECTION_MIN_COL_WIDTH}px, 1fr))` }}
                    >
                      {secondaryVisibleGroups.map((state) => (
                        <KanbanColumn
                          key={`secondary-${state}`}
                          state={state}
                          tasks={grouped[state] || []}
                          selectedTaskId={selectedTaskId}
                          onTaskSelect={onTaskSelect}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>

          {/* Mobile */}
          <div className="space-y-3 md:hidden">
            {!stateFilter && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="rounded-full border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent)]">
                    {KANBAN_LABELS[mobileStage]}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => switchStageRelative(-1)}
                      disabled={!canMoveToPrevStage}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)] transition disabled:opacity-40"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => switchStageRelative(1)}
                      disabled={!canMoveToNextStage}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)] transition disabled:opacity-40"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="scrollbar-none mt-2 flex gap-1.5 overflow-x-auto pb-1">
                  {KANBAN_ORDER.map((state) => {
                    const focused = mobileStage === state
                    const count = (grouped[state] || []).length
                    return (
                      <button
                        key={`jump-${state}`}
                        type="button"
                        onClick={() => setActiveStage(state)}
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${focused ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]'}`}
                      >
                        {KANBAN_LABELS[state]}
                        <span className={`text-[9px] ${focused ? 'text-[var(--accent)]' : 'text-[var(--fg-muted)]'}`}>{count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="min-w-0">
              <KanbanColumn
                key={`mobile-${mobileStage}`}
                state={mobileStage}
                tasks={grouped[mobileStage] || []}
                selectedTaskId={selectedTaskId}
                onTaskSelect={onTaskSelect}
              />
            </div>

            {!stateFilter && (
              <div className="text-center text-[11px] text-[var(--fg-ghost)]">
                {KANBAN_LABELS[mobileStage]} · {mobileStageCount} 个任务
              </div>
            )}
          </div>

          {/* Load more + count */}
          <div className="mt-4 flex flex-col items-center gap-2 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] md:pb-4">
            <div className="text-[11px] text-[var(--fg-muted)]">已加载 {tasks.length} / {Math.max(totalCount || tasks.length, tasks.length)}</div>
            {hasMore && !hasFilter && (
              <button
                type="button"
                onClick={loadMoreTasks}
                disabled={loadingMore}
                className="inline-flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--fg-secondary)] transition hover:bg-[var(--surface-subtle)] disabled:opacity-60"
              >
                {loadingMore ? '加载中…' : '加载更多'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
