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

const TABS: { id: SettingsTab; icon: typeof Settings; labelKey: string; gradient: string }[] = [
  { id: 'personality', icon: Bot, labelKey: 'personality.title', gradient: 'from-violet-500 to-purple-600' },
  { id: 'memory', icon: MemoryStick, labelKey: 'memory.title', gradient: 'from-blue-500 to-cyan-600' },
  { id: 'skills', icon: Palette, labelKey: 'skills.marketplace', gradient: 'from-emerald-500 to-teal-600' },
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

  const activeTabData = TABS.find(tab => tab.id === activeTab)

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="shrink-0 p-6 pb-0">
        <div className="flex items-center gap-3 mb-6">
          <div className={cn(
            'p-3 rounded-2xl bg-gradient-to-br shadow-lg',
            activeTabData?.gradient || 'from-gray-500 to-gray-600'
          )}>
            <Settings className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Configure your AI Team experience</p>
          </div>
        </div>

        <div className="flex gap-2 p-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                  active
                    ? 'bg-gradient-to-r shadow-md text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
                style={active ? { backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))` } as React.CSSProperties : undefined}
              >
                {active ? (
                  <div className={cn('p-1.5 rounded-lg bg-white/20')}>
                    <Icon className="h-4 w-4" />
                  </div>
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                <span>{t(tab.labelKey, tab.id)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-6">
        <div className="h-full rounded-2xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 overflow-hidden">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

export default SettingsView
