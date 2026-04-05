'use client'

import { LayoutGrid, MessageSquare, Bot, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

export type View = 'kanban' | 'chat' | 'agents'

interface Props {
  currentView: View
  onViewChange: (view: View) => void
  taskCount: number
  collapsed?: boolean
  onToggle?: () => void
}

const navItems = [
  { id: 'kanban' as View, icon: LayoutGrid, label: '任务台' },
  { id: 'chat' as View, icon: MessageSquare, label: '协作' },
  { id: 'agents' as View, icon: Bot, label: 'Agent' },
]

export function Sidebar({ currentView, onViewChange, taskCount, collapsed = false, onToggle }: Props) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-full w-full flex-col border-r border-[var(--border-subtle)] bg-[var(--surface)] transition-all duration-200 shrink-0">
        {/* Logo */}
        <div className="flex h-14 items-center justify-center border-b border-[var(--border-subtle)] bg-[var(--surface-glass)]/80 px-3 backdrop-blur">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[10px] font-bold text-white shadow-sm">
              AT
            </div>
            {!collapsed && (
              <div className="hidden min-w-0 lg:block">
                <div className="truncate text-[11px] font-semibold text-[var(--fg)]">AI Team</div>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col items-center gap-1 px-1.5 py-4">
          {navItems.map((item) => {
            const active = currentView === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  'group relative flex w-full flex-col items-center gap-0.5 rounded-xl px-1.5 py-2.5 text-center transition-all duration-150 press-scale',
                  active
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'text-[var(--fg-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--fg-secondary)]'
                )}
                title={item.label}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-r-full bg-[var(--accent)]" />
                )}
                <Icon className="h-[17px] w-[17px]" />
                {!collapsed && (
                  <span className="hidden lg:inline text-[9px] font-medium leading-none mt-0.5">{item.label}</span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Bottom: collapse toggle */}
        <div className="border-t border-[var(--border-subtle)] p-2">
          {onToggle && (
            <button
              onClick={onToggle}
              className="flex w-full items-center justify-center rounded-lg p-1.5 text-[var(--fg-ghost)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--fg-secondary)]"
              title={collapsed ? '展开边栏' : '收起边栏'}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          )}
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden safe-bottom">
        <div className="mx-2 mb-2 flex items-center justify-around rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface)]/95 px-1.5 py-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-md">
          {navItems.map((item) => {
            const active = currentView === item.id
            const Icon = item.icon
            const badge = item.id === 'kanban' ? taskCount : 0
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  'press-scale relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-2 transition-all',
                  active
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[var(--shadow-xs)]'
                    : 'text-[var(--fg-ghost)] hover:bg-[var(--surface-subtle)]'
                )}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {badge > 0 && item.id === 'kanban' ? (
                    <span className="absolute -right-3 -top-2 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold text-white">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  ) : null}
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
