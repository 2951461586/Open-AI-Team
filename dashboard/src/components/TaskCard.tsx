'use client'

import { TaskCard as TaskCardType, TaskState } from '@/lib/types'
import { AlertCircle, ChevronRight, FileText, ShieldCheck } from 'lucide-react'
import { formatTime, stateLabel, roleLabel, nodeLabel, nextBestActionLabel, cn, sessionModeLabel } from '@/lib/utils'

interface Props {
  task: TaskCardType
  onClick?: () => void
  selected?: boolean
}

const roleStyles: Record<string, string> = {
  planner: 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]',
  critic: 'border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]',
  judge: 'border-[var(--node-violet)] bg-[var(--node-violet)]/10 text-[var(--node-violet)]',
  assistant: 'border-[var(--border)] bg-[var(--overlay-light)] text-[var(--fg-secondary)]',
  executor: 'border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]',
}

const nodeBadgeStyles: Record<string, string> = {
  laoda: 'border-[var(--node-laoda)] bg-[var(--node-laoda)]/10 text-[var(--node-laoda)]',
  violet: 'border-[var(--node-violet)] bg-[var(--node-violet)]/10 text-[var(--node-violet)]',
  lebang: 'border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]',
}

const stateDotColors: Record<TaskState, string> = {
  pending: 'bg-[var(--fg-ghost)]',
  planning: 'bg-[var(--node-laoda)]',
  plan_review: 'bg-[var(--warning)]',
  approved: 'bg-[var(--success)]',
  revision_requested: 'bg-[var(--warning)]',
  done: 'bg-[var(--success)]',
  blocked: 'bg-[var(--danger)]',
  cancelled: 'bg-[var(--fg-ghost)]',
}

