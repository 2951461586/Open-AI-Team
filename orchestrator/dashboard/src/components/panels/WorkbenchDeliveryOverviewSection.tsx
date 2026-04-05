import { PackageOpen } from 'lucide-react'
import { deliveryStatusLabel, interventionStatusLabel, nextBestActionLabel, roleLabel } from '@/lib/utils'

export function WorkbenchDeliveryOverviewSection({
  deliverableReady,
  humanInterventionReady,
  deliveryStatus,
  interventionStatus,
  executiveSummary,
  resultCounters,
  nextBestAction,
  currentMemberKey,
  currentDriver,
  sessionModeText,
  sessionPersistent,
}: {
  deliverableReady?: boolean
  humanInterventionReady?: boolean
  deliveryStatus?: string
  interventionStatus?: string
  executiveSummary?: string
  resultCounters?: {
    artifactCount?: number
    evidenceCount?: number
    issueCount?: number
    revisionCount?: number
  } | null
  nextBestAction?: string
  currentMemberKey?: string
  currentDriver?: string
  sessionModeText: string
  sessionPersistent: boolean
}) {
  return (
    <section className="surface-card p-4 md:p-5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--fg)]">
        <PackageOpen className="h-3.5 w-3.5 text-[var(--accent)]" /> 交付概览
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`soft-label ${deliverableReady ? 'border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]'}`}>
              {deliverableReady ? '可直接交付' : deliveryStatusLabel(deliveryStatus)}
            </span>
            <span className={`soft-label ${humanInterventionReady ? 'border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]'}`}>
              {humanInterventionReady ? '待人工决策' : interventionStatusLabel(interventionStatus)}
            </span>
          </div>
          <div className="mt-3 text-[14px] font-semibold leading-6 text-[var(--fg)]">
            {executiveSummary || '—'}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5">
              <div className="text-[10px] text-[var(--fg-ghost)]">产物</div>
              <div className="mt-1 text-[13px] font-semibold text-[var(--fg)]">{Number(resultCounters?.artifactCount || 0)}</div>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5">
              <div className="text-[10px] text-[var(--fg-ghost)]">证据</div>
              <div className="mt-1 text-[13px] font-semibold text-[var(--fg)]">{Number(resultCounters?.evidenceCount || 0)}</div>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5">
              <div className="text-[10px] text-[var(--fg-ghost)]">问题</div>
              <div className="mt-1 text-[13px] font-semibold text-[var(--fg)]">{Number(resultCounters?.issueCount || 0)}</div>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5">
              <div className="text-[10px] text-[var(--fg-ghost)]">变更</div>
              <div className="mt-1 text-[13px] font-semibold text-[var(--fg)]">{Number(resultCounters?.revisionCount || 0)}</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
          <div className="text-[11px] font-medium text-[var(--fg-ghost)]">结果摘要</div>
          <div className="mt-2 space-y-2 text-[12px] leading-5 text-[var(--fg-secondary)]">
            <div>下一动作：{nextBestActionLabel(nextBestAction)}</div>
            <div>当前角色：{roleLabel(currentMemberKey || currentDriver)}</div>
            <div>交付判断：{deliverableReady ? '已可验收' : '尚未可直接收口'}</div>
            <div>人工参与：{humanInterventionReady ? '建议现在介入' : '当前可继续让团队推进'}</div>
            <div>会话能力：{sessionModeText}</div>
            <div>续聊策略：{sessionPersistent ? '成员可直接持续 follow-up' : '成员不可持续时自动回退 TL 接管'}</div>
          </div>
        </div>
      </div>
    </section>
  )
}
