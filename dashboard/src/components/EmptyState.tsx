'use client'

import type { ReactNode } from 'react'

interface Props {
  icon?: ReactNode
  title: string
  desc?: string
  tone?: 'default' | 'danger' | 'accent'
  compact?: boolean
}

export function EmptyState({ icon, title, desc, tone = 'default', compact }: Props) {
  const toneClass =
    tone === 'danger'
      ? 'border-[var(--danger)]/30 bg-[var(--danger-soft)]'
      : tone === 'accent'
        ? 'border-[var(--accent)]/25 bg-[var(--accent-soft)]'
        : 'border-[var(--border-subtle)] bg-[var(--surface-subtle)]'

  return (
    <div className={`surface-card flex h-full items-center justify-center p-6 ${toneClass} ${compact ? 'p-5' : ''}`}>
      <div className="max-w-[320px] text-center">
        {icon ? (
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--fg-ghost)]">
            {icon}
          </div>
        ) : null}
        <div className="text-sm font-semibold text-[var(--fg)]">{title}</div>
        {desc ? (
          <div className="mt-1.5 text-[12px] leading-5 text-[var(--fg-muted)]">{desc}</div>
        ) : null}
      </div>
    </div>
  )
}
