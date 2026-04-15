'use client'

import { RefreshCw } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { LanguageSwitcher } from './LanguageSwitcher'
import { TaskState } from '@/lib/types'
import type { View } from './Sidebar'
import { stateLabel, nodeServiceStatusLabel } from '@/lib/utils'
import { useI18n } from '@/i18n/context'
import type { Locale } from '@/i18n/context'

interface Props {
  lastUpdate: number | null
  onRefresh: () => void
  loading: boolean
  currentViewLabel?: string
  currentView?: View
  onSwitchView?: (view: View) => void
  selectedTask?: { taskId?: string; title?: string; state?: TaskState | string; currentDriver?: string | null } | null
  onOpenSelectedTask?: () => void
  tasks?: { state: TaskState }[]
  controlPlaneStatus?: string
}

function formatLastUpdate(lastUpdate: number | null, locale: Locale, unsyncedLabel: string) {
  if (!lastUpdate) return unsyncedLabel
  return new Date(lastUpdate).toLocaleTimeString(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : locale === 'ja' ? 'ja-JP' : locale === 'ko' ? 'ko-KR' : 'zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STAGE_CONFIG: { key: string; labelKey: string; states: TaskState[]; color: string }[] = [
  { key: 'active', labelKey: 'status.inProgress', states: ['planning', 'plan_review', 'approved', 'revision_requested'], color: 'bg-[var(--accent)]' },
  { key: 'pending', labelKey: 'status.pending', states: ['pending'], color: 'bg-[var(--fg-ghost)]' },
  { key: 'done', labelKey: 'status.done', states: ['done'], color: 'bg-[var(--success)]' },
  { key: 'blocked', labelKey: 'status.blocked', states: ['blocked'], color: 'bg-[var(--danger)]' },
]

function StageStrip({ tasks = [] }: { tasks?: { state: TaskState }[] }) {
  const { t } = useI18n()
  if (tasks.length === 0) return null
  const counts = STAGE_CONFIG.map((cfg) => ({
    ...cfg,
    count: tasks.filter((task) => cfg.states.includes(task.state)).length,
  }))

  return (
    <div className="hidden lg:flex items-center gap-3">
      {counts.filter((c) => c.count > 0).map((cfg) => (
        <div key={cfg.key} className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.color}`} />
          <span className="text-[11px] text-[var(--fg-muted)]">
            {t(cfg.labelKey)} <span className="font-semibold text-[var(--fg-secondary)]">{cfg.count}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

export function Header({
  lastUpdate,
  onRefresh,
  loading,
  currentViewLabel = '团队看板',
  currentView = 'kanban',
  onSwitchView,
  selectedTask = null,
  onOpenSelectedTask,
  tasks = [],
  controlPlaneStatus,
}: Props) {
  const { t, locale } = useI18n()
  const viewLabels: Record<View, string> = {
    kanban: t('nav.kanban'),
    chat: t('nav.chat'),
    agents: t('nav.agents'),
    settings: t('nav.settings'),
  }

  const currentTaskPill = selectedTask?.taskId
    ? {
        title: selectedTask.title || selectedTask.taskId || t('task.scene'),
        state: String(selectedTask.state || '').trim(),
        driver: String(selectedTask.currentDriver || '').trim(),
      }
    : null

  return (
    <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
      <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 md:min-h-14 md:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <h1 className="truncate text-[14px] font-semibold text-[var(--fg)] md:text-[15px]">
              {currentViewLabel}
            </h1>
            <span className="inline-flex shrink-0 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--fg-muted)]">
              {formatLastUpdate(lastUpdate, locale, t('header.unsynced'))}
            </span>
            {controlPlaneStatus ? (
              <span className="inline-flex shrink-0 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--fg-muted)]">
                {t('header.controlPlane')}：{nodeServiceStatusLabel({ controlPlaneStatus })}
              </span>
            ) : null}
            <StageStrip tasks={tasks} />
          </div>

          <div className="mt-1.5 flex items-center gap-2 overflow-x-auto scrollbar-none">
            {onSwitchView && (
              <div className="inline-flex shrink-0 items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-0.5">
                {(['kanban', 'chat', 'agents'] as View[]).map((view) => {
                  const active = currentView === view
                  return (
                    <button
                      key={view}
                      type="button"
                      onClick={() => onSwitchView(view)}
                      className={`rounded-full px-3 py-1 text-[10px] font-medium transition ${active ? 'bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-xs)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]'}`}
                    >
                      {viewLabels[view]}
                    </button>
                  )
                })}
              </div>
            )}

            {currentTaskPill && onOpenSelectedTask ? (
              <button
                type="button"
                onClick={onOpenSelectedTask}
                className="inline-flex min-w-0 max-w-[280px] shrink-0 items-center gap-1.5 rounded-full border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-medium text-[var(--accent)] transition hover:opacity-90"
                title={currentTaskPill.title}
              >
                <span className="truncate">{t('header.onSite')}：{currentTaskPill.title}</span>
                {currentTaskPill.state ? <span className="text-[var(--accent)]/70">· {stateLabel(currentTaskPill.state as TaskState)}</span> : null}
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-center">
          <LanguageSwitcher />
          <ThemeToggle />
          <button
            onClick={onRefresh}
            disabled={loading}
            className="btn-ghost gap-1.5"
            aria-label={t('header.refreshData')}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{t('header.refresh')}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
