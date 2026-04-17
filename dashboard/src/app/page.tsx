'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import type { View } from '@/components/Sidebar'
import { RightPanel, isDetailTab, type DetailTab } from '@/components/RightPanel'
import { AgentsView } from '@/components/views/AgentsView'
import { SettingsView } from '@/components/views/SettingsView'
import { WelcomeScreen } from '@/components/views/WelcomeScreen'
import { useI18n } from '@/i18n/context'
import { KanbanView } from '@/components/views/KanbanView'
import { ChatView } from '@/components/views/ChatView'
import { useTaskStore, useChatStore, useLiveStore } from '@/lib/store'
import { useWebSocket } from '@/hooks/useWebSocket'
import { fetchDashboard, fetchNodes, fetchThreads, getWsUrl, API_BASE } from '@/lib/api'
import { TaskState, LiveFlowEvent, ChatTransportStatus } from '@/lib/types'
import { focusAssignmentId, focusChildTaskId } from '@/lib/task-focus'
import { resolveHeaderLastUpdate } from '@/lib/utils'

const WS_URL = getWsUrl()
const WS_ENABLED = !!WS_URL
const WORKSPACE = process.env.NEXT_PUBLIC_WORKSPACE || 'main'
const DEFAULT_SCOPE_KEY = `dashboard:${WORKSPACE}:chat:default`
const SIDEBAR_WIDTH_KEY = 'dashboard:layout:sidebar-width'
const RIGHT_PANEL_WIDTH_KEY = 'dashboard:layout:right-panel-width'
const SIDEBAR_COLLAPSED_KEY = 'dashboard:layout:sidebar-collapsed'
const RIGHT_PANEL_COLLAPSED_KEY = 'dashboard:layout:right-panel-collapsed'

function buildChatScopeKey(opts: { sessionId?: string; taskId?: string; explicit?: boolean }) {
  const taskId = String(opts?.taskId || '').trim()
  if (taskId) return `dashboard:${WORKSPACE}:task:${encodeURIComponent(taskId)}`
  const sessionId = String(opts?.sessionId || '').trim()
  if (sessionId && sessionId !== 'default') return `dashboard:${WORKSPACE}:chat:${encodeURIComponent(sessionId)}`
  return DEFAULT_SCOPE_KEY
}

function resolveChatScopeKey(session: { sessionId?: string; taskId?: string; explicit?: boolean; scopeKey?: string } | null | undefined) {
  if (session?.scopeKey) return String(session.scopeKey)
  return buildChatScopeKey({ sessionId: session?.sessionId, taskId: session?.taskId, explicit: session?.explicit })
}

const INTERNAL_SIGNAL_PATTERNS = [
  /(^|\s)via=dashboard_ws/i,
  /(^|\s)command=team-output:/i,
  /(^|\s)dashboard_ws\b/i,
  /(^|\s)artifactCount=\d+/i,
  /(^|\s)review verdict=/i,
  /(^|\s)auto_judge_from_review:/i,
  /team-output:/i,
  /chain verification completed/i,
]

function sanitizeUserFacingText(raw: string): string {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => !INTERNAL_SIGNAL_PATTERNS.some((pattern) => pattern.test(line.trim())))

  const compacted: string[] = []
  for (const line of lines) {
    if (!line.trim()) {
      if (compacted[compacted.length - 1] !== '') compacted.push('')
      continue
    }
    compacted.push(line)
  }
  return compacted.join('\n').trim()
}

