import { Loader2, RefreshCcw, ShieldCheck, RotateCcw, CheckCircle2, PauseCircle, Ban } from 'lucide-react'

export type ControlActionMeta = {
  label: string
  desc: string
  reason: string
  tone: string
  Icon: any
  confirm: string
}

export const CONTROL_ACTION_META: Record<string, ControlActionMeta> = {
  rerun_review: {
    label: '重新评审',
    desc: '把当前结果重新送回 critic 再审一轮。',
    reason: 'manual_rerun_review_from_dashboard',
    tone: 'border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent)]',
    Icon: RefreshCcw,
    confirm: '确认重新发起评审？这会把任务拉回评审阶段。',
  },
  rerun_judge: {
    label: '重新裁决',
    desc: '让 judge 基于当前结果重新拍板。',
    reason: 'manual_rerun_judge_from_dashboard',
    tone: 'border-[var(--node-violet)]/20 bg-[var(--node-violet)]/10 text-[var(--node-violet)]',
    Icon: ShieldCheck,
    confirm: '确认重新发起裁决？这会把任务送回 judge。',
  },
  reset_to_planning: {
    label: '退回规划',
    desc: '当前方向不对，退回 planning 重新整理方案。',
    reason: 'manual_reset_to_planning_from_dashboard',
    tone: 'border-[var(--warning)]/20 bg-[var(--warning-soft)] text-[var(--warning)]',
    Icon: RotateCcw,
    confirm: '确认退回规划？这会重开当前主线的规划阶段。',
  },
  manual_done: {
    label: '人工收口',
    desc: '老板直接确认完成，把这条线收口为 done。',
    reason: 'manual_done_from_dashboard',
    tone: 'border-[var(--success)]/20 bg-[var(--success-soft)] text-[var(--success)]',
    Icon: CheckCircle2,
    confirm: '确认人工收口并标记完成？',
  },
  manual_block: {
    label: '人工阻塞',
    desc: '这条线先挂起，明确标记为 blocked。',
    reason: 'manual_block_from_dashboard',
    tone: 'border-[var(--warning)]/20 bg-[var(--warning-soft)] text-[var(--warning)]',
    Icon: PauseCircle,
    confirm: '确认把这条线标记为 blocked？',
  },
  manual_cancel: {
    label: '取消任务',
    desc: '明确终止这条任务线，进入 cancelled。',
    reason: 'manual_cancel_from_dashboard',
    tone: 'border-[var(--danger)]/20 bg-[var(--danger-soft)] text-[var(--danger)]',
    Icon: Ban,
    confirm: '确认取消这条任务？这个动作会终止当前主线。',
  },
}

export function ActionConfirmDialog({
  open,
  meta,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean
  meta: { label: string; desc: string; tone: string; confirm: string; Icon: any } | null
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open || !meta) return null
  const Icon = meta.Icon
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4" onClick={busy ? undefined : onCancel}>
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-[var(--fg)]">确认执行「{meta.label}」</div>
            <div className="mt-1 text-[12px] leading-5 text-[var(--fg-muted)]">{meta.desc}</div>
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-3 text-[13px] leading-6 text-[var(--fg)]">
            {meta.confirm}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[12px] font-medium text-[var(--fg-secondary)] transition hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            确认执行
          </button>
        </div>
      </div>
    </div>
  )
}
