'use client'

import { useState, useCallback } from 'react'
import { Settings, Bot, MemoryStick, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/context'
import { PersonalityPanel } from '@/components/panels/PersonalityPanel'
import { MemoryDecayPanel } from '@/components/panels/MemoryDecayPanel'
import { SkillMarketplace } from '@/components/panels/SkillMarketplace'

export type SettingsTab = 'personality' | 'memory' | 'skills'

interface SettingsViewProps {
  defaultTab?: SettingsTab
}

const TABS: { id: SettingsTab; icon: typeof Bot; labelKey: string }[] = [
  { id: 'personality', icon: Bot, labelKey: 'personality.title' },
  { id: 'memory', icon: MemoryStick, labelKey: 'memory.title' },
  { id: 'skills', icon: Palette, labelKey: 'skills.marketplace' },
]

export function SettingsView({ defaultTab = 'personality' }: SettingsViewProps) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab)

  const renderContent = useCallback(() => {
    switch (activeTab) {
      case 'personality':
        return <PersonalityPanel />
      case 'memory':
        return <MemoryDecayPanel />
      case 'skills':
        return <SkillMarketplace />
      default:
        return <PersonalityPanel />
    }
  }, [activeTab])

  return (
    <div className="flex h-full flex-col bg-[var(--surface)]">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-6 py-4">
        <Settings className="h-5 w-5 text-[var(--accent)]" />
        <h1 className="text-base font-semibold text-[var(--fg)]">{t('nav.settings', 'Settings')}</h1>
      </div>

      <div className="flex border-b border-[var(--border)] px-6">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                active
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]'
              )}
            >
              <Icon className="h-4 w-4" />
              {t(tab.labelKey, tab.id)}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-auto panel-scroll">
        {renderContent()}
      </div>
    </div>
  )
}

export default SettingsView
