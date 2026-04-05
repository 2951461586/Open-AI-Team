import { Sparkles } from 'lucide-react'

export function SummaryHeroSection({
  stateText,
  latestVerdictText,
  deliverableReady,
  title,
  executiveSummary,
  sceneLeadLabel,
  bossPrompt,
  coreFacts,
  artifactCount,
  evidenceCount,
  issueCount,
}: {
  stateText: string
  latestVerdictText?: string | null
  deliverableReady?: boolean
  title?: string
  executiveSummary?: string
  sceneLeadLabel?: string
  bossPrompt?: string
  coreFacts: Array<{ label: string; value: string }>
  artifactCount: number
  evidenceCount: number
  issueCount: number
}) {
  return (
    <section className="surface-card surface-card-hero p-4 md:p-5">
      {/* Status row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="soft-label border-[var(--border)] bg-[var(--overlay-light)] text-[var(--fg-secondary)]">{stateText}</span>
        {latestVerdictText ? <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">评审：{latestVerdictText}</span> : null}
        {deliverableReady ? <span className="soft-label border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]">可交付</span> : null}
      </div>

      {/* Title + summary */}
      <h3 className="mt-2.5 text-[15px] font-semibold leading-snug text-[var(--fg)]">{title || '无标题任务'}</h3>
      <p className="mt-1.5 text-[13px] leading-5 text-[var(--fg-muted)] line-clamp-3">
        {executiveSummary || '—'}
      </p>

      {/* Scene lead */}
      {sceneLeadLabel && (
        <div className="mt-3 rounded-2xl border border-[var(--accent)]/15 bg-[var(--accent-soft)]/55 p-3">
          <div className="text-[10px] font-medium text-[var(--accent)]">
            <Sparkles size={12} className="mr-1 inline" />现场共识
          </div>
          <div className="mt-1.5 text-[13px] font-semibold leading-5 text-[var(--fg)]">{sceneLeadLabel}</div>
        </div>
      )}

      {/* Boss prompt */}
      {bossPrompt && (
        <div className="mt-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]/95 p-3">
          <div className="text-[10px] font-medium text-[var(--fg-ghost)]">建议操作</div>
          <div className="mt-1.5 text-[12px] leading-5 text-[var(--fg-secondary)]">{bossPrompt}</div>
        </div>
      )}

      {/* Core facts (max 3) */}
      {coreFacts.length > 0 && (
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {coreFacts.slice(0, 3).map((m) => (
            <div key={m.label} className="info-tile bg-[var(--surface-subtle)]">
              <div className="text-[10px] font-medium text-[var(--fg-ghost)]">{m.label}</div>
              <div className="mt-1 text-[12px] leading-5 text-[var(--fg)]">{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom stats */}
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-[var(--fg-muted)]">
        <span className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">产物 {artifactCount}</span>
        <span className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">证据 {evidenceCount}</span>
        {issueCount > 0 && <span className="soft-label border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]">风险 {issueCount}</span>}
      </div>
    </section>
  )
}
