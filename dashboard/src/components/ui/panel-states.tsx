import { AlertTriangle, Loader2, LucideIcon, Inbox } from 'lucide-react'

export function PanelEmptyState({
  icon: Icon = Inbox,
  title,
  body,
}: {
  icon?: LucideIcon
  title: string
  body?: string
}) {
  return (
    <div className="flex h-full items-center justify-center px-4 py-8">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-subtle)] text-[var(--fg-ghost)]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-sm font-medium text-[var(--fg)]">{title}</div>
        {body ? <p className="mt-1 text-[12px] leading-5 text-[var(--fg-muted)]">{body}</p> : null}
      </div>
    </div>
  )
}

export function PanelLoadingState({ text = '正在加载…' }: { text?: string }) {
  return (
    <div className="surface-card flex items-center gap-2 p-4 text-sm text-[var(--fg-muted)]">
      <Loader2 className="h-4 w-4 animate-spin" /> {text}
    </div>
  )
}

export function PanelErrorState({ text }: { text: string }) {
  return (
    <div className="surface-card border-[var(--danger)] bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]">
      {text}
    </div>
  )
}

export function PanelWarningState({
  title,
  items,
}: {
  title: string
  items: string[]
}) {
  if (!items.length) return null
  return (
    <section className="surface-card border-[var(--warning)] bg-[var(--warning-soft)] p-4">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--warning)]">
        <AlertTriangle className="h-4 w-4" />
        {title}
      </div>
      <div className="mt-2 space-y-1 text-[12px] leading-5 text-[var(--fg-secondary)]">
        {items.map((msg) => <div key={msg}>- {msg}</div>)}
      </div>
    </section>
  )
}
