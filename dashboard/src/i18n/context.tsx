'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import zh from './locales/zh.json'
import en from './locales/en.json'

type Locale = 'zh' | 'en'
type Messages = Record<string, string>

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const STORAGE_KEY = 'dashboard-locale'
const dictionaries: Record<Locale, Messages> = { zh, en }

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children, defaultLocale = 'zh' }: { children: React.ReactNode; defaultLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'zh' || saved === 'en') setLocaleState(saved)
    } catch {}
  }, [])

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = locale
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {}
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
  }, [])

  const t = useCallback((key: string) => {
    return dictionaries[locale][key] ?? dictionaries.zh[key] ?? key
  }, [locale])

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
