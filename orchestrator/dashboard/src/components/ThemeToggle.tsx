'use client'

import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'midnight'>('light')

  useEffect(() => {
    const saved = localStorage.getItem('dashboard-theme') || 'light'
    setTheme(saved as 'light' | 'midnight')
    if (saved === 'midnight') {
      document.documentElement.setAttribute('data-theme', 'midnight')
    }
  }, [])

  const toggle = () => {
    const next = theme === 'light' ? 'midnight' : 'light'
    setTheme(next)
    localStorage.setItem('dashboard-theme', next)
    if (next === 'midnight') {
      document.documentElement.setAttribute('data-theme', 'midnight')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  }

  return (
    <button
      onClick={toggle}
      className="btn-ghost rounded-lg p-2"
      title={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
      aria-label={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
    >
      {theme === 'light' ? (
        <Moon className="h-[16px] w-[16px]" />
      ) : (
        <Sun className="h-[16px] w-[16px]" />
      )}
    </button>
  )
}
