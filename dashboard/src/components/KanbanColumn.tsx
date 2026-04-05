'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { TaskCard } from './TaskCard'
import { TaskCard as TaskCardType, TaskState } from '@/lib/types'
import { stateLabel } from '@/lib/utils'

interface Props {
  state: TaskState
  tasks: TaskCardType[]
  onTaskSelect?: (taskId: string) => void
  selectedTaskId?: string | null
}

type PageToken = number | 'ellipsis'

const PAGE_SIZE = 4
const MAX_VISIBLE_PAGE_BUTTONS = 5

const toneMap: Record<TaskState, string> = {
  pending: 'bg-[var(--surface-muted)] text-[var(--fg-secondary)]',
  planning: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  plan_review: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  approved: 'bg-[var(--success-soft)] text-[var(--success)]',
  revision_requested: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  done: 'bg-[var(--success-soft)] text-[var(--success)]',
  blocked: 'bg-[var(--danger-soft)] text-[var(--danger)]',
  cancelled: 'bg-[var(--surface-muted)] text-[var(--fg-muted)]',
}

const stateHintMap: Record<TaskState, string> = {
  pending: '新任务已进场，等待团队认领与起跑。',
  planning: '规划师正在拆解目标、路径与风险。',
  plan_review: '评审官与裁决官正在校对方案可行性。',
  approved: '方案已放行，现场准备转入真实执行。',
  revision_requested: '方案已打回修订，等待重新接棒。',
  done: '任务已收口，可回看交付与过程记录。',
  blocked: '现场遇到阻塞，等待人工或条件恢复。',
  cancelled: '这条主线已停，现场保留供回看。',
}

function buildPageTokens(currentPage: number, totalPages: number): PageToken[] {
  if (totalPages <= MAX_VISIBLE_PAGE_BUTTONS) {
    return Array.from({ length: totalPages }, (_, idx) => idx)
  }

  const tokens: PageToken[] = [0]
  const start = Math.max(1, currentPage - 1)
  const end = Math.min(totalPages - 2, currentPage + 1)

  if (start > 1) tokens.push('ellipsis')
  for (let idx = start; idx <= end; idx += 1) tokens.push(idx)
  if (end < totalPages - 2) tokens.push('ellipsis')

  tokens.push(totalPages - 1)
  return tokens
}

export function KanbanColumn({ state, tasks, onTaskSelect, selectedTaskId }: Props) {
  const [page, setPage] = useState(0)

  const totalPages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE))

  useEffect(() => {
    if (!tasks.length) {
      setPage(0)
      return
    }

    if (selectedTaskId) {
      const selectedIndex = tasks.findIndex((task) => task.taskId === selectedTaskId)
      if (selectedIndex >= 0) {
        const selectedPage = Math.floor(selectedIndex / PAGE_SIZE)
        setPage((prev) => (prev === selectedPage ? prev : selectedPage))
        return
      }
    }

    setPage((prev) => Math.min(prev, totalPages - 1))
  }, [selectedTaskId, tasks, totalPages])

  const pageStart = tasks.length === 0 ? 0 : page * PAGE_SIZE + 1
  const pageEnd = tasks.length === 0 ? 0 : Math.min(tasks.length, (page + 1) * PAGE_SIZE)

  const visibleTasks = useMemo(() => {
    const start = page * PAGE_SIZE
    return tasks.slice(start, start + PAGE_SIZE)
  }, [page, tasks])

  const pageTokens = useMemo(() => buildPageTokens(page, totalPages), [page, totalPages])
  const canGoPrev = page > 0
  const canGoNext = page < totalPages - 1

  return (
    <section className="flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-[var(--shadow-md)] md:p-3.5">
      <div className="mb-3 flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-sm font-semibold tracking-[0.01em] text-[var(--fg)]">{stateLabel(state)}</h2>
            <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold shadow-[var(--shadow-xs)] ${toneMap[state] || toneMap.pending}`}>
              {tasks.length}
            </span>
          </div>
          <div className="mt-1 text-[11px] leading-5 text-[var(--fg-muted)]/90">{stateHintMap[state]}</div>
        </div>

        <div className="shrink-0 text-right">
          <div className="rounded-full border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-[10px] font-medium text-[var(--fg-muted)] shadow-[var(--shadow-xs)]">
            {tasks.length === 0 ? '空列' : `${pageStart}-${pageEnd} / ${tasks.length}`}
          </div>
          {tasks.length > PAGE_SIZE && (
            <div className="mt-2 flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                disabled={!canGoPrev}
                aria-label={`上一页，${stateLabel(state)}`}
                title="上一页"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] shadow-[var(--shadow-xs)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-subtle)] hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="min-w-[72px] rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-center text-[11px] font-medium text-[var(--fg-muted)] shadow-[var(--shadow-xs)]">
                第 {page + 1} / {totalPages} 页
              </div>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))}
                disabled={!canGoNext}
                aria-label={`下一页，${stateLabel(state)}`}
                title="下一页"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] shadow-[var(--shadow-xs)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-subtle)] hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-w-0 max-w-full flex-1 flex-col gap-3">
        {tasks.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--surface)]/75 px-4 py-10 text-center shadow-[inset_0_1px_0_var(--overlay-strong)]">
            <div className="text-sm text-[var(--fg-muted)]">这一段暂时没人接力</div>
            <div className="mt-1 text-[11px] leading-5 text-[var(--fg-ghost)]">等新的协作信号进来后，这里会自动亮起来。</div>
          </div>
        ) : (
          visibleTasks.map((task) => (
            <TaskCard
              key={task.taskId}
              task={task}
              selected={selectedTaskId === task.taskId}
              onClick={() => onTaskSelect?.(task.taskId)}
            />
          ))
        )}
      </div>

      {tasks.length > PAGE_SIZE && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3 text-[11px] text-[var(--fg-muted)]">
          <div>当前显示 {pageStart}-{pageEnd}</div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {pageTokens.map((token, idx) => {
              if (token === 'ellipsis') {
                return (
                  <span
                    key={`${state}-ellipsis-${idx}`}
                    className="inline-flex h-7 min-w-[24px] items-center justify-center px-1 text-[var(--fg-ghost)]"
                    aria-hidden="true"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </span>
                )
              }

              const active = token === page
              return (
                <button
                  key={`${state}-page-${token}`}
                  type="button"
                  onClick={() => setPage(token)}
                  aria-label={`切换到第 ${token + 1} 页，${stateLabel(state)}`}
                  title={`第 ${token + 1} 页`}
                  className={`inline-flex h-7 min-w-[32px] items-center justify-center rounded-full border px-2 text-[11px] font-medium transition ${active ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[var(--shadow-xs)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] shadow-[var(--shadow-xs)] hover:bg-[var(--surface-subtle)] hover:text-[var(--fg)]'}`}
                >
                  {token + 1}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