function normalizeLiveFlowEvent(data: any): LiveFlowEvent | null {
  if (!data || typeof data !== 'object') return null
  const type = String(data.type || '')
  const taskId = String(data.taskId || '')
  if (!type || !taskId) return null
  if (!['task_update', 'visible_output', 'agent_reply', 'task_created', 'stream_start', 'stream_end', 'orchestration_event'].includes(type)) return null

  const timestamp = Number(data.timestamp || Date.now())
  const title = String(data.title || data.taskTitle || '')
  let content = ''
  if (type === 'task_update') content = String(data.message || data.executiveSummary || data.nextBestAction || '')
  else if (type === 'visible_output') content = [String(data.title || ''), String(data.text || '')].filter(Boolean).join(': ')
  else if (type === 'agent_reply') content = String(data.content || '')
  else if (type === 'task_created') content = String(data.summary || '')
  else if (type === 'stream_start') content = String(data.content || '处理中…')
  else if (type === 'stream_end') content = String(data.content || '')
  else if (type === 'orchestration_event') content = [String(data.title || ''), String(data.content || '')].filter(Boolean).join(': ')

  const eventKind = type === 'task_created'
    ? 'task.created'
    : type === 'task_update'
      ? 'task.state'
      : type === 'visible_output'
        ? 'output.visible'
        : type === 'agent_reply'
          ? 'agent.reply'
          : type === 'stream_start'
            ? 'stream.start'
            : type === 'stream_end'
              ? 'stream.end'
              : type === 'orchestration_event'
                ? String(data.eventKind || 'orchestration.event')
                : undefined

  const rawChildTaskId = focusChildTaskId(data as Record<string, any>) || String(data.subtaskId || '').trim()
  const rawAssignmentId = focusAssignmentId(data as Record<string, any>)
  const contentWithChild = [content, rawChildTaskId ? `child=${rawChildTaskId}` : '']
    .filter(Boolean)
    .join(' · ')

  return {
    id: String(data.messageId || data.streamId || `${type}:${taskId}:${timestamp}:${String(data.role || '')}`),
    taskId, type,
    role: String(data.role || data.currentDriver || ''),
    node: String(data.node || ''),
    title,
    content: contentWithChild,
    state: String(data.state || ''),
    timestamp,
    eventKind,
    lane: String(data.lane || ''),
    sourceKind: String(data.sourceKind || ''),
    confidence: data.confidence,
    artifactType: String(data.artifactType || ''),
    status: String(data.status || ''),
    actorLabel: String(data.actorLabel || ''),
    elapsedMs: typeof data.elapsedMs === 'number' ? data.elapsedMs : undefined,
    sessionKey: typeof data.sessionKey === 'string' ? data.sessionKey : undefined,
    childTaskId: rawChildTaskId || undefined,
    assignmentId: rawAssignmentId || undefined,
    intent: typeof data.intent === 'string' ? data.intent as any : undefined,
    layerIndex: typeof data.layerIndex === 'number' ? data.layerIndex : undefined,
    layerLabel: typeof data.layerLabel === 'string' ? data.layerLabel : undefined,
  }
}

function MobileDrawer({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const currentXRef = useRef(0)
  const isDragging = useRef(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX
    currentXRef.current = 0
    isDragging.current = false
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startXRef.current
    if (dx > 10) isDragging.current = true
    if (!isDragging.current) return
    currentXRef.current = Math.max(0, dx)
    if (drawerRef.current) {
      drawerRef.current.style.transform = `translateX(${currentXRef.current}px)`
      drawerRef.current.style.transition = 'none'
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    const threshold = window.innerWidth * 0.3
    if (currentXRef.current > threshold) {
      if (drawerRef.current) {
        drawerRef.current.style.transition = 'transform 0.2s ease'
        drawerRef.current.style.transform = 'translateX(100%)'
      }
      setTimeout(onClose, 200)
    } else {
      if (drawerRef.current) {
        drawerRef.current.style.transition = 'transform 0.2s ease'
        drawerRef.current.style.transform = 'translateX(0)'
      }
    }
    currentXRef.current = 0
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[70] xl:hidden">
      <button type="button" aria-label="关闭任务详情" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={drawerRef}
        className="absolute right-0 top-0 bottom-0 flex h-full w-full max-w-full flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl animate-slide-in-right md:max-w-[560px]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center justify-center border-b border-[var(--border)] px-4 py-2.5">
          <span className="h-1.5 w-12 rounded-full bg-[var(--border-strong)]/30" />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden pb-[calc(env(safe-area-inset-bottom,0px)+72px)] md:pb-0">{children}</div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { t } = useI18n()
  const { tasks, nodes, loading, error, lastUpdate, nodesLastUpdate, selectedTaskId, setTasks, setNodes, upsertTask, setLoading, setError, setSelectedTaskId } = useTaskStore()
  const {
    messages,
    sessions,
    activeSessionId,
    addMessage,
    updateMessage,
    appendStreamChunk,
    finalizeStreamMessage,
    clearThinkingMessagesByTask,
    getOrCreateTaskChannel,
    applyThreadSummaries,
  } = useChatStore()
  const { addEvent } = useLiveStore()
  const [view, setView] = useState<View>('kanban')
  const [showWelcome, setShowWelcome] = useState(false)
  const [deliverablesRefreshKey, setDeliverablesRefreshKey] = useState(0)
  const [chatTransport, setChatTransport] = useState<ChatTransportStatus>(WS_ENABLED ? 'connecting' : 'fallback')
  const hasWsEverOpenedRef = useRef(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(72)
  const [rightPanelWidth, setRightPanelWidth] = useState(440)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [rightPanelDefaultTab, setRightPanelDefaultTab] = useState<DetailTab>('mission')

  const artifactsRefreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [artifactRefreshAt, setArtifactRefreshAt] = useState(0)
  const resizeRef = useRef<{ target: 'sidebar' | 'right' | null; startX: number; startWidth: number }>({ target: null, startX: 0, startWidth: 0 })
  const activeChatSession = sessions.find((s) => s.sessionId === activeSessionId) || null
  const activeChatScopeKey = resolveChatScopeKey(activeChatSession)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const params = new URLSearchParams(window.location.search)
      const taskId = String(params.get('taskId') || '').trim()
      const detailTabParam = String(params.get('detailTab') || '').trim()
      const viewParam = String(params.get('view') || '').trim()
      if (viewParam === 'kanban' || viewParam === 'chat' || viewParam === 'agents' || viewParam === 'settings') setView(viewParam as View)
      if (isDetailTab(detailTabParam)) setRightPanelDefaultTab(detailTabParam)
      if (taskId) {
        setSelectedTaskId(taskId)
        setView('kanban')
        setRightPanelCollapsed(false)
        try { localStorage.setItem(RIGHT_PANEL_COLLAPSED_KEY, '0') } catch {}
      }
    } catch {}
  }, [setSelectedTaskId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const savedSidebarCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
      const savedSidebarWidth = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY) || 72)
      const savedRightWidth = Number(localStorage.getItem(RIGHT_PANEL_WIDTH_KEY) || 440)
      const savedRightCollapsed = localStorage.getItem(RIGHT_PANEL_COLLAPSED_KEY)
      const params = new URLSearchParams(window.location.search)
      const forcedTaskId = String(params.get('taskId') || '').trim()
      setSidebarCollapsed(savedSidebarCollapsed === '1')
      setSidebarWidth(Math.min(240, Math.max(56, savedSidebarWidth || 72)))
      setRightPanelWidth(Math.min(860, Math.max(320, savedRightWidth || 440)))
      setRightPanelCollapsed(forcedTaskId ? false : savedRightCollapsed === '1')
      const hasSeenWelcome = localStorage.getItem('dashboard:welcomed')
      if (!hasSeenWelcome) setShowWelcome(true)
    } catch {}
  }, [])

  const handleWelcomeComplete = useCallback(() => {
    try { localStorage.setItem('dashboard:welcomed', '1') } catch {}
    setShowWelcome(false)
  }, [])

  const handleStartChat = useCallback(() => {
    handleWelcomeComplete()
    setView('chat')
  }, [handleWelcomeComplete])

  const handleOpenSettings = useCallback(() => {
    handleWelcomeComplete()
    setView('settings')
  }, [handleWelcomeComplete])

  const handleQuickStart = useCallback(() => {
    handleWelcomeComplete()
    setView('chat')
  }, [handleWelcomeComplete])

  const handleViewDocs = useCallback(() => {
    window.open('/docs', '_blank')
  }, [])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const state = resizeRef.current
      if (!state.target) return
      if (state.target === 'right') {
        const next = Math.min(860, Math.max(320, state.startWidth - (event.clientX - state.startX)))
        setRightPanelWidth(next)
      } else if (state.target === 'sidebar') {
        const next = Math.min(240, Math.max(56, state.startWidth + (event.clientX - state.startX)))
        setSidebarWidth(next)
      }
    }

    const onUp = () => {
      const state = resizeRef.current
      if (!state.target) return
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0')
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth))
        localStorage.setItem(RIGHT_PANEL_WIDTH_KEY, String(rightPanelWidth))
      } catch {}
      resizeRef.current = { target: null, startX: 0, startWidth: 0 }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [rightPanelWidth, sidebarCollapsed, sidebarWidth])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchDashboard(200)
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const json = await res.json()
      const dashboard = json?.dashboard || json?.payload?.dashboard
      if (!dashboard || typeof dashboard !== 'object') throw new Error('Invalid dashboard payload')
      const cards = Array.isArray(dashboard.cards) ? dashboard.cards : []
      setTasks(cards, {
        cursor: Number(dashboard.cursor || 0),
        hasMore: Boolean(dashboard.hasMore),
        totalCount: Number(dashboard.totalCount || cards.length),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
      useTaskStore.getState().touchLastUpdate()
    } finally {
      setLoading(false)
    }
  }, [setTasks, setLoading, setError])

  const loadNodes = useCallback(async () => {
    try {
      const res = await fetchNodes()
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const json = await res.json()
      const rawNodes = json?.nodes || json?.payload?.nodes || {}
      const deployment = json?.deployment || json?.payload?.deployment || {}
      const canonicalLabels: Record<string, string> = { 'node-a': 'Local', 'node-b': 'Observer', 'node-c': 'Review' }
      const legacyAliases = ['laoda', 'authority', 'violet', 'observer', 'lebang', 'reviewer']
      const list = Object.entries(rawNodes)
        .filter(([key, value]) => key !== 'ts' && !legacyAliases.includes(key) && value && typeof value === 'object')
        .map(([key, value]: [string, any]) => ({
          key,
          label: canonicalLabels[key] || value?.label || key,
          reachable: !!value?.reachable,
          latencyMs: value?.latencyMs,
          fallbackReady: !!value?.fallbackReady,
          probe: value?.probe,
          stats: value?.stats,
          activeResidentCount: value?.activeResidentCount,
          activeResidentRoles: value?.activeResidentRoles,
          connectivity: value?.connectivity,
          weight: typeof value?.weight === 'number' ? value.weight : undefined,
          pressureReason: String(value?.pressureReason || ''),
          recommended: !!value?.recommended,
          preferredRoles: Object.entries(deployment).filter(([, cfg]: [string, any]) => String(cfg?.preferredNode || '') === key).map(([role]) => role),
          fallbackRoles: Object.entries(deployment).filter(([, cfg]: [string, any]) => String(cfg?.fallbackNode || '') === key && String(cfg?.preferredNode || '') !== key).map(([role]) => role),
        }))
      setNodes(list)
    } catch (err) {
      console.error('Nodes load failed:', err)
      useTaskStore.getState().touchLastUpdate()
    }
  }, [setNodes])

  const loadThreads = useCallback(async (taskId?: string | null) => {
    try {
      const res = await fetchThreads(taskId || undefined)
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const json = await res.json().catch(() => ({}))
      const items = json?.payload?.items || json?.items || []
      applyThreadSummaries(Array.isArray(items) ? items : [])
    } catch (err) {
      console.error('Threads load failed:', err)
    }
  }, [applyThreadSummaries])

  useEffect(() => {
    if (!WS_ENABLED) setChatTransport('fallback')
  }, [])

  const { connected, send } = useWebSocket({
    url: WS_URL,
    onOpen: () => {
      hasWsEverOpenedRef.current = true
      setChatTransport('realtime')
      send({ type: 'subscribe', scopeKey: activeChatScopeKey })
    },
    onClose: () => {
      if (!WS_ENABLED) return
      if (!hasWsEverOpenedRef.current) {
        setChatTransport('fallback')
        return
      }
      setChatTransport((prev) => (prev === 'offline' ? prev : 'reconnecting'))
    },
    onError: () => {
      if (!WS_ENABLED) return
      setChatTransport('fallback')
    },
    onMessage: (data) => {
      if (!data || typeof data !== 'object') return

      const liveEvent = normalizeLiveFlowEvent(data)
      if (liveEvent) addEvent(liveEvent)

      const msgType = String(data.type || '')
      const msgTaskId = String(data.taskId || '')
      const msgRole = String(data.role || data.currentDriver || 'assistant')
      const msgNode = String(data.node || '')
      const msgTimestamp = Number(data.timestamp || Date.now())
      const msgScopeKey = String(data.scopeKey || data.scope_key || '')
      const taskTitle = String(data.title || data.taskTitle || msgTaskId || '未命名任务')
      const matchedChatSession = msgTaskId
        ? (sessions.find((session) => resolveChatScopeKey(session) === (msgScopeKey || DEFAULT_SCOPE_KEY)) || null)
        : (sessions.find((session) => resolveChatScopeKey(session) === msgScopeKey) || null)
      const matchedChatSessionId = matchedChatSession?.sessionId || activeSessionId
      const taskChannelId = msgTaskId
        ? getOrCreateTaskChannel(msgTaskId, taskTitle, {
            activate: false,
            create: false,
            scopeKey: msgScopeKey || undefined,
          })
        : null
      const primarySessionId = matchedChatSessionId

      if (selectedTaskId && msgTaskId === selectedTaskId && (msgType === 'visible_output' || msgType === 'task_update' || msgType === 'stream_end')) {
        const now = Date.now()
        if (now - artifactRefreshAt > 1200) {
          setArtifactRefreshAt(now)
          if (artifactsRefreshTimerRef.current) clearTimeout(artifactsRefreshTimerRef.current)
          artifactsRefreshTimerRef.current = setTimeout(() => setDeliverablesRefreshKey((k) => k + 1), 250)
        }
      }

      if (msgType === 'stream_start') {
        const streamId = String(data.streamId || (msgTaskId ? `stream-${msgTaskId}-${msgRole}` : `stream-chat-${msgScopeKey || 'default'}-${msgRole}`))
        const content = String(data.content || '处理中…')
        const patch = {
          role: msgRole as any,
          node: msgNode,
          taskId: msgTaskId || undefined,
          timestamp: msgTimestamp,
          scopeKey: msgScopeKey || undefined,
        }

        appendStreamChunk(streamId, content, patch, primarySessionId)
        if (msgTaskId && taskChannelId) appendStreamChunk(streamId, content, patch, taskChannelId)
        return
      }

      if (msgType === 'stream_chunk') {
        const streamId = String(data.streamId || (msgTaskId ? `stream-${msgTaskId}-${msgRole}` : `stream-chat-${msgScopeKey || 'default'}-${msgRole}`))
        const content = String(data.content || '处理中…')
        const patch = {
          role: msgRole as any,
          node: msgNode,
          taskId: msgTaskId || undefined,
          timestamp: msgTimestamp,
          scopeKey: msgScopeKey || undefined,
        }

        appendStreamChunk(streamId, content, patch, primarySessionId)
        if (msgTaskId && taskChannelId) appendStreamChunk(streamId, content, patch, taskChannelId)
        return
      }

      if (msgType === 'stream_end') {
        const pendingId = String(data?.messageId || '')
        if (pendingId) {
          updateMessage(pendingId, { status: 'done' }, primarySessionId)
          if (msgTaskId && taskChannelId) updateMessage(pendingId, { status: 'done' }, taskChannelId)
        }

        if (msgTaskId) clearThinkingMessagesByTask(msgTaskId)
        const streamId = String(data.streamId || (msgTaskId ? `stream-${msgTaskId}-${msgRole}` : `stream-chat-${msgScopeKey || 'default'}-${msgRole}`))
        const content = String(data.content || data.summary || '')
        const patch = {
          role: msgRole as any,
          node: msgNode,
          taskId: msgTaskId || undefined,
          timestamp: msgTimestamp,
          scopeKey: msgScopeKey || undefined,
        }

        finalizeStreamMessage(streamId, content, patch, primarySessionId)
        if (msgTaskId && taskChannelId) finalizeStreamMessage(streamId, content, patch, taskChannelId)
        return
      }

      if (msgType === 'agent_reply') {
        const pendingId = String(data?.messageId || '')
        if (pendingId) {
          updateMessage(pendingId, { status: 'done' }, primarySessionId)
          if (msgTaskId && taskChannelId) updateMessage(pendingId, { status: 'done' }, taskChannelId)
        }
        const cleanContent = sanitizeUserFacingText(String(data.content || data.summary || ''))
        if (!cleanContent) return
        const message = {
          id: `agent-${msgTaskId || 'chat'}-${msgRole}-${msgTimestamp}`,
          role: msgRole as any,
          content: cleanContent,
          timestamp: msgTimestamp,
          status: 'done' as const,
          node: msgNode,
          taskId: msgTaskId || undefined,
          scopeKey: msgScopeKey,
          noCollapse: msgRole !== 'system',
        }
        addMessage(message, primarySessionId)
        if (msgTaskId && taskChannelId) addMessage(message, taskChannelId)
        return
      }

      if (msgType === 'visible_output') {
        const readableOutput = sanitizeUserFacingText(String(data.markdown || [String(data.title || ''), String(data.text || '')].filter(Boolean).join('\n\n')))
        if (!readableOutput) return
        const artifactMessage = {
          id: `artifact-${msgTaskId || 'chat'}-${msgTimestamp}`,
          role: msgRole as any,
          content: readableOutput,
          timestamp: msgTimestamp,
          status: 'done' as const,
          node: msgNode,
          taskId: msgTaskId || undefined,
          scopeKey: msgScopeKey,
          artifactId: `visible-output-${msgTaskId || 'chat'}-${msgTimestamp}`,
          artifactType: 'deliverable',
          artifactTitle: String(data.title || '可见交付'),
          artifactFilePath: String(data.filePath || data.path || ''),
          artifactDownloadText: readableOutput,
          artifactDownloadName: String(data.fileName || data.filename || `${msgTaskId || 'deliverable'}.md`),
          noCollapse: true,
        }
        addMessage(artifactMessage, primarySessionId)
        if (msgTaskId && taskChannelId) addMessage(artifactMessage, taskChannelId)
        return
      }

      if (msgType === 'orchestration_event') {
        const eventKind = String(data.eventKind || '')
        if (eventKind === 'task.created') {
          return
        }

        // execution.progress events: update in-place instead of appending many messages
        if (eventKind === 'execution.progress') {
          const progressId = `exec-progress-${msgTaskId || 'chat'}-${msgRole}`
          const roleForEvent = ((['planner', 'critic', 'judge', 'executor', 'output', 'tl'].includes(msgRole) ? msgRole : 'system')) as any
          const title = String(data.title || '').trim()
          const body = sanitizeUserFacingText(String(data.content || '').trim())
          const content = [title ? `**${title}**` : '', body].filter(Boolean).join('\n\n') || '执行中…'
          appendStreamChunk(progressId, content, {
            role: roleForEvent,
            timestamp: msgTimestamp,
            node: msgNode,
            taskId: msgTaskId || undefined,
          }, primarySessionId)
          if (msgTaskId && taskChannelId) {
            appendStreamChunk(progressId, content, {
              role: roleForEvent,
              timestamp: msgTimestamp,
              node: msgNode,
              taskId: msgTaskId || undefined,
            }, taskChannelId)
          }
          return
        }

        // role.completed after execution.progress: finalize the streaming message
        if (eventKind === 'role.completed') {
          const progressId = `exec-progress-${msgTaskId || 'chat'}-${msgRole}`
          finalizeStreamMessage(progressId, '', {
            role: ((['planner', 'critic', 'judge', 'executor', 'output', 'tl'].includes(msgRole) ? msgRole : 'system')) as any,
            timestamp: msgTimestamp,
            node: msgNode,
            taskId: msgTaskId || undefined,
          }, primarySessionId)
          if (msgTaskId && taskChannelId) {
            finalizeStreamMessage(progressId, '', {
              role: ((['planner', 'critic', 'judge', 'executor', 'output', 'tl'].includes(msgRole) ? msgRole : 'system')) as any,
              timestamp: msgTimestamp,
              node: msgNode,
              taskId: msgTaskId || undefined,
            }, taskChannelId)
          }
          // Don't return — still want to add the completed message below
        }

        const roleForEvent = ((['planner', 'critic', 'judge', 'executor', 'output', 'tl'].includes(msgRole) ? msgRole : 'system')) as any
        const title = String(data.title || '').trim()
        const body = sanitizeUserFacingText(String(data.content || '').trim())
        if (!body && ['review.result', 'decision.final', 'artifact.produced', 'output.delivered'].includes(eventKind)) {
          return
        }
        const content = [title ? `## ${title}` : '', body].filter(Boolean).join('\n\n') || `## ${eventKind || '协同事件'}`
        const status: 'error' | 'done' = String(data.status || '').toLowerCase() === 'failed' ? 'error' : 'done'
        const message = {
          id: `orch-${msgTaskId || 'chat'}-${eventKind || 'event'}-${msgTimestamp}-${msgRole}`,
          role: roleForEvent,
          content,
          timestamp: msgTimestamp,
          status,
          node: msgNode,
          taskId: msgTaskId || undefined,
          scopeKey: msgScopeKey,
          noCollapse: !['role.started', 'role.completed', 'plan.submit', 'review.result', 'decision.final', 'output.requested', 'output.delivered', 'output.delivery.failed', 'execution.progress', 'tl.analyzed'].includes(eventKind),
        }
        addMessage(message, primarySessionId)
        if (msgTaskId && taskChannelId) addMessage(message, taskChannelId)
        return
      }

      if (msgType === 'task_created') {
        const pendingId = String(data?.messageId || '')
        if (pendingId) updateMessage(pendingId, { status: 'done' }, primarySessionId)
        if (msgTaskId) {
          addMessage({
            id: `task-created-${msgTaskId}-${msgTimestamp}`,
            role: 'planner',
            content: String(data.summary || `任务已创建：${taskTitle}`),
            timestamp: msgTimestamp,
            status: 'done',
            node: msgNode,
            taskId: msgTaskId,
            scopeKey: msgScopeKey,
            noCollapse: true,
          }, primarySessionId)
          if (taskChannelId) {
            getOrCreateTaskChannel(msgTaskId, taskTitle, {
              activate: false,
              create: false,
              explicit: true,
              scopeKey: msgScopeKey || undefined,
            })
          }
          setSelectedTaskId(msgTaskId)
        }
        loadData()
        return
      }

      if (msgType === 'task_update') {
        if (msgTaskId) {
          upsertTask({
            taskId: msgTaskId,
            teamId: String(data.teamId || ''),
            title: taskTitle,
            state: String(data.state || 'pending') as TaskState,
            updatedAt: msgTimestamp,
            currentDriver: String(data.role || data.currentDriver || ''),
            currentMemberKey: String(data.currentMemberKey || ''),
            nextBestAction: String(data.nextBestAction || data.message || ''),
            latestReviewVerdict: data.latestReviewVerdict || null,
            latestDecisionType: data.latestDecisionType || null,
            artifactCount: Number(data.artifactCount || 0),
            evidenceCount: Number(data.evidenceCount || 0),
            issueCount: Number(data.issueCount || 0),
            deliverableReady: Boolean(data.deliverableReady),
            humanInterventionReady: Boolean(data.humanInterventionReady),
            deliveryStatus: String(data.deliveryStatus || ''),
            interventionStatus: String(data.interventionStatus || ''),
            requestedNode: String(data.requestedNode || ''),
            actualNode: String(data.actualNode || ''),
            degradedReason: String(data.degradedReason || ''),
            sessionMode: String(data.sessionMode || ''),
            sessionPersistent: typeof data.sessionPersistent === 'boolean' ? data.sessionPersistent : undefined,
            sessionFallbackReason: String(data.sessionFallbackReason || ''),
            planSummary: String(data.planSummary || ''),
            executiveSummary: String(data.executiveSummary || ''),
            protocolSource: String(data.protocolSource || ''),
          })

          const cleanTaskMessage = sanitizeUserFacingText(String(data.message || ''))
          if (cleanTaskMessage) {
            const taskUpdateMessage = {
              id: `task-update-${msgTaskId}-${msgTimestamp}`,
              role: msgRole as any,
              content: cleanTaskMessage,
              timestamp: msgTimestamp,
              status: 'done' as const,
              node: msgNode,
              taskId: msgTaskId,
              scopeKey: msgScopeKey,
              noCollapse: msgRole !== 'system',
            }
            addMessage(taskUpdateMessage, primarySessionId)
            if (taskChannelId) addMessage(taskUpdateMessage, taskChannelId)
          }
        }
        return
      }

      if (msgType === 'error') {
        const pendingId = String(data?.messageId || '')
        if (pendingId) {
          updateMessage(pendingId, { status: 'error' }, primarySessionId)
          if (msgTaskId && taskChannelId) updateMessage(pendingId, { status: 'error' }, taskChannelId)
        }
        const errorMessage = {
          id: `error-${msgTaskId || 'chat'}-${msgTimestamp}`,
          role: 'system' as const,
          content: `Error: ${data.message || 'Unknown error'}`,
          timestamp: msgTimestamp,
          status: 'error' as const,
          scopeKey: msgScopeKey,
          taskId: msgTaskId || undefined,
          noCollapse: true,
        }
        addMessage(errorMessage, primarySessionId)
        if (msgTaskId && taskChannelId) addMessage(errorMessage, taskChannelId)
      }
    },
  })

  useEffect(() => {
    if (!WS_ENABLED || !connected) return
    send({ type: 'subscribe', scopeKey: activeChatScopeKey })
  }, [connected, send, activeChatScopeKey])

  const selectedTask = selectedTaskId ? tasks.find((t) => String(t.taskId) === String(selectedTaskId)) || null : null

  // P4: auto-expand right panel when a task is selected
  useEffect(() => {
    if (selectedTaskId && rightPanelCollapsed) {
      setRightPanelCollapsed(false)
      try { localStorage.setItem(RIGHT_PANEL_COLLAPSED_KEY, '0') } catch {}
    }
  }, [selectedTaskId]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleRightPanel = useCallback(() => {
    setRightPanelCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(RIGHT_PANEL_COLLAPSED_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }, [])

  const openSelectedTaskWorkbench = useCallback(() => {
    if (!selectedTaskId) return
    setView('kanban')
    setRightPanelCollapsed(false)
    try { localStorage.setItem(RIGHT_PANEL_COLLAPSED_KEY, '0') } catch {}
  }, [selectedTaskId])

  const handleSendMessage = useCallback((text: string) => {
    const messageId = `user-${Date.now()}`
    addMessage({ id: messageId, role: 'user', content: text, timestamp: Date.now(), status: 'pending' })

    const history = messages.slice(-12).map((m) => ({ role: m.role, content: m.content, ts: m.timestamp }))
    const sent = send({ type: 'chat_input', text, messageId, scopeKey: activeChatScopeKey, history })

    if (sent) {
      setChatTransport('realtime')
      return
    }

    setChatTransport('fallback')
    fetch(`${API_BASE}/api/chat/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, scope: activeChatScopeKey, history }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data?.ok) {
          const err = new Error(data?.error || (res.status >= 500 ? '服务暂时不可用' : '请求未成功'))
          ;(err as any).status = res.status
          throw err
        }
        return data
      })
      .then((data) => {
        updateMessage(messageId, { status: 'done' })
        const replySource = String(data?.replySource || '')
        if (data.action !== 'task') {
          if (replySource === 'native_chat') setChatTransport('fallback_native')
          else if (replySource === 'template_fallback' || replySource === 'dispatcher_fallback') setChatTransport('fallback_template')
          else setChatTransport('fallback')
        }
        const createdTaskId = String(data?.taskId || '')
        addMessage({
          id: `agent-${Date.now()}`,
          role: data.action === 'task' ? 'planner' : 'system',
          content: data.summary || (data.action === 'task' ? `任务已创建：${createdTaskId}` : ''),
          timestamp: Date.now(),
          status: 'done',
          taskId: createdTaskId || undefined,
          scopeKey: activeChatScopeKey,
          noCollapse: true,
        })
        if (data.action === 'task') {
          if (createdTaskId) setSelectedTaskId(createdTaskId)
          loadData()
        }
      })
      .catch((err) => {
        setChatTransport('offline')
        updateMessage(messageId, { status: 'error' })
        const raw = String(err?.message || '')
        const content = raw.includes('Failed to fetch')
          ? '会话链路暂时不可达：实时通道未连上，请求回退也失败了。稍后重试或刷新页面。'
          : `会话请求失败：${raw || '请稍后重试'}`
        addMessage({ id: `error-${Date.now()}`, role: 'system', content, timestamp: Date.now(), status: 'error' })
      })
  }, [addMessage, updateMessage, send, loadData, messages])

  useEffect(() => {
    loadData()
    loadNodes()
    loadThreads(selectedTaskId)
  }, [loadData, loadNodes, loadThreads, selectedTaskId])

  useEffect(() => {
    const timer = setInterval(() => {
      loadData()
      loadNodes()
      loadThreads(selectedTaskId)
    }, 30000)
    return () => clearInterval(timer)
  }, [loadData, loadNodes, loadThreads, selectedTaskId])

  return (
    <>
      {showWelcome && (
        <WelcomeScreen
          onStartChat={handleStartChat}
          onOpenSettings={handleOpenSettings}
          onViewDocs={handleViewDocs}
          onQuickStart={handleQuickStart}
        />
      )}
      {!showWelcome && (
    <div className="flex min-h-screen h-dvh-safe flex-col bg-[var(--background)] pb-[calc(env(safe-area-inset-bottom,0px)+76px)] md:pb-0">
      <Header
        lastUpdate={resolveHeaderLastUpdate(lastUpdate, nodesLastUpdate)}
        onRefresh={() => { loadData(); loadNodes() }}
        loading={loading}
        controlPlaneStatus={Object.values(nodes || {}).find((node: any) => node?.stats?.controlPlaneStatus)?.stats?.controlPlaneStatus || ''}
        currentViewLabel={view === 'kanban' ? t('nav.kanban') : view === 'chat' ? t('nav.chat') : view === 'settings' ? t('nav.settings') : t('view.agentsWithNodes')}
        currentView={view}
        onSwitchView={setView}
        selectedTask={selectedTask ? {
          taskId: selectedTask.taskId,
          title: selectedTask.title,
          state: selectedTask.state,
          currentDriver: selectedTask.currentDriver,
        } : null}
        onOpenSelectedTask={selectedTask ? openSelectedTaskWorkbench : undefined}
        tasks={tasks}
      />

      <div className="flex flex-1 min-h-0">
        <div className="relative hidden md:flex h-full shrink-0" style={{ width: `${sidebarCollapsed ? 48 : sidebarWidth}px` }}>
          <Sidebar
            currentView={view}
            onViewChange={setView}
            taskCount={tasks.length}
            collapsed={sidebarCollapsed}
            onToggle={() => {
              const next = !sidebarCollapsed
              setSidebarCollapsed(next)
              try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0') } catch {}
            }}
          />
          {!sidebarCollapsed && (
            <div
              className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
              onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => {
                resizeRef.current = { target: 'sidebar', startX: e.clientX, startWidth: sidebarWidth }
                ;(e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId)
              }}
              aria-label="调整侧栏宽度"
              role="separator"
            />
          )}
        </div>

        <div className="md:hidden">
          <Sidebar
            currentView={view}
            onViewChange={setView}
            taskCount={tasks.length}
          />
        </div>

        <main className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
          {view === 'kanban' && (
            <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
              <KanbanView rightPanelCollapsed={rightPanelCollapsed} onToggleRightPanel={toggleRightPanel} />
            </div>
          )}

          {view === 'chat' && (
            <ChatView
              onSendMessage={handleSendMessage}
              isLoading={messages.some((m) => m.status === 'pending')}
              connected={connected}
              transportStatus={chatTransport}
            />
          )}

          {view === 'agents' && (
            <AgentsView />
          )}

          {view === 'settings' && (
            <SettingsView />
          )}
        </main>

        {view === 'kanban' && !rightPanelCollapsed && (
          <aside className="hidden 2xl:flex min-h-0 shrink-0 border-l border-[var(--border)] bg-[var(--surface)]" style={{ width: `${rightPanelWidth}px` }}>
            <div
              className="w-2 shrink-0 cursor-col-resize hover:bg-[var(--surface-subtle)]"
              onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => {
                resizeRef.current = { target: 'right', startX: e.clientX, startWidth: rightPanelWidth }
                ;(e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId)
              }}
              aria-label="调整任务详情宽度"
              role="separator"
            />
            <div className="min-w-0 flex-1">
              <RightPanel
                selectedTaskId={selectedTaskId}
                selectedTeamId={selectedTask?.teamId || null}
                selectedTask={selectedTask}
                onCloseTask={() => setSelectedTaskId(null)}
                refreshKey={deliverablesRefreshKey}
                defaultTab={rightPanelDefaultTab}
              />
            </div>
          </aside>
        )}
      </div>

      {view === 'kanban' && selectedTaskId && (
        <MobileDrawer onClose={() => setSelectedTaskId(null)}>
          <RightPanel
            selectedTaskId={selectedTaskId}
            selectedTeamId={selectedTask?.teamId || null}
            selectedTask={selectedTask}
            onCloseTask={() => setSelectedTaskId(null)}
            refreshKey={deliverablesRefreshKey}
            defaultTab={rightPanelDefaultTab}
          />
        </MobileDrawer>
      )}

      {selectedTask && view !== 'kanban' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+82px)] z-40 px-3 md:hidden">
          <div className="pointer-events-auto mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-[var(--accent)]/18 bg-[var(--surface)]/96 px-3 py-2.5 shadow-[0_16px_36px_rgba(15,23,42,0.14)] backdrop-blur-md">
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-[var(--accent)]">{t('header.currentSite')}</div>
              <div className="truncate text-[13px] font-semibold text-[var(--fg)]">{selectedTask.title || selectedTask.taskId}</div>
              <div className="mt-0.5 text-[11px] text-[var(--fg-muted)]">{selectedTask.state} · {selectedTask.currentDriver || t('task.teamProgressing')}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={openSelectedTaskWorkbench}
                className="rounded-xl bg-[var(--accent)] px-3 py-2 text-[11px] font-medium text-white"
              >
                {t('header.backToSite')}
              </button>
              <button
                type="button"
                onClick={() => setSelectedTaskId(null)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[11px] font-medium text-[var(--fg-secondary)]"
              >
                {t('header.close')}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      )}
    </>
  )
}
