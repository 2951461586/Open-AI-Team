'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Send, Loader2, MessageCircle, AlertCircle, Users, PackageOpen, FolderOpen, Route } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { sendTaskChat } from '@/lib/api'
import { useChatStore, useTaskStore } from '@/lib/store'
import { ChatMessage, ChatRole, ChatSession, FocusTarget, TaskCard as TaskCardType, NodeSummary } from '@/lib/types'
import { formatExactTime, formatTime, roleLabel, stateLabel, nodeLabel, routeModeLabel, sessionModeLabel, sessionCapabilityHint, degradedReasonLabel, threadPhaseLabel } from '@/lib/utils'
import { focusSummaryLabel, pickTaskFocusRef, withFocusOpenTab } from '@/lib/task-focus'
import { PanelEmptyState } from '@/components/ui/panel-states'

interface Props {
  taskId: string | null
  task?: TaskCardType | null
  focusTarget?: FocusTarget | null
  onFocusTarget?: (target: FocusTarget | null) => void
}

const AGENT_ROLES: ChatRole[] = ['assistant', 'planner', 'critic', 'judge', 'executor', 'output']

function buildRoleNodeMap(nodes: NodeSummary[]) {
  const map: Record<string, string> = {}
  for (const node of nodes || []) {
    for (const role of node.preferredRoles || []) {
      if (!map[role]) map[role] = node.label || nodeLabel(node.key)
    }
  }
  return map
}

function parseTargetCommand(text: string): { target: string; message: string } {
  const trimmed = text.trim()
  const match = trimmed.match(/^\/ask\s+(\S+)\s+([\s\S]+)$/i)
  if (match) return { target: match[1].toLowerCase(), message: match[2].trim() }
  return { target: '', message: trimmed }
}

function normalizeReplyRole(raw?: string): ChatRole {
  const normalized = String(raw || '').trim().toLowerCase()
  if (['planner', 'critic', 'judge', 'executor', 'output', 'assistant', 'system'].includes(normalized)) {
    return normalized as ChatRole
  }
  if (normalized === 'tl' || normalized === 'member') return 'assistant'
  return 'assistant'
}

function threadTypeLabel(session?: ChatSession | null) {
  const type = String(session?.threadType || (session?.taskId ? 'task' : 'workspace'))
  if (type === 'execution') return '执行对话'
  if (type === 'review') return '评审对话'
  if (type === 'decision') return '裁决对话'
  if (type === 'workspace') return '主对话'
  return '协作对话'
}

function buildFocusDraft(target: FocusTarget, overrideIntent?: 'followup' | 'retry' | 'replan') {
  const intent = overrideIntent || target.intent || 'followup'
  const targetRole = String(target.targetRole || '').trim()
  const summary = String(target.summary || '').trim()
  const rolePrompt = targetRole ? `，当前责任角色是${roleLabel(targetRole)}` : ''

  if (intent === 'retry') {
    return [
      '/ask tl',
      `请对当前定位的子任务执行一次定向重试，只重开当前执行项，不影响其他已完成项${rolePrompt}。`,
      summary ? `失败/卡住上下文：${summary}` : '',
    ].filter(Boolean).join(' ')
  }

  if (intent === 'replan') {
    return [
      '/ask tl',
      `请基于当前失败或阻塞情况，重新安排这个子任务的下一步，尽量不要重做其他已完成项${rolePrompt}。`,
      summary ? `当前上下文：${summary}` : '',
    ].filter(Boolean).join(' ')
  }

  return [
    `/ask ${targetRole || 'tl'}`,
    `请继续跟进当前定位的子任务${rolePrompt}。`,
    summary ? `当前上下文：${summary}` : '',
  ].filter(Boolean).join(' ')
}

function roleStyle(role: ChatRole) {
  if (role === 'planner') return 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
  if (role === 'critic') return 'border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]'
  if (role === 'judge') return 'border-[var(--node-violet)] bg-[var(--node-violet)]/10 text-[var(--node-violet)]'
  if (role === 'executor' || role === 'output') return 'border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]'
  if (role === 'user') return 'border-[var(--accent)] bg-[var(--accent)] text-white'
  if (role === 'system') return 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]'
  return 'border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]'
}

function artifactLabel(msg: ChatMessage) {
  const raw = String(msg.artifactType || '').trim().toLowerCase()
  if (raw === 'plan') return '计划'
  if (raw === 'review') return '评审'
  if (raw === 'decision') return '裁决'
  if (raw === 'executor_artifact') return '执行产物'
  if (raw === 'output_request') return '输出请求'
  return '交付信号'
}

function QuickActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--fg-secondary)] transition hover:bg-[var(--surface-subtle)]"
    >
      {label}
    </button>
  )
}

function MessageBubble({ msg, onFocusTarget }: { msg: ChatMessage; onFocusTarget?: (target: FocusTarget | null) => void }) {
  const isUser = msg.role === 'user'
  const isSystem = msg.role === 'system'
  const artifactTitle = String(msg.artifactTitle || '').trim()
  const artifactSummary = String(msg.content || '').split(/\n{2,}/)[0] || String(msg.content || '').slice(0, 180)

  if (msg.artifactId) {
    return (
      <div className="rounded-2xl border border-[var(--success)]/25 bg-[var(--success-soft)]/50 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--success)]/25 bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--success)]">
              <PackageOpen className="h-3.5 w-3.5" /> {artifactLabel(msg)}
            </div>
            <div className="mt-2 text-[13px] font-semibold text-[var(--fg)]">{artifactTitle || '对话内交付已更新'}</div>
            <div className="mt-1 text-[12px] leading-5 text-[var(--fg-secondary)]">{artifactSummary || '有一条新的可见交付信号。'}</div>
          </div>
          <div className="shrink-0 text-[11px] text-[var(--fg-ghost)]">{formatExactTime(msg.timestamp)}</div>
        </div>
        {onFocusTarget && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onFocusTarget({ openTab: 'deliverables' })}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--success)]/25 bg-[var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--success)] transition hover:opacity-90"
            >
              <PackageOpen className="h-3.5 w-3.5" /> 查查看交付
            </button>
            <button
              type="button"
              onClick={() => onFocusTarget({ openTab: 'files' })}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--fg-secondary)] transition hover:bg-[var(--surface-subtle)]"
            >
              <FolderOpen className="h-3.5 w-3.5" /> 查查看文件
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : isSystem ? 'justify-center' : 'justify-start'}`}>
      {isSystem ? (
        <div className="max-w-[92%] rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-[11px] text-[var(--fg-secondary)]">
          {msg.status === 'pending' ? '线程处理中…' : msg.content}
        </div>
      ) : (
        <div className={`max-w-[88%] rounded-2xl border px-3.5 py-3 ${isUser ? 'border-transparent bg-[var(--accent)] text-white' : roleStyle(msg.role)}`}>
          <div className={`mb-2 flex items-center gap-2 text-[11px] ${isUser ? 'text-white/85' : 'text-[var(--fg-ghost)]'}`}>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${isUser ? 'border-white/20 bg-white/10 text-white' : roleStyle(msg.role)}`}>
              {msg.role === 'user' ? '你' : roleLabel(msg.role)}
            </span>
            <span>{formatExactTime(msg.timestamp)}</span>
            {msg.status === 'pending' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          </div>
          {msg.status === 'pending' && !msg.content ? (
            <div className={`text-[13px] ${isUser ? 'text-white' : 'text-[var(--fg-secondary)]'}`}>线程处理中…</div>
          ) : msg.status === 'error' ? (
            <div className="flex items-start gap-2 text-[13px] leading-6">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{msg.content}</span>
            </div>
          ) : isUser ? (
            <div className="whitespace-pre-wrap text-[13px] leading-6">{msg.content}</div>
          ) : (
            <div className="prose prose-sm max-w-none break-words text-[13px] leading-6 text-inherit [overflow-wrap:anywhere] [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-[var(--border)] [&_pre]:bg-[var(--surface)] [&_pre]:p-3">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function TaskChatPanel({ taskId, task = null, focusTarget = null, onFocusTarget }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const { nodes } = useTaskStore()
  const {
    sessions,
    sessionMessages,
    messages,
    getOrCreateTaskChannel,
    addMessage,
    updateMessage,
  } = useChatStore()

  const taskSession = useMemo(
    () => sessions.find((session) => String(session.taskId || '') === String(taskId || '')) || null,
    [sessions, taskId],
  )

  const taskSessionId = taskSession?.sessionId || null
  const taskMessages = useMemo(() => {
    if (!taskId) return []
    if (taskSessionId) return sessionMessages[taskSessionId] || []
    return messages.filter((msg) => String(msg.taskId || '') === String(taskId || ''))
  }, [taskId, taskSessionId, sessionMessages, messages])

  useEffect(() => {
    setInput('')
    setSending(false)
  }, [taskId])

  useEffect(() => {
    if (!focusTarget) return
    setInput(buildFocusDraft(focusTarget))
    inputRef.current?.focus()
  }, [focusTarget])

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [taskMessages, sending])

  const activeRoles = useMemo(() => {
    const seen = new Set<string>()
    for (const msg of taskMessages) {
      if (AGENT_ROLES.includes(msg.role)) seen.add(msg.role)
    }
    return Array.from(seen)
  }, [taskMessages])

  const artifactSignals = useMemo(() => taskMessages.filter((msg) => Boolean(msg.artifactId)).length, [taskMessages])
  const latestMessage = taskMessages[taskMessages.length - 1] || null
  const pendingHumanActions = Number(taskSession?.pendingHumanActions || 0)
  const blockingIssues = Number(taskSession?.blockingIssues || task?.issueCount || 0)
  const deliveryReady = Boolean(task?.deliverableReady)
  const routeMode = routeModeLabel({ requestedNode: task?.requestedNode, actualNode: task?.actualNode, degradedReason: task?.degradedReason })
  const sessionModeText = sessionModeLabel({ sessionMode: task?.sessionMode, sessionPersistent: task?.sessionPersistent })
  const sessionHint = sessionCapabilityHint({ sessionMode: task?.sessionMode, sessionPersistent: task?.sessionPersistent, sessionFallbackReason: task?.sessionFallbackReason })
  const roleNodeMap = useMemo(() => buildRoleNodeMap(nodes), [nodes])
  const draftTarget = useMemo(() => {
    const parsed = parseTargetCommand(input)
    return String(parsed.target || focusTarget?.targetRole || '').trim().toLowerCase()
  }, [input, focusTarget])
  const suggestedNodeLabel = draftTarget ? roleNodeMap[draftTarget] || '' : ''
  const recommendedNodeLabel = useMemo(() => {
    const sorted = [...nodes].sort((a, b) => Number(b.weight || 0) - Number(a.weight || 0))
    const recommended = sorted.find((node) => node.recommended) || sorted[0]
    return recommended ? (recommended.label || nodeLabel(recommended.key)) : ''
  }, [nodes])
  const roleRouteSummary = useMemo(() => ['planner', 'executor', 'critic', 'judge']
    .filter((role) => roleNodeMap[role])
    .map((role) => `${roleLabel(role as any)}→${roleNodeMap[role]}`)
    .join(' · '), [roleNodeMap])
  const inputHint = suggestedNodeLabel
    ? `本次点名建议优先路由到 ${suggestedNodeLabel}。`
    : recommendedNodeLabel
      ? `当前默认调度建议：新动作优先看 ${recommendedNodeLabel}。${roleRouteSummary ? ` 角色落点：${roleRouteSummary}` : ''}`
      : roleRouteSummary || '当前对话会按任务现场与角色偏好自动路由。'
  const threadPulse = deliveryReady
    ? '线程已经进入验收窗口，建议直接切交付面确认是否可以收口。'
    : pendingHumanActions > 0
      ? `线程里还有 ${pendingHumanActions} 个待人工动作，协作已接近拍板点。`
      : blockingIssues > 0
        ? `线程已沉淀内容，但仍有 ${blockingIssues} 个风险/阻塞信号未消化。`
        : taskMessages.length > 0
          ? '协作对话已经接上真实协作回流，可以在这里继续追问、补派、催交付。'
          : '协作对话已就位，但还没有新的协作消息。'

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || !taskId || sending) return

    const { target, message } = parseTargetCommand(text)
    const sessionId = taskSessionId || getOrCreateTaskChannel(taskId, task?.title || taskId, {
      activate: false,
      create: true,
      explicit: true,
    })

    if (!sessionId) return

    const now = Date.now()
    const userMessageId = `task-user-${taskId}-${now}`
    const pendingReplyId = `task-agent-${taskId}-${now}`
    const targetRole = focusTarget?.targetRole || target || undefined
    const pendingRole = normalizeReplyRole(targetRole)

    addMessage({
      id: userMessageId,
      role: 'user',
      content: text,
      timestamp: now,
      status: 'done',
      taskId,
      noCollapse: true,
    }, sessionId)

    if (target) {
      addMessage({
        id: `task-route-${taskId}-${now}`,
        role: 'system',
        content: `已把这次跟进指向 **${target}**。`,
        timestamp: now + 1,
        status: 'done',
        taskId,
        noCollapse: true,
      }, sessionId)
    }

    addMessage({
      id: pendingReplyId,
      role: pendingRole,
      content: '',
      timestamp: now + 2,
      status: 'pending',
      taskId,
      noCollapse: true,
    }, sessionId)

    setInput('')
    setSending(true)

    try {
      const res = await sendTaskChat(taskId, message, target || undefined, {
        intent: focusTarget?.intent,
        targetRole,
        ...pickTaskFocusRef(focusTarget as Record<string, any>),
      })
      const data = await res.json().catch(() => ({}))

      if (data.ok) {
        const routeLabel = data.routedTo === 'tl_direct'
          ? 'TL 直接接住并回复'
          : data.routedTo === 'tl_direct_fallback'
            ? '成员续聊不可用，已回退为 TL 直答'
            : data.routedTo === 'member_via_tl'
              ? `TL 已转交给 ${data.targetRole || '成员'}`
              : data.routedTo === 'member'
                ? `${data.targetRole || '成员'} 已直接回复`
                : ''

        updateMessage(pendingReplyId, {
          role: normalizeReplyRole(data.targetRole || pendingRole),
          content: [(data.reply || '（本次线程动作已受理，等待更多回流事件。）'), routeLabel ? `---\n_${routeLabel}_` : ''].filter(Boolean).join('\n\n'),
          status: 'done',
          noCollapse: true,
        }, sessionId)
      } else {
        const errMsg = data.error === 'no_session'
          ? '该任务当前还没有绑定好的执行会话，先回到现场继续派发或等待线程建立。'
          : data.error === 'task_not_found'
            ? '任务不存在，或已经从当前运行面里被清理。'
            : `请求失败：${data.error || '未知错误'}`
        updateMessage(pendingReplyId, {
          role: 'system',
          content: errMsg,
          status: 'error',
          noCollapse: true,
        }, sessionId)
      }
    } catch (err: any) {
      updateMessage(pendingReplyId, {
        role: 'system',
        content: `网络错误：${err?.message || '连接失败'}`,
        status: 'error',
        noCollapse: true,
      }, sessionId)
    } finally {
      setSending(false)
    }
  }, [input, taskId, sending, taskSessionId, getOrCreateTaskChannel, task?.title, addMessage, focusTarget, updateMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  if (!taskId) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center">
          <MessageCircle className="mx-auto mb-2 h-8 w-8 text-[var(--fg-ghost)]" />
          <p className="text-sm text-[var(--fg-muted)]">选择任务后可进入协作对话</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--surface)]" data-testid="task-chat-panel">
      <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--fg)]" data-testid="task-chat-title">
              <MessageCircle className="h-4 w-4 text-[var(--accent)]" /> 协作对话
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">{threadTypeLabel(taskSession)}</span>
            <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">{stateLabel((task?.state || taskSession?.state || 'pending') as any)}</span>
            {taskSession?.phase ? <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">{threadPhaseLabel(taskSession.phase)}</span> : null}
            {taskSession?.owner ? <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">角色：{roleLabel(taskSession.owner)}</span> : null}
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3.5 py-3 text-[12px] leading-6 text-[var(--fg-secondary)]">
          <span className="font-medium text-[var(--fg)]">对话判断：</span>
          {threadPulse}
        </div>

        <div className="mt-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]/95 px-3.5 py-3" data-testid="task-chat-routing">
          <div className="flex flex-wrap gap-1.5">
            <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">路由：{routeMode}</span>
            <span className={`soft-label ${task?.sessionPersistent ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]'}`}>会话：{sessionModeText}</span>
            {task?.actualNode ? <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">节点：{nodeLabel(String(task.actualNode || ''))}</span> : null}
          </div>
          <div className="mt-2 text-[12px] leading-5 text-[var(--fg-secondary)]">{sessionHint}</div>
          {task?.degradedReason ? <div className="mt-2 text-[11px] leading-5 text-[var(--fg-muted)]">改道说明：{degradedReasonLabel(task.degradedReason)}</div> : null}
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <div className="info-tile bg-[var(--surface-subtle)]">
            <div className="text-[10px] text-[var(--fg-ghost)]">协作线程</div>
            <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{threadTypeLabel(taskSession)}</div>
          </div>
          <div className="info-tile bg-[var(--surface-subtle)]">
            <div className="text-[10px] text-[var(--fg-ghost)]">消息沉淀</div>
            <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{taskMessages.length} 条消息 / {artifactSignals} 个交付信号</div>
          </div>
          <div className="info-tile bg-[var(--surface-subtle)]">
            <div className="text-[10px] text-[var(--fg-ghost)]">建议动作</div>
            <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{deliveryReady ? '优先转到交付面' : pendingHumanActions > 0 ? '先处理待人工动作' : '继续在此追问推进'}</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">{taskMessages.length} 条消息</span>
          <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">{activeRoles.length} 个在场角色</span>
          <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">{artifactSignals} 个交付信号</span>
          {pendingHumanActions > 0 ? <span className="soft-label border-[var(--warning)]/20 bg-[var(--warning-soft)] text-[var(--warning)]">待人工动作 {pendingHumanActions}</span> : null}
          {taskSession?.latestDeliverableId ? <span className="soft-label border-[var(--success)]/20 bg-[var(--success-soft)] text-[var(--success)]">最新交付</span> : null}
          {latestMessage ? <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">最新：{formatTime(latestMessage.timestamp)}</span> : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <QuickActionButton label="继续跟进" onClick={() => setInput('/ask tl 请继续跟进当前任务，优先告诉我下一步最该做什么。')} />
          <QuickActionButton label="请求执行" onClick={() => setInput('/ask executor 请继续跟进当前执行单元，并优先回传可验收结果。')} />
          <QuickActionButton label="请求复审" onClick={() => setInput('/ask critic 请针对当前最新结果再审一轮，重点指出还不能收口的地方。')} />
          {onFocusTarget && (
            <>
              <QuickActionButton label="查看交付" onClick={() => onFocusTarget(withFocusOpenTab(focusTarget, 'deliverables'))} />
              <QuickActionButton label="查看文件" onClick={() => onFocusTarget(withFocusOpenTab(focusTarget, 'files'))} />
              <QuickActionButton label="看进展" onClick={() => onFocusTarget(withFocusOpenTab(focusTarget, 'timeline'))} />
            </>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="panel-scroll flex-1 min-h-0 overflow-y-auto p-3 md:p-4">
        {focusTarget && (
          <div className="mb-3 rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent-soft)]/45 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--accent)]">
                  <Route className="h-3.5 w-3.5" /> 当前定位
                </div>
                <div className="mt-1 text-[12px] leading-5 text-[var(--fg-secondary)]">{focusSummaryLabel(focusTarget)}</div>
              </div>
              {onFocusTarget ? (
                <button
                  type="button"
                  onClick={() => onFocusTarget(null)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--fg-secondary)] transition hover:bg-[var(--surface-subtle)]"
                >
                  清除焦点
                </button>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <QuickActionButton label="继续跟进" onClick={() => setInput(buildFocusDraft(focusTarget, 'followup'))} />
              <QuickActionButton label="发起重试" onClick={() => setInput(buildFocusDraft(focusTarget, 'retry'))} />
              <QuickActionButton label="发起重排" onClick={() => setInput(buildFocusDraft(focusTarget, 'replan'))} />
            </div>
          </div>
        )}

        {taskMessages.length === 0 ? (
          <div className="flex h-full min-h-[240px] items-center justify-center">
            <div className="max-w-sm text-center">
              <Users className="mx-auto mb-3 h-6 w-6 text-[var(--fg-ghost)]" />
              <p className="text-[13px] text-[var(--fg-muted)]">对话已经建立，但还没有新的消息。</p>
              <p className="mt-1 text-[11px] text-[var(--fg-ghost)]">可以直接留言，或用上方快捷动作继续跟进。</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {taskMessages.map((msg, idx) => (
              <MessageBubble key={`${msg.id}-${idx}`} msg={msg} onFocusTarget={onFocusTarget} />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="mb-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2 text-[12px] leading-5 text-[var(--fg-secondary)]">
          <span className="font-medium text-[var(--fg)]">调度提示：</span>{inputHint}
        </div>
        <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={suggestedNodeLabel ? `在这里留言，当前建议优先走 ${suggestedNodeLabel}……` : '在这里留言，Enter 发送……'}
            disabled={sending}
            rows={1}
            className="min-h-[38px] max-h-[120px] flex-1 resize-none bg-transparent px-3 py-2 text-[13px] text-[var(--fg)] outline-none placeholder:text-[var(--fg-ghost)] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
