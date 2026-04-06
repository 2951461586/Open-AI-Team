'use client'

import { Languages } from 'lucide-react'
import { useI18n } from '@/i18n/context'

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div className="inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-0.5" aria-label={t('lang.switch')}>
      <div className="hidden sm:flex items-center px-2 text-[var(--fg-muted)]">
        <Languages size={13} />
      </div>
      {(['zh', 'en'] as const).map((item) => {
        const active = locale === item
        return (
          <button
            key={item}
            type="button"
            onClick={() => setLocale(item)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition ${active ? 'bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-xs)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]'}`}
            aria-pressed={active}
          >
            {item === 'zh' ? t('lang.zh') : t('lang.en')}
          </button>
        )
      })}
    </div>
  )
}
