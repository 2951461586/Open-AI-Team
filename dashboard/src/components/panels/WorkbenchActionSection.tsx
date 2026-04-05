import { ArrowRightCircle, Loader2 } from 'lucide-react'
import { TaskCard } from '@/lib/types'
import { nextBestActionLabel, roleLabel } from '@/lib/utils'
import { CONTROL_ACTION_META } from '@/components/panels/workbench-actions'

export function WorkbenchActionSection({
  manualActions,
  actionFeedback,
  actionLoading,
  onPickAction,
  nextBestAction,
  currentMemberKey,
  currentDriver,
  deliverableReady,
  humanInterventionReady,
  sessionModeText,
  sessionPersistent,
}: {
  manualActions: string[]
  actionFeedback: { tone: 'success' | 'error'; text: string } | null
  actionLoading: string | null
  onPickAction: (action: string) => void
  nextBestAction?: string
  currentMemberKey?: string
  currentDriver?: string
  deliverableReady?: boolean
  humanInterventionReady?: boolean
  sessionModeText: string
  sessionPersistent: boolean
}) {
  return (
    <section className="surface-card p-4 md:p-5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--fg)]">
        <ArrowRightCircle className="h-3.5 w-3.5 text-[var(--accent)]" /> 可执行动作
      </div>

      {actionFeedback && (
        <div className={`mt-3 rounded-xl border px-3 py-2 text-[12px] ${actionFeedback.tone === 'success' ? 'border-[var(--success)]/20 bg-[var(--success-soft)] text-[var(--success)]' : 'border-[var(--danger)]/20 bg-[var(--danger-soft)] text-[var(--danger)]'}`}>
          {actionFeedback.text}
        </div>
      )}

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {manualActions.length > 0 ? manualActions.map((action: string) => {
          const meta = CONTROL_ACTION_META[action]
          if (!meta) return null
          const Icon = meta.Icon
          const busy = actionLoading === action
          return (
            <button
              key={action}
              type="button"
              disabled={Boolean(actionLoading)}
              onClick={() => onPickAction(action)}
              className={`surface-card-interactive press-scale rounded-2xl p-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${meta.tone}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[12px] font-semibold">
                    <Icon className="h-4 w-4" /> {meta.label}
                  </div>
                  <div className="mt-1 text-[11px] leading-5 opacity-90">{meta.desc}</div>
                </div>
                {busy ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : null}
              </div>
            </button>
          )
        }) : (
          <span className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-[11px] text-[var(--fg-muted)]">当前没有可执行动作。</span>
        )}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="info-tile bg-[var(--surface-subtle)]">
          <div className="text-[10px] text-[var(--fg-ghost)]">当前推荐动作</div>
          <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{nextBestActionLabel(nextBestAction)}</div>
        </div>
        <div className="info-tile bg-[var(--surface-subtle)]">
          <div className="text-[10px] text-[var(--fg-ghost)]">人工介入</div>
          <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{humanInterventionReady ? '建议现在拍板' : '当前可继续观察'}</div>
        </div>
        <div className="info-tile bg-[var(--surface-subtle)]">
          <div className="text-[10px] text-[var(--fg-ghost)]">交付导流</div>
          <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{deliverableReady ? '切到交付面做最终验收' : '暂不建议切到最终验收'}</div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
        <div className="text-[11px] font-medium text-[var(--fg-ghost)]">推进摘要</div>
        <div className="mt-2 space-y-2 text-[12px] leading-5 text-[var(--fg-secondary)]">
          <div>下一动作：{nextBestActionLabel(nextBestAction)}</div>
          <div>当前角色：{roleLabel(currentMemberKey || currentDriver)}</div>
          <div>交付导流：{deliverableReady ? '已进入验收窗口，请切到交付面确认' : '尚未进入最终验收窗口'}</div>
          <div>人工参与：{humanInterventionReady ? '建议现在介入' : '当前可继续让团队推进'}</div>
          <div>会话能力：{sessionModeText}</div>
          <div>续聊策略：{sessionPersistent ? '成员可直接持续 follow-up' : '成员不可持续时自动回退 TL 接管'}</div>
        </div>
      </div>
    </section>
  )
}
