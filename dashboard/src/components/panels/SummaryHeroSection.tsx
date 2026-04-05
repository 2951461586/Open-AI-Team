import { Sparkles } from 'lucide-react'

export function SummaryHeroSection({
  stateText,
  latestVerdictText,
  latestDecisionText,
  deliverableReady,
  title,
  executiveSummary,
  sceneLeadLabel,
  scenePulse,
  bossPrompt,
  acceptancePulse,
  acceptanceTone,
  coreFacts,
  routeMode,
  sessionModeText,
  sessionPersistent,
  actualNodeLabel,
  sessionHint,
  degradedReasonText,
  manualActionCount,
  busyPeopleCount,
  totalPeopleCount,
  artifactCount,
  evidenceCount,
  issueCount,
}: {
  stateText: string
  latestVerdictText?: string | null
  latestDecisionText?: string | null
  deliverableReady?: boolean
  title?: string
  executiveSummary?: string
  sceneLeadLabel?: string
  scenePulse?: string
  bossPrompt?: string
  acceptancePulse?: string
  acceptanceTone: string
  coreFacts: Array<{ label: string; value: string }>
  routeMode: string
  sessionModeText: string
  sessionPersistent: boolean
  actualNodeLabel?: string
  sessionHint?: string
  degradedReasonText?: string
  manualActionCount: number
  busyPeopleCount: number
  totalPeopleCount: number
  artifactCount: number
  evidenceCount: number
  issueCount: number
}) {
  return (
    <section className="surface-card surface-card-hero p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="soft-label border-[var(--border)] bg-[var(--overlay-light)] text-[var(--fg-secondary)]">{stateText}</span>
        {latestVerdictText ? <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">评审：{latestVerdictText}</span> : null}
        {latestDecisionText ? <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">裁决：{latestDecisionText}</span> : null}
        {deliverableReady ? <span className="soft-label border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]">可交付</span> : null}
      </div>

      <h3 className="mt-2.5 text-[15px] font-semibold leading-snug text-[var(--fg)]">{title || '无标题任务'}</h3>
      <p className="mt-1.5 text-[13px] leading-5 text-[var(--fg-muted)] line-clamp-4">
        {executiveSummary || '—'}
      </p>

      <div className="mt-4 rounded-2xl border border-[var(--accent)]/15 bg-[var(--accent-soft)]/55 p-3.5">
        <div className="text-[10px] font-medium text-[var(--accent)]">现场共识</div>
        <div className="mt-2 text-[14px] font-semibold leading-6 text-[var(--fg)]">{sceneLeadLabel || '团队正在认领这条主线'}</div>
        <div className="mt-1 text-[12px] leading-5 text-[var(--fg-secondary)]">{scenePulse}</div>
      </div>

      <div className="mt-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]/95 p-3.5">
        <div className="text-[10px] font-medium text-[var(--fg-ghost)]">当前建议</div>
        <div className="mt-2 text-[12px] leading-5 text-[var(--fg-secondary)]">{bossPrompt}</div>
      </div>

      <div className={`mt-3 rounded-2xl border p-3.5 ${acceptanceTone}`}>
        <div className="text-[10px] font-medium text-[var(--fg-ghost)]">验收闭环</div>
        <div className="mt-2 text-[12px] leading-5 text-[var(--fg-secondary)]">{acceptancePulse}</div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {coreFacts.slice(0, 3).map((m) => (
          <div key={m.label} className="info-tile bg-[var(--surface-subtle)]">
            <div className="text-[10px] font-medium text-[var(--fg-ghost)]">{m.label}</div>
            <div className="mt-2 text-[13px] leading-5 text-[var(--fg)]">{m.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]/95 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">路由：{routeMode}</span>
          <span className={`soft-label ${sessionPersistent ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]'}`}>会话：{sessionModeText}</span>
          {actualNodeLabel ? <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">执行节点：{actualNodeLabel}</span> : null}
        </div>
        <div className="mt-2 text-[12px] leading-5 text-[var(--fg-secondary)]">{sessionHint}</div>
        {degradedReasonText ? (
          <div className="mt-2 text-[11px] leading-5 text-[var(--fg-muted)]">改道说明：{degradedReasonText}</div>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="info-tile bg-[var(--surface-subtle)]">
          <div className="text-[10px] text-[var(--fg-ghost)]">协作路径</div>
          <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{routeMode}</div>
        </div>
        <div className="info-tile bg-[var(--surface-subtle)]">
          <div className="text-[10px] text-[var(--fg-ghost)]">会话协作</div>
          <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{sessionModeText}</div>
        </div>
        <div className="info-tile bg-[var(--surface-subtle)]">
          <div className="text-[10px] text-[var(--fg-ghost)]">控制动作</div>
          <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{manualActionCount > 0 ? `${manualActionCount} 个可执行动作` : '当前无额外控制动作'}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-[var(--fg-muted)]">
        <span className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">在场角色 {busyPeopleCount}/{totalPeopleCount}</span>
        <span className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">产物 {artifactCount} · 证据 {evidenceCount}</span>
        <span className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">风险 {issueCount > 0 ? issueCount : '无'}</span>
      </div>
    </section>
  )
}
