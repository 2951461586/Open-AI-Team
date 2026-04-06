'use client'

import { formatDateTime } from '@/lib/utils'

export function DeliveryTimeline({ history = [] as any[] }) {
  const rows = history
    .map((item: any) => ({
      version: Number(item?.version || 0),
      status: String(item?.status || 'draft'),
      createdAt: Number(item?.createdAt || 0),
      updatedAt: Number(item?.updatedAt || item?.createdAt || 0),
      artifactCount: Array.isArray(item?.artifacts) ? item.artifacts.length : 0,
      evidenceCount: Array.isArray(item?.evidence) ? item.evidence.length : 0,
    }))
    .sort((a, b) => a.version - b.version)

  return (
    <section className="surface-card p-4 md:p-5">
      <div className="text-[13px] font-semibold text-[var(--fg)]">交付时间线</div>
      <div className="mt-3 space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-5 text-xs text-[var(--fg-muted)]">暂无交付版本</div>
        ) : rows.map((row) => (
          <div key={`${row.version}-${row.updatedAt}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium text-[var(--fg)]">v{row.version} · {row.status}</div>
              <div className="text-xs text-[var(--fg-muted)]">{formatDateTime(row.updatedAt)}</div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--fg-secondary)]">
              <span>产物 {row.artifactCount}</span>
              <span>证据 {row.evidenceCount}</span>
              <span>创建于 {formatDateTime(row.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
