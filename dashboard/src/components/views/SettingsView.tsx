'use client'

import { useState, useCallback } from 'react'
import { Settings, Bot, Globe, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/context'
import { PersonalityPanel } from '@/components/panels/PersonalityPanel'
import { ApiConfigPanel } from '@/components/panels/ApiConfigPanel'

export type SettingsTab = 'api' | 'personality'

interface SettingsViewProps {
  defaultTab?: SettingsTab
}

const TABS: { id: SettingsTab; icon: typeof Bot; labelKey: string }[] = [
  { id: 'api', icon: Globe, labelKey: 'api.config' },
  { id: 'personality', icon: Bot, labelKey: 'personality.title' },
]

export function SettingsView({ defaultTab = 'api' }: SettingsViewProps) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab)
  const [sidebarVisible, setSidebarVisible] = useState(true)

  const toggleSidebar = () => setSidebarVisible((prev) => !prev)

  const renderContent = useCallback(() => {
    switch (activeTab) {
      case 'api':
        return <ApiConfigPanel />
      case 'personality':
        return <PersonalityPanel />
      default:
        return <ApiConfigPanel />
    }
  }, [activeTab])

  const activeTabMeta = TABS.find((tab) => tab.id === activeTab)

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl md:p-6">
      <div className="flex h-full min-h-0 w-full overflow-hidden bg-[var(--surface)] md:rounded-2xl md:border md:border-[var(--border)] md:shadow-[0_18px_36px_rgba(15,23,42,0.06)]">
        <aside className={`hidden shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-all duration-200 md:flex ${sidebarVisible ? 'w-52' : 'w-0 overflow-hidden border-r-0'}`}>
          {sidebarVisible && (
            <>
              <div className="border-b border-[var(--border)] px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-[var(--accent)]" />
                    <span className="text-sm font-semibold text-[var(--fg)]">{t('nav.settings', '设置')}</span>
                  </div>
                  <button
                    onClick={toggleSidebar}
                    className="rounded-lg p-1.5 text-[var(--fg-ghost)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--fg-secondary)]"
                    title="隐藏侧边栏"
                  >
                    <PanelLeftClose className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-1.5 text-[11px] text-[var(--fg-muted)]">配置和个性化选项</div>
              </div>

              <div className="flex-1 overflow-y-auto py-2">
                <div className="px-3 py-1.5">
                  <div className="text-[10px] font-semibold text-[var(--fg-muted)] mb-1.5 uppercase tracking-wider">设置分类</div>
                  <nav className="space-y-0.5">
                    {TABS.map((tab) => {
                      const Icon = tab.icon
                      const active = activeTab === tab.id
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition',
                            active
                              ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_3px_0_0_var(--accent)]'
                              : 'text-[var(--fg-secondary)] hover:bg-[var(--surface-subtle)]'
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="text-xs font-medium">{t(tab.labelKey, tab.labelKey)}</span>
                        </button>
                      )
                    })}
                  </nav>
                </div>
              </div>
            </>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 md:px-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
                  <Settings className="h-4 w-4 text-[var(--accent)]" />
                  <span className="text-sm font-semibold text-[var(--fg)]">{t('nav.settings', '设置')}</span>
                  <span>·</span>
                  <span>{activeTabMeta ? t(activeTabMeta.labelKey, activeTabMeta.labelKey) : ''}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!sidebarVisible && (
                  <button
                    onClick={toggleSidebar}
                    className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)] shadow-[var(--shadow-xs)] transition hover:bg-[var(--surface-subtle)]"
                    aria-label="显示侧边栏"
                    title="显示侧边栏"
                  >
                    <PanelLeftOpen className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-2.5 flex min-w-0 gap-1.5 overflow-x-auto pb-1 scrollbar-none md:hidden">
              {TABS.map((tab) => {
                const Icon = tab.icon
                const active = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{t(tab.labelKey, tab.labelKey)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto panel-scroll">
            <div className="p-3 md:p-4">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsView
