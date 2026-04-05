import { create } from 'zustand'
import { TaskCard, TaskState, ChatMessage, ChatSession, LiveFlowEvent, SubtaskEntry, ThreadSummaryItem } from './types'

// ─── Task Slice ─────────────────────────────────────────────────────

import { NodeSummary } from './types'

interface TaskSlice {
  tasks: TaskCard[]
  nodes: NodeSummary[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  lastUpdate: number | null
  nodesLastUpdate: number | null
  totalCount: number
  cursor: number
  hasMore: boolean
  /** Currently selected task ID (for right panel) */
  selectedTaskId: string | null
  /** taskId → subtask entries */
  subtaskState: Record<string, Record<string, SubtaskEntry>>
  setTasks: (tasks: TaskCard[], opts?: { cursor?: number; hasMore?: boolean; totalCount?: number }) => void
  setSelectedTaskId: (taskId: string | null) => void
  appendTasks: (tasks: TaskCard[], cursor: number, hasMore: boolean, totalCount: number) => void
  upsertTask: (task: TaskCard) => void
  setNodes: (nodes: NodeSummary[]) => void
  setLoading: (loading: boolean) => void
  setLoadingMore: (loading: boolean) => void
  setError: (error: string | null) => void
  upsertSubtaskEntry: (taskId: string, entry: SubtaskEntry) => void
  clearSubtaskEntries: (taskId: string) => void
}

export const useTaskStore = create<TaskSlice>((set) => ({
  tasks: [],
  nodes: [],
  loading: false,
  loadingMore: false,
  error: null,
  lastUpdate: null,
  nodesLastUpdate: null,
  totalCount: 0,
  cursor: 0,
  hasMore: false,
  selectedTaskId: null,
  subtaskState: {},
  setSelectedTaskId: (taskId) => set({ selectedTaskId: taskId }),
  setTasks: (tasks, opts) => {
    const cursor = Number(opts?.cursor || 0) || 0
    const hasMore = typeof opts?.hasMore === 'boolean' ? opts.hasMore : (tasks.length > 0)
    const totalCount = Number(opts?.totalCount || 0) || tasks.length
    set({ tasks, cursor, hasMore, totalCount, lastUpdate: Date.now() })
  },
  appendTasks: (newTasks, nextCursor, hasMore, totalCount) => set((state) => {
    const existing = new Set(state.tasks.map((t) => t.taskId))
    const deduped = newTasks.filter((t) => !existing.has(t.taskId))
    return {
      tasks: [...state.tasks, ...deduped],
      cursor: nextCursor,
      hasMore,
      totalCount,
      lastUpdate: Date.now(),
    }
  }),
  upsertTask: (task) => set((state) => {
    const idx = state.tasks.findIndex((t) => t.taskId === task.taskId)
    if (idx === -1) {
      return { tasks: [task, ...state.tasks], lastUpdate: Date.now() }
    }
    const next = state.tasks.slice()
    next[idx] = { ...next[idx], ...task }
    return { tasks: next, lastUpdate: Date.now() }
  }),
  setNodes: (nodes) => set({ nodes, nodesLastUpdate: Date.now() }),
  setLoading: (loading) => set({ loading }),
  setLoadingMore: (loading) => set({ loadingMore: loading }),
  setError: (error) => set({ error }),
  upsertSubtaskEntry: (taskId, entry) => set((state) => {
    const taskEntries = { ...(state.subtaskState[taskId] || {}) }
    // If transitioning from retrying to done/failed, keep highest round
    const prev = taskEntries[entry.subtaskId]
    if (prev && entry.status === 'retrying' && prev.status !== 'retrying') {
      // Keep previous state if it was already done/failed
      return state
    }
    taskEntries[entry.subtaskId] = entry
    return { subtaskState: { ...state.subtaskState, [taskId]: taskEntries } }
  }),
  clearSubtaskEntries: (taskId) => set((state) => {
    const next = { ...state.subtaskState }
    delete next[taskId]
    return { subtaskState: next }
  }),
}))

// ─── Chat Slice (with sessions) ─────────────────────────────────────

const DEFAULT_SESSION_ID = 'default'

interface ChatSlice {
  // Session management
  activeSessionId: string
  sessions: ChatSession[]
  /** sessionId → messages */
  sessionMessages: Record<string, ChatMessage[]>

  // Session actions
  setActiveSession: (sessionId: string) => void
  createSession: (title?: string, opts?: { taskId?: string; pinned?: boolean; explicit?: boolean; scopeKey?: string }) => string
  getOrCreateTaskChannel: (taskId: string, taskTitle: string, opts?: { activate?: boolean; create?: boolean; explicit?: boolean; scopeKey?: string }) => string | null
  applyThreadSummaries: (items: ThreadSummaryItem[]) => void
  deleteSession: (sessionId: string) => void

  // Message actions (operate on active session)
  addMessage: (message: ChatMessage, sessionId?: string) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>, sessionId?: string) => void
  deleteMessages: (ids: string[], sessionId?: string) => void
  /** Append streaming chunk to a message, or create one if not found */
  appendStreamChunk: (messageId: string, content: string, patch?: Partial<ChatMessage>, sessionId?: string) => void
  /** Mark a streaming message as done with final content */
  finalizeStreamMessage: (messageId: string, content: string, patch?: Partial<ChatMessage>, sessionId?: string) => void
  clearMessages: () => void
  clearThinkingMessages: () => void
  clearThinkingMessagesByTask: (taskId: string) => void
  getRecentHistory: (count: number) => Array<{ role: string; content: string; ts: number }>

  // Derive active session messages
  messages: ChatMessage[]
}

function buildDefaultSession(): ChatSession {
  return {
    sessionId: DEFAULT_SESSION_ID,
    title: '主会话',
    icon: '#',
    lastMessage: '',
    updatedAt: Date.now(),
    messageCount: 0,
    unreadCount: 0,
    pinned: true,
    threadId: DEFAULT_SESSION_ID,
    threadType: 'workspace',
    phase: 'workspace',
    goal: '团队主入口与总览沟通',
    blockingIssues: 0,
    pendingHumanActions: 0,
  }
}