export function TaskCard({ task, onClick, selected = false }: Props) {
  const rawDriverKey = String(task.currentDriver || '').toLowerCase()
  const roleKey = rawDriverKey.split(/[.:]/)[0] || rawDriverKey
  const roleClass = roleStyles[roleKey] || 'border-[var(--border)] bg-[var(--overlay-light)] text-[var(--fg-secondary)]'

  const currentMemberKey = String(task.currentMemberKey || '').toLowerCase()
  const requestedNode = String(task.requestedNode || '')
  const actualNode = String(task.actualNode || '')
  const driverParts = (currentMemberKey || rawDriverKey).split(/[.:]/).filter(Boolean)
  const nodeKey = (actualNode || driverParts[driverParts.length - 1] || requestedNode || '').toLowerCase()
  const nodeBadge = nodeLabel(nodeKey)
  const nodeClass = nodeBadgeStyles[nodeKey] || 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-muted)]'

  const summaryText = task.executiveSummary || task.planSummary || '等待团队沉淀共识'
  const signalCount = Number(task.artifactCount || 0) + Number(task.evidenceCount || 0) + Number(task.issueCount || 0)
  const driverLabel = task.currentDriver ? roleLabel(task.currentDriver) : '待分配'
  const nextRelayLabel = task.humanInterventionReady
    ? '等待人工处理'
    : task.deliverableReady
      ? '进入交付确认'
      : nextBestActionLabel(task.nextBestAction)
  const scenePulse = task.humanInterventionReady
    ? '等待老板接管'
    : task.deliverableReady
      ? '交付窗口已打开'
      : signalCount > 0
        ? '现场已有结果沉淀'
        : '团队正在铺路推进'
  const decisionPulse = task.humanInterventionReady
    ? '现在该你拍板'
    : task.deliverableReady
      ? '可以开始验收'
      : task.issueCount > 0
        ? '先看风险信号'
        : '先让团队继续跑'
  const executionModeLabel = task.sessionMode
    ? sessionModeLabel({ sessionMode: task.sessionMode, sessionPersistent: task.sessionPersistent })
    : '标准会话'
  const routeLabel = actualNode || requestedNode || nodeBadge || '待分配'

  return (
    <button
      type="button"
      onClick={onClick}
      data-task-card="true"
      className={cn(
        'group block w-full min-w-0 max-w-full overflow-hidden rounded-[22px] border-2 border-[var(--border)] bg-[var(--background)] px-4 py-4 text-left shadow-[var(--shadow-sm)] transition duration-150 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface)] hover:shadow-[var(--shadow-md)] active:translate-y-0 active:shadow-[var(--shadow-sm)]',
        selected && 'border-[var(--accent)] bg-[var(--surface)] shadow-[var(--shadow-md)]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-medium text-[var(--fg-secondary)]">
              <span className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0_2px_var(--surface)]', stateDotColors[task.state] || stateDotColors.pending)} />
              {stateLabel(task.state)}
            </span>
            <span className="text-[var(--fg-ghost)]">更新于 {formatTime(task.updatedAt)}</span>
            {task.humanInterventionReady && (
              <span className={cn('inline-flex items-center gap-1 rounded-full border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--danger)] shadow-[var(--shadow-xs)]', selected && 'border-transparent')}>
                <AlertCircle className="h-3 w-3" />
                需人工处理
              </span>
            )}
          </div>

          <h3 className="mt-2.5 break-words text-[15px] font-semibold leading-6 text-[var(--fg)] [overflow-wrap:anywhere] line-clamp-2 md:line-clamp-3">
            {task.title || '无标题'}
          </h3>

          <p className="mt-2 break-words text-[12px] leading-5 text-[var(--fg-muted)] [overflow-wrap:anywhere] line-clamp-4">
            {summaryText}
          </p>

          <div className="mt-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2.5 text-[11px] text-[var(--fg-muted)]">
            <div className="grid gap-1.5 md:grid-cols-2">
              <span><span className="text-[var(--fg-ghost)]">当前角色：</span>{driverLabel}</span>
              <span><span className="text-[var(--fg-ghost)]">下一动作：</span>{nextRelayLabel}</span>
              <span><span className="text-[var(--fg-ghost)]">现场态势：</span>{scenePulse}</span>
              <span><span className="text-[var(--fg-ghost)]">人工位：</span>{decisionPulse}</span>
              <span><span className="text-[var(--fg-ghost)]">路由落点：</span>{routeLabel}</span>
              <span><span className="text-[var(--fg-ghost)]">会话模式：</span>{executionModeLabel}</span>
            </div>
          </div>
        </div>

        <ChevronRight className={cn('mt-1 hidden h-4 w-4 shrink-0 text-[var(--fg-ghost)] transition group-hover:text-[var(--fg-secondary)] sm:block', selected && 'text-[var(--accent)]')} />
      </div>

      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-1.5">
        {task.currentDriver && (
          <span className={cn(roleClass, 'soft-label max-w-full px-2 py-1 text-[10px] leading-4 shadow-[var(--shadow-xs)]', selected && 'border-transparent')}>
            {roleLabel(task.currentDriver)}
          </span>
        )}
        {nodeBadge && (
          <span className={cn(nodeClass, 'soft-label max-w-full px-2 py-1 text-[10px] leading-4 shadow-[var(--shadow-xs)]', selected && 'border-transparent')}>
            {nodeBadge}
          </span>
        )}
        {task.deliverableReady && (
          <span className={cn('soft-label max-w-full border-[var(--success)] bg-[var(--success-soft)] px-2 py-1 text-[10px] leading-4 text-[var(--success)] shadow-[var(--shadow-xs)]', selected && 'border-transparent')}>
            可交付
          </span>
        )}
        <span className={cn(`soft-label max-w-full px-2 py-1 text-[10px] leading-4 shadow-[var(--shadow-xs)] ${task.sessionPersistent ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]'}`, selected && 'border-transparent')}>
          {executionModeLabel}
        </span>
        {task.issueCount > 0 && (
          <span className={cn('soft-label max-w-full border-[var(--warning)] bg-[var(--warning-soft)] px-2 py-1 text-[10px] leading-4 text-[var(--warning)] shadow-[var(--shadow-xs)]', selected && 'border-transparent')}>
            {task.issueCount} 个问题
          </span>
        )}
      </div>

      <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3 text-[11px] text-[var(--fg-muted)]">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <FileText className="h-3 w-3 shrink-0" />
            {task.artifactCount} 产物
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 shrink-0" />
            {task.evidenceCount} 证据
          </span>
          {signalCount === 0 && <span className="text-[var(--fg-ghost)]">现场还在铺第一批结果</span>}
        </div>

        <div className={cn('ml-auto inline-flex shrink-0 items-center gap-1 text-[10px] font-medium', selected ? 'text-[var(--accent)]' : 'text-[var(--fg-ghost)]')}>
          {selected ? '现场已打开' : '进入现场'}
        </div>
      </div>
    </button>
  )
}
