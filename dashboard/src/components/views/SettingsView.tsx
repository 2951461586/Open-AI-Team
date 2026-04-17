'use client'

import { useState, useCallback } from 'react'
import { Settings, Bot, MemoryStick, Palette, LayoutDashboard, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/context'
import { PersonalityPanel } from '@/components/panels/PersonalityPanel'
import { MemoryDecayPanel } from '@/components/panels/MemoryDecayPanel'
import { SkillMarketplace } from '@/components/panels/SkillMarketplace'
import { DeskPanel } from '@/components/panels/DeskPanel'
import { ApiConfigPanel } from '@/components/panels/ApiConfigPanel'

export type SettingsTab = 'api' | 'personality' | 'memory' | 'skills' | 'desk'

interface SettingsViewProps {
  defaultTab?: SettingsTab
}

const TABS: { id: SettingsTab; icon: typeof Bot; labelKey: string }[] = [
  { id: 'api', icon: Globe, labelKey: 'api.config' },
  { id: 'personality', icon: Bot, labelKey: 'personality.title' },
  { id: 'memory', icon: MemoryStick, labelKey: 'memory.title' },
  { id: 'skills', icon: Palette, labelKey: 'skills.marketplace' },
  { id: 'desk', icon: LayoutDashboard, labelKey: 'desk.title' },
]

export function SettingsView({ defaultTab = 'api' }: SettingsViewProps) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab)

  const renderContent = useCallback(() => {
    switch (activeTab) {
      case 'api':
        return <ApiConfigPanel />
      case 'personality':
        return <PersonalityPanel />
      case 'memory':
        return <MemoryDecayPanel />
      case 'skills':
        return <SkillMarketplace />
      case 'desk':
        return <DeskPanel />
      default:
        return <ApiConfigPanel />
    }
  }, [activeTab])

  return (
    <div className="flex h-full flex-col bg-[var(--bg)]">
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Settings className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[var(--fg)]">{t('nav.settings', '设置')}</h1>
            <p className="text-[11px] text-[var(--fg-muted)]">配置和个性化选项</p>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4">
        <div className="flex gap-1 p-1 bg-[var(--surface-subtle)] rounded-xl w-fit mt-2">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all',
                  active
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'text-[var(--fg-secondary)] hover:bg-[var(--surface-muted)]'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t(tab.labelKey, tab.id)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto panel-scroll">
        <div className="p-4 md:p-5">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

export default SettingsView