export const useChatStore = create<ChatSlice>((set, get) => {
  const defaultSession = buildDefaultSession()

  return {
    activeSessionId: DEFAULT_SESSION_ID,
    sessions: [defaultSession],
    sessionMessages: { [DEFAULT_SESSION_ID]: [] },
    messages: [],

    setActiveSession: (sessionId) =>
      set((state) => {
        const msgs = state.sessionMessages[sessionId]
        if (!msgs && sessionId !== DEFAULT_SESSION_ID) return state
        // Clear unread when switching to channel
        const nextSessions = state.sessions.map((s) =>
          s.sessionId === sessionId ? { ...s, unreadCount: 0 } : s
        )
        return { activeSessionId: sessionId, messages: msgs || [], sessions: nextSessions }
      }),

    createSession: (title, opts) => {
      const id = `session-${Date.now()}`
      const threadType = opts?.taskId ? 'task' : 'workspace'
      const session: ChatSession = {
        sessionId: id,
        title: title || `${threadType === 'task' ? '任务对话' : '主对话'} ${get().sessions.length + 1}`,
        icon: opts?.taskId ? '@' : '#',
        lastMessage: '',
        updatedAt: Date.now(),
        messageCount: 0,
        unreadCount: 0,
        taskId: opts?.taskId,
        threadId: opts?.taskId || id,
        threadType,
        phase: opts?.taskId ? 'task' : 'workspace',
        goal: opts?.taskId ? `围绕任务 ${title || opts?.taskId || ''} 协作推进` : '团队主入口与总览沟通',
        blockingIssues: 0,
        pendingHumanActions: 0,
        pinned: opts?.pinned || false,
        explicit: opts?.explicit ?? !opts?.taskId,
        scopeKey: opts?.scopeKey,
      }
      set((state) => ({
        sessions: [session, ...state.sessions],
        sessionMessages: { ...state.sessionMessages, [id]: [] },
        activeSessionId: id,
        messages: [],
      }))
      return id
    },

    getOrCreateTaskChannel: (taskId, taskTitle, opts) => {
      const state = get()
      const activate = opts?.activate ?? true
      const create = opts?.create ?? true
      const explicit = opts?.explicit ?? false
      const scopeKey = opts?.scopeKey
      const existing = state.sessions.find(s => s.taskId === taskId)
      if (existing) {
        if ((explicit && !existing.explicit) || (taskTitle && taskTitle !== existing.title) || (scopeKey && scopeKey !== existing.scopeKey)) {
          set((inner) => ({
            sessions: inner.sessions.map((s) => s.sessionId === existing.sessionId
              ? {
                  ...s,
                  title: taskTitle || s.title,
                  explicit: explicit || s.explicit,
                  scopeKey: scopeKey || s.scopeKey,
                  threadId: s.threadId || s.taskId || s.sessionId,
                  threadType: s.threadType || 'task',
                  phase: s.phase || 'task',
                  goal: taskTitle ? `围绕任务 ${taskTitle} 协作推进` : (s.goal || ''),
                }
              : s),
          }))
        }
        if (activate) state.setActiveSession(existing.sessionId)
        return existing.sessionId
      }
      if (!create) return null
      return state.createSession(taskTitle || taskId, { taskId, explicit, scopeKey })
    },

    applyThreadSummaries: (items) => {
      const summaries = Array.isArray(items) ? items : []
      set((state) => {
        const sessionMessages = { ...state.sessionMessages }
        const byTaskId = new Map(summaries.filter(Boolean).map((item) => [String(item.taskId || ''), item]))
        const nextSessions = [...state.sessions]

        for (const item of summaries) {
          const taskId = String(item?.taskId || '')
          if (!taskId) continue
          const existingIndex = nextSessions.findIndex((session) => String(session.taskId || '') === taskId)
          if (existingIndex >= 0) {
            const existing = nextSessions[existingIndex]
            nextSessions[existingIndex] = {
              ...existing,
              title: item.title || existing.title,
              taskId,
              threadId: item.threadId || existing.threadId || taskId,
              parentThreadId: item.parentThreadId || existing.parentThreadId,
              threadType: item.threadType || existing.threadType || 'task',
              phase: item.phase || existing.phase,
              goal: item.goal || existing.goal,
              owner: item.owner || existing.owner,
              state: item.state || existing.state,
              latestDeliverableId: item.latestDeliverableId || existing.latestDeliverableId,
              blockingIssues: Number(item.blockingIssues ?? existing.blockingIssues ?? 0),
              pendingHumanActions: Number(item.pendingHumanActions ?? existing.pendingHumanActions ?? 0),
              updatedAt: Math.max(Number(item.updatedAt || 0), Number(existing.updatedAt || 0)),
            }
            continue
          }

          const sessionId = `thread:${taskId}`
          if (!sessionMessages[sessionId]) sessionMessages[sessionId] = []
          nextSessions.push({
            sessionId,
            title: item.title || taskId,
            icon: '@',
            lastMessage: '',
            updatedAt: Number(item.updatedAt || Date.now()),
            messageCount: sessionMessages[sessionId].length,
            unreadCount: 0,
            taskId,
            threadId: item.threadId || taskId,
            parentThreadId: item.parentThreadId,
            threadType: item.threadType || 'task',
            phase: item.phase,
            goal: item.goal,
            owner: item.owner,
            state: item.state,
            latestDeliverableId: item.latestDeliverableId,
            blockingIssues: Number(item.blockingIssues || 0),
            pendingHumanActions: Number(item.pendingHumanActions || 0),
            explicit: false,
          })
        }

        const mergedSessions = nextSessions
          .map((session) => {
            const taskId = String(session.taskId || '')
            const item = taskId ? byTaskId.get(taskId) : null
            if (!item || !taskId) return session
            return {
              ...session,
              threadId: item.threadId || session.threadId,
              parentThreadId: item.parentThreadId || session.parentThreadId,
              threadType: item.threadType || session.threadType,
              phase: item.phase || session.phase,
              goal: item.goal || session.goal,
              owner: item.owner || session.owner,
              state: item.state || session.state,
              latestDeliverableId: item.latestDeliverableId || session.latestDeliverableId,
              blockingIssues: Number(item.blockingIssues ?? session.blockingIssues ?? 0),
              pendingHumanActions: Number(item.pendingHumanActions ?? session.pendingHumanActions ?? 0),
              updatedAt: Math.max(Number(item.updatedAt || 0), Number(session.updatedAt || 0)),
            }
          })
          .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))

        return {
          sessions: mergedSessions,
          sessionMessages,
          messages: sessionMessages[state.activeSessionId] || state.messages,
        }
      })
    },

    deleteSession: (sessionId) => {
      if (sessionId === DEFAULT_SESSION_ID) return
      set((state) => {
        const nextMessages = { ...state.sessionMessages }
        delete nextMessages[sessionId]
        const nextSessions = state.sessions.filter((s) => s.sessionId !== sessionId)
        const nextActive = state.activeSessionId === sessionId ? DEFAULT_SESSION_ID : state.activeSessionId
        return {
          sessions: nextSessions,
          sessionMessages: nextMessages,
          activeSessionId: nextActive,
          messages: nextMessages[nextActive] || [],
        }
      })
    },

    addMessage: (message, sid) => {
      const sessionId = sid || get().activeSessionId
      set((state) => {
        const isActive = sessionId === state.activeSessionId
        const current = state.sessionMessages[sessionId] || []

        // Dedup: exact id match
        const existingIndex = current.findIndex((m) => m.id === message.id)
        if (existingIndex >= 0) {
          const updated = current.map((m, idx) => (idx === existingIndex ? { ...m, ...message } : m))
          const nextMessages = { ...state.sessionMessages, [sessionId]: updated }
          return {
            sessionMessages: nextMessages,
            messages: isActive ? updated : state.messages,
            sessions: state.sessions.map((s) => s.sessionId === sessionId ? { ...s, lastMessage: message.content?.slice(0, 80) || s.lastMessage, updatedAt: Date.now() } : s),
          }
        }

        // Dedup: same (taskId, role, content) within 3s window — suppress duplicate task_update/thinking
        if (message.taskId && message.content) {
          const recentDup = current.find((m) =>
            m.taskId === message.taskId &&
            m.role === message.role &&
            m.content === message.content &&
            Math.abs((m.timestamp || 0) - (message.timestamp || Date.now())) < 3000
          )
          if (recentDup) return state
        }

        // Dedup: same role thinking placeholder already exists — replace instead of append
        if (message.streaming && message.taskId) {
          const thinkingIdx = current.findIndex((m) => m.streaming && m.taskId === message.taskId && m.role === message.role)
          if (thinkingIdx >= 0) {
            const updated = current.map((m, i) => i === thinkingIdx ? { ...m, ...message } : m)
            const nextMessages = { ...state.sessionMessages, [sessionId]: updated }
            return {
              sessionMessages: nextMessages,
              messages: isActive ? updated : state.messages,
            }
          }
        }

        const updated = [...current, message]
        const nextMessages = { ...state.sessionMessages, [sessionId]: updated }
        const nextSessions = state.sessions.map((s) => {
          if (s.sessionId !== sessionId) return s
          return {
            ...s,
            lastMessage: message.content?.slice(0, 80) || '',
            updatedAt: Date.now(),
            messageCount: updated.length,
            unreadCount: isActive ? 0 : (s.unreadCount || 0) + 1,
          }
        })
        return {
          sessionMessages: nextMessages,
          sessions: nextSessions,
          messages: isActive ? updated : state.messages,
        }
      })
    },

    updateMessage: (id, updates, sessionIdArg) =>
      set((state) => {
        const sid = sessionIdArg || state.activeSessionId
        const current = state.sessionMessages[sid] || []
        const updated = current.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg))
        return {
          sessionMessages: { ...state.sessionMessages, [sid]: updated },
          messages: sid === state.activeSessionId ? updated : state.messages,
        }
      }),

    deleteMessages: (ids, sessionIdArg) =>
      set((state) => {
        const sid = sessionIdArg || state.activeSessionId
        const targetIds = new Set((ids || []).filter(Boolean))
        if (targetIds.size === 0) return state
        const current = state.sessionMessages[sid] || []
        const updated = current.filter((msg) => !targetIds.has(msg.id))
        if (updated.length === current.length) return state
        const lastMessage = updated[updated.length - 1]
        return {
          sessionMessages: { ...state.sessionMessages, [sid]: updated },
          sessions: state.sessions.map((s) =>
            s.sessionId === sid
              ? {
                  ...s,
                  lastMessage: lastMessage?.content?.slice(0, 80) || '',
                  messageCount: updated.length,
                  updatedAt: Date.now(),
                }
              : s
          ),
          messages: sid === state.activeSessionId ? updated : state.messages,
        }
      }),

    appendStreamChunk: (messageId, content, patch, sessionIdArg) =>
      set((state) => {
        const sid = sessionIdArg || state.activeSessionId
        const current = state.sessionMessages[sid] || []
        const idx = current.findIndex((msg) => msg.id === messageId)
        let updated: ChatMessage[]
        if (idx >= 0) {
          updated = current.map((msg, i) => i === idx
            ? { ...msg, ...patch, content: String(content || ''), streaming: true, status: 'done' }
            : msg)
        } else {
          updated = [...current, {
            id: messageId,
            role: (patch?.role as any) || 'assistant',
            content: String(content || ''),
            timestamp: Number(patch?.timestamp || Date.now()),
            status: 'done',
            streaming: true,
            node: patch?.node,
            taskId: patch?.taskId,
          }]
        }
        return {
          sessionMessages: { ...state.sessionMessages, [sid]: updated },
          messages: sid === state.activeSessionId ? updated : state.messages,
        }
      }),

    finalizeStreamMessage: (messageId, content, patch, sessionIdArg) =>
      set((state) => {
        const sid = sessionIdArg || state.activeSessionId
        const current = state.sessionMessages[sid] || []
        const idx = current.findIndex((msg) => msg.id === messageId)
        let updated: ChatMessage[]
        if (idx >= 0) {
          updated = current.map((msg, i) => i === idx
            ? { ...msg, ...patch, content: String(content || ''), streaming: false, status: 'done' }
            : msg)
        } else {
          updated = [...current, {
            id: messageId,
            role: (patch?.role as any) || 'assistant',
            content: String(content || ''),
            timestamp: Number(patch?.timestamp || Date.now()),
            status: 'done',
            streaming: false,
            node: patch?.node,
            taskId: patch?.taskId,
          }]
        }
        return {
          sessionMessages: { ...state.sessionMessages, [sid]: updated },
          messages: sid === state.activeSessionId ? updated : state.messages,
        }
      }),

    clearMessages: () => {
      const sid = get().activeSessionId
      set((state) => ({
        sessionMessages: { ...state.sessionMessages, [sid]: [] },
        sessions: state.sessions.map((s) =>
          s.sessionId === sid ? { ...s, lastMessage: '', messageCount: 0, updatedAt: Date.now() } : s
        ),
        messages: [],
      }))
    },

    clearThinkingMessages: () => {
      const sid = get().activeSessionId
      set((state) => {
        const current = state.sessionMessages[sid] || []
        const filtered = current.filter(m => !m.id.startsWith('thinking-') && m.content !== '思考中…')
        if (filtered.length === current.length) return state
        return {
          sessionMessages: { ...state.sessionMessages, [sid]: filtered },
          messages: filtered,
        }
      })
    },

    clearThinkingMessagesByTask: (taskId: string) => {
      set((state) => {
        const nextSessionMessages: Record<string, ChatMessage[]> = {}
        let changed = false
        for (const [sid, msgs] of Object.entries(state.sessionMessages)) {
          const filtered = (msgs || []).filter((m) => !(m.id.startsWith('thinking-') && String(m.taskId || '') === String(taskId || '')))
          nextSessionMessages[sid] = filtered
          if (filtered.length !== (msgs || []).length) changed = true
        }
        if (!changed) return state
        return {
          sessionMessages: nextSessionMessages,
          messages: nextSessionMessages[state.activeSessionId] || [],
        }
      })
    },

    getRecentHistory: (count) => {
      const msgs = get().messages
      return msgs.slice(-count).map((m) => ({ role: m.role, content: m.content, ts: m.timestamp }))
    },
  }
})

// ─── Live Feed Slice ────────────────────────────────────────────────

interface LiveSlice {
  /** taskId → events (newest first, capped at 40) */
  feed: Record<string, LiveFlowEvent[]>
  addEvent: (event: LiveFlowEvent) => void
  clearFeed: (taskId?: string) => void
  /** Get events for a task (ordered newest first) */
  getEvents: (taskId: string) => LiveFlowEvent[]
}

export const useLiveStore = create<LiveSlice>((set, get) => ({
  feed: {},
  addEvent: (event) =>
    set((state) => {
      const current = Array.isArray(state.feed[event.taskId]) ? state.feed[event.taskId] : []
      const deduped = current.filter((item) => item.id !== event.id)
      return {
        feed: { ...state.feed, [event.taskId]: [event, ...deduped].slice(0, 40) },
      }
    }),
  clearFeed: (taskId) =>
    set((state) => {
      if (!taskId) return { feed: {} }
      const next = { ...state.feed }
      delete next[taskId]
      return { feed: next }
    }),
  getEvents: (taskId) => get().feed[taskId] || [],
}))
