'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Hash, AtSign, Pin, PanelLeftClose, PanelLeftOpen, GitBranch, ClipboardCheck, PlayCircle, CheckSquare2 } from 'lucide-react'
import { ChatPanel } from '@/components/ChatPanel'
import { ChatSession, ChatTransportStatus } from '@/lib/types'
import { roleLabel } from '@/lib/utils'
import { useChatStore } from '@/lib/store'

interface Props {
  onSendMessage: (text: string) => void
  isLoading?: boolean
  connected?: boolean
  thinking?: boolean
  transportStatus?: ChatTransportStatus
}

function formatSessionTime(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  if (diffMs < 60000) return '刚刚'
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}分钟前`
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}小时前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function ChannelIcon({ session, active }: { session: ChatSession; active: boolean }) {
  const color = active ? 'text-[var(--accent)]' : 'text-[var(--fg-ghost)]'
  if (session.pinned || session.threadType === 'workspace') return <Pin className={`h-3.5 w-3.5 shrink-0 ${color}`} />
  if (session.threadType === 'execution') return <PlayCircle className={`h-3.5 w-3.5 shrink-0 ${color}`} />
  if (session.threadType === 'review' || session.threadType === 'decision') return <ClipboardCheck className={`h-3.5 w-3.5 shrink-0 ${color}`} />
  if (session.threadType === 'task' || session.taskId) return <GitBranch className={`h-3.5 w-3.5 shrink-0 ${color}`} />
  if (session.taskId) return <AtSign className={`h-3.5 w-3.5 shrink-0 ${color}`} />
  return <Hash className={`h-3.5 w-3.5 shrink-0 ${color}`} />
}

function threadTypeLabel(session: ChatSession) {
  const type = session.threadType || (session.taskId ? 'task' : 'workspace')
  if (type === 'workspace') return '主会话'
  if (type === 'execution') return '执行线程'
  if (type === 'review') return '评审线程'
  if (type === 'decision') return '裁决线程'
  return '任务线程'
}

function transportMeta(status: ChatTransportStatus, connected?: boolean) {
  if (connected || status === 'realtime') return { label: '实时连接', dot: 'bg-[var(--success)]', tone: 'text-[var(--success)]' }
  if (status === 'fallback_native') return { label: '自动接管', dot: 'bg-[var(--warning)]', tone: 'text-[var(--warning)]' }
  if (status === 'fallback_template') return { label: '模板响应', dot: 'bg-[var(--danger)]', tone: 'text-[var(--danger)]' }
  if (status === 'fallback') return { label: '备用路径', dot: 'bg-[var(--warning)]', tone: 'text-[var(--warning)]' }
  if (status === 'reconnecting' || status === 'connecting') return { label: '重连中', dot: 'bg-[var(--accent)]', tone: 'text-[var(--accent)]' }
  return { label: '离线', dot: 'bg-[var(--danger)]', tone: 'text-[var(--danger)]' }
}

function sessionGroupKey(session: ChatSession): 'workspace' | 'task' | 'special' {
  if (session.threadType === 'workspace' || session.pinned) return 'workspace'
  if (session.threadType === 'execution' || session.threadType === 'review' || session.threadType === 'decision') return 'special'
  return 'task'
}

const GROUP_META: Record<'workspace' | 'task' | 'special', { label: string; desc: string }> = {
  workspace: { label: '主会话', desc: '全局协调与总入口' },
  task: { label: '任务线程', desc: '围绕任务推进的主协作线程' },
  special: { label: '执行／评审线程', desc: '执行、评审、裁决等派生线程' },
}

export function ChatView({ onSendMessage, isLoading, connected, thinking, transportStatus = connected ? 'realtime' : 'offline' }: Props) {
  const { messages, sessions, activeSessionId, setActiveSession, createSession, deleteSession, clearMessages } = useChatStore()
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem('dashboard:chat:sidebar-visible')
      setSidebarVisible(saved !== '0')
    } catch {}
  }, [])

  const toggleSidebar = () => {
    setSidebarVisible((prev) => {
      const next = !prev
      try { localStorage.setItem('dashboard:chat:sidebar-visible', next ? '1' : '0') } catch {}
      return next
    })
  }

  const transport = transportMeta(transportStatus, connected)

  const sorted = [...sessions].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return b.updatedAt - a.updatedAt
  })

  const activeSession = sorted.find((s) => s.sessionId === activeSessionId) || sorted[0] || null
  const hasUnread = sorted.some((s) => (s.unreadCount || 0) > 0 && s.sessionId !== activeSessionId)
  const selectableSessions = useMemo(() => sorted.filter((session) => session.sessionId !== 'default'), [sorted])
  const selectedCount = selectedSessionIds.length
  const taskThreadCount = useMemo(() => sorted.filter((session) => session.threadType === 'task' || session.taskId).length, [sorted])
  const pendingHumanCount = useMemo(() => sorted.reduce((sum, session) => sum + Number(session.pendingHumanActions || 0), 0), [sorted])
  const groupedSessions = useMemo(() => ({
    workspace: sorted.filter((session) => sessionGroupKey(session) === 'workspace'),
    task: sorted.filter((session) => sessionGroupKey(session) === 'task'),
    special: sorted.filter((session) => sessionGroupKey(session) === 'special'),
  }), [sorted])

  useEffect(() => {
    if (!selectMode) setSelectedSessionIds([])
  }, [selectMode])

  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessionIds((prev) => prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId])
  }

  const selectAll = () => {
    setSelectedSessionIds(selectableSessions.map((session) => session.sessionId))
  }

  const clearSelection = () => {
    setSelectedSessionIds([])
  }

  const bulkDeleteSessions = () => {
    if (selectedSessionIds.length === 0) return
    for (const id of selectedSessionIds) deleteSession(id)
    setSelectedSessionIds([])
    setSelectMode(false)
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl md:p-6">
      <div className="flex h-full min-h-0 w-full overflow-hidden bg-[var(--surface)] md:rounded-2xl md:border md:border-[var(--border)] md:shadow-[0_18px_36px_rgba(15,23,42,0.06)]">
        <aside className={`hidden shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-all duration-200 md:flex ${sidebarVisible ? 'w-60 lg:w-72' : 'w-0 overflow-hidden border-r-0'}`}>
          {sidebarVisible && (
            <>
              <div className="border-b border-[var(--border)] px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--fg)]">线程</span>
                    <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--fg-muted)] shadow-[var(--shadow-xs)]">{sorted.length}</span>
                    {hasUnread && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => createSession()}
                      className="rounded-lg p-1.5 text-[var(--fg-ghost)] transition hover:bg-[var(--surface)] hover:text-[var(--fg-secondary)]"
                      title="新建线程"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setSelectMode((prev) => !prev)}
                      className={`rounded-lg p-1.5 transition ${selectMode ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--fg-ghost)] hover:bg-[var(--surface)] hover:text-[var(--fg-secondary)]'}`}
                      title={selectMode ? '退出批量模式' : '批量管理'}
                    >
                      <CheckSquare2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={toggleSidebar}
                      className="rounded-lg p-1.5 text-[var(--fg-ghost)] transition hover:bg-[var(--surface)] hover:text-[var(--fg-secondary)]"
                      title="隐藏线程栏"
                      aria-label="隐藏线程栏"
                    >
                      <PanelLeftClose className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[var(--fg-muted)]">
                  <div className="truncate">{selectMode ? `已选 ${selectedCount} 个线程` : `当前 ${transport.label}`}</div>
                  <div className="flex items-center gap-1.5">
                    {selectMode ? (
                      <>
                        <button onClick={selectedCount === selectableSessions.length ? clearSelection : selectAll} className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">
                          {selectedCount === selectableSessions.length ? '取消全选' : '全选'}
                        </button>
                        <button onClick={bulkDeleteSessions} disabled={selectedCount === 0} className="soft-label border-[var(--danger)]/20 bg-[var(--danger-soft)] text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50">
                          批量删除
                        </button>
                      </>
                    ) : (
                      <button onClick={clearMessages} className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">
                        清空当前消息
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {(['workspace', 'task', 'special'] as const).map((groupKey) => {
                  const items = groupedSessions[groupKey]
                  if (!items.length) return null
                  const meta = GROUP_META[groupKey]
                  return (
                    <section key={groupKey} className="border-b border-[var(--border-subtle)] last:border-b-0">
                      <div className="sticky top-0 z-10 border-b border-[var(--border-subtle)] bg-[var(--surface)]/92 px-4 py-2 backdrop-blur">
                        <div className="text-[11px] font-semibold text-[var(--fg)]">{meta.label}</div>
                        <div className="mt-0.5 text-[10px] text-[var(--fg-muted)]">{meta.desc}</div>
                      </div>
                      {items.map((session) => {
                        const active = session.sessionId === activeSessionId
                        const unread = (session.unreadCount || 0) > 0 && !active
                        const selected = selectedSessionIds.includes(session.sessionId)
                        const locked = session.sessionId === 'default'
                        return (
                          <button
                            key={session.sessionId}
                            onClick={() => {
                              if (selectMode && !locked) {
                                toggleSessionSelection(session.sessionId)
                                return
                              }
                              setActiveSession(session.sessionId)
                            }}
                            className={`group flex w-full items-start gap-2 border-b border-[var(--border-subtle)] px-4 py-3 text-left transition last:border-b-0 ${active ? 'bg-[var(--accent-soft)]/85 shadow-[inset_3px_0_0_var(--accent)]' : unread ? 'bg-[var(--surface)]' : 'hover:bg-[var(--surface)]'} ${selected ? 'bg-[var(--accent-soft)]/45' : ''}`}
                          >
                            {selectMode && !locked ? (
                              <span className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${selected ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)] bg-[var(--surface)] text-transparent'}`}>
                                ✓
                              </span>
                            ) : (
                              <ChannelIcon session={session} active={active} />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`truncate text-sm font-medium ${active ? 'text-[var(--accent)]' : 'text-[var(--fg)]'}`}>
                                  {session.title}
                                </span>
                                <span className="shrink-0 text-[10px] text-[var(--fg-ghost)]">{formatSessionTime(session.updatedAt)}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--fg-ghost)]">
                                <span className="rounded-full bg-[var(--surface-subtle)] px-1.5 py-0.5">{threadTypeLabel(session)}</span>
                                {session.owner ? <span>负责人：{roleLabel(session.owner)}</span> : null}
                                {session.phase ? <span>阶段：{session.phase}</span> : null}
                                {!!session.blockingIssues ? <span>· 阻塞 {session.blockingIssues}</span> : null}
                                {!!session.pendingHumanActions ? <span>· 待确认 {session.pendingHumanActions}</span> : null}
                              </div>
                              {session.goal && (
                                <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-[var(--fg-secondary)]">{session.goal}</div>
                              )}
                              {session.lastMessage && (
                                <div className="mt-1 truncate text-[11px] text-[var(--fg-muted)]">{session.lastMessage}</div>
                              )}
                            </div>
                            {!selectMode && session.sessionId !== 'default' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteSession(session.sessionId)
                                }}
                                className="hidden rounded p-1 text-[var(--border-strong)] hover:text-[var(--danger)] group-hover:block"
                                title="删除线程"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </button>
                        )
                      })}
                    </section>
                  )
                })}
              </div>

              <div className="border-t border-[var(--border)] px-4 py-2">
                <div className={`flex items-center gap-1.5 text-[10px] ${transport.tone}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${transport.dot}`} />
                  {transport.label}
                </div>
              </div>
            </>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] bg-[var(--surface)] px-3 py-3 md:px-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
                  <span className="text-sm font-semibold text-[var(--fg)]">会话中心</span>
                  <span>·</span>
                  <span>{sorted.length} 条线程</span>
                  {hasUnread && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="soft-label border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent)]">
                    当前：{activeSession?.title || '主会话'}
                  </span>
                  {activeSession ? (
                    <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">
                      {threadTypeLabel(activeSession)}
                    </span>
                  ) : null}
                  {activeSession?.owner ? (
                    <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">
                      负责人：{roleLabel(activeSession.owner)}
                    </span>
                  ) : null}
                  {activeSession?.phase ? (
                    <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">
                      阶段：{activeSession.phase}
                    </span>
                  ) : null}
                  <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">
                    任务线程 {taskThreadCount}
                  </span>
                  {pendingHumanCount > 0 ? (
                    <span className="soft-label border-[var(--warning)]/20 bg-[var(--warning-soft)] text-[var(--warning)]">
                      待人工动作 {pendingHumanCount}
                    </span>
                  ) : null}
                  <span className={`soft-label border-[var(--border)] bg-[var(--surface-subtle)] ${transport.tone}`}>
                    {transport.label}
                  </span>
                </div>
                {activeSession?.goal ? (
                  <div className="mt-2 max-w-3xl text-[12px] leading-5 text-[var(--fg-secondary)]">
                    {activeSession.goal}
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!sidebarVisible && (
                  <button
                    onClick={toggleSidebar}
                    className="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)] shadow-[var(--shadow-xs)] transition hover:bg-[var(--surface-subtle)]"
                    aria-label="显示线程栏"
                    title="显示线程栏"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => createSession()}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)] shadow-[var(--shadow-xs)] transition hover:bg-[var(--surface)]"
                  aria-label="新建线程"
                  title="新建线程"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 flex min-w-0 gap-2 overflow-x-auto pb-1 scrollbar-none md:hidden">
              {sorted.map((session) => {
                const active = session.sessionId === activeSessionId
                return (
                  <button
                    key={session.sessionId}
                    onClick={() => setActiveSession(session.sessionId)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${active ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]'}`}
                  >
                    <ChannelIcon session={session} active={active} />
                    <span className="max-w-[120px] truncate">{session.title}</span>
                    {!!session.unreadCount && !active && (
                      <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold text-white">
                        {session.unreadCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <ChatPanel
              messages={messages}
              onSendMessage={onSendMessage}
              isLoading={isLoading}
              connected={connected}
              thinking={thinking}
              transportStatus={transportStatus}
              showHeader={false}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
