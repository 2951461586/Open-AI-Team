'use client'

import { useEffect, useRef, useState, memo, useMemo } from 'react'
import { Loader2, Send, Bot, User, Brain, Shield, Scale, AlertTriangle, PackageOpen, FileText, GitBranch, CheckSquare, Download, Eye, X } from 'lucide-react'
import { ChatMessage, ChatRole, ChatTransportStatus, NodeSummary } from '@/lib/types'
import { formatExactTime, nodeLabel, roleLabel } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import { useTaskStore } from '@/lib/store'
import remarkGfm from 'remark-gfm'

// ─── Artifact type config ───────────────────────────────────────────

const artifactTypeConfig: Record<string, { label: string; icon: typeof PackageOpen; style: string }> = {
  deliverable:       { label: '产物', icon: PackageOpen, style: 'border-[var(--success)] bg-[var(--success)]/10 text-[var(--success)]' },
  output_request:    { label: '输出请求', icon: PackageOpen, style: 'border-[var(--success)] bg-[var(--success)]/10 text-[var(--success)]' },
  executor_artifact: { label: '执行产物', icon: PackageOpen, style: 'border-[var(--success)] bg-[var(--success)]/10 text-[var(--success)]' },
  plan:              { label: '计划', icon: FileText, style: 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' },
  review:            { label: '评审', icon: CheckSquare, style: 'border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]' },
  decision:          { label: '裁决', icon: Scale, style: 'border-[var(--node-violet)] bg-[var(--node-violet)]/10 text-[var(--node-violet)]' },
  code:              { label: '代码', icon: GitBranch, style: 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' },
  documentation:     { label: '文档', icon: FileText, style: 'border-[var(--fg-muted)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]' },
}

// ─── Role config ────────────────────────────────────────────────────

const roleConfig: Record<ChatRole, { label: string; icon: typeof Bot; style: string; avatarBg: string }> = {
  user:      { label: '你',       icon: User,          style: 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]',       avatarBg: 'bg-[var(--fg-muted)]' },
  assistant: { label: '助理',     icon: Bot,           style: 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]',               avatarBg: 'bg-[var(--accent)]' },
  planner:   { label: '规划师',   icon: Brain,         style: 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]',               avatarBg: 'bg-[var(--accent)]' },
  critic:    { label: '评审官',   icon: Shield,        style: 'border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]',             avatarBg: 'bg-[var(--warning)]' },
  judge:     { label: '裁决官',   icon: Scale,         style: 'border-[var(--node-violet)] bg-[var(--node-violet)]/10 text-[var(--node-violet)]',   avatarBg: 'bg-[var(--node-violet)]' },
  executor:  { label: '执行者',   icon: Bot,           style: 'border-[var(--success)] bg-[var(--success)]/10 text-[var(--success)]',               avatarBg: 'bg-[var(--success)]' },
  output:    { label: '交付',     icon: PackageOpen,   style: 'border-[var(--success)] bg-[var(--success)]/10 text-[var(--success)]',               avatarBg: 'bg-[var(--success)]' },
  system:    { label: '系统',     icon: AlertTriangle, style: 'border-[var(--border)] bg-[var(--overlay-light)] text-[var(--fg-secondary)]',        avatarBg: 'bg-[var(--fg-ghost)]' },
}

const nodeStyleMap: Record<string, string> = {
  laoda: 'bg-[var(--node-laoda)]', violet: 'bg-[var(--node-violet)]', lebang: 'bg-[var(--success)]',
}

function buildRoleNodeMap(nodes: NodeSummary[]) {
  const map: Record<string, string> = {}
  for (const node of nodes || []) {
    for (const role of node.preferredRoles || []) {
      if (!map[role]) map[role] = node.label || nodeLabel(node.key)
    }
  }
  return map
}

function parseTargetHint(text: string) {
  const trimmed = String(text || '').trim()
  const match = trimmed.match(/^\/ask\s+(\S+)/i)
  return match ? String(match[1] || '').toLowerCase() : ''
}

// ─── Sub-components ─────────────────────────────────────────────────

function RoleAvatar({ role }: { role: ChatRole }) {
  const config = roleConfig[role] || roleConfig.system
  const Icon = config.icon
  return (
    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${config.avatarBg} text-white`}>
      <Icon size={14} />
    </div>
  )
}

function NodePill({ node }: { node?: string }) {
  if (!node) return null
  const key = node.toLowerCase()
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--fg-muted)]">
      <span className={`h-1.5 w-1.5 rounded-full ${nodeStyleMap[key] || 'bg-[var(--fg-ghost)]'}`} />
      {key}
    </span>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--border-strong)] animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--border-strong)] animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--border-strong)] animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  )
}

function triggerDownload(filename: string, content: string) {
  if (typeof window === 'undefined') return
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename || 'artifact.txt'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function PreviewModal({ isOpen, onClose, title, content, filePath, onDownload }: {
  isOpen: boolean
  onClose: () => void
  title: string
  content: string
  filePath?: string
  onDownload?: () => void
}) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="m-4 max-h-[80vh] w-full max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-[var(--accent)]" />
            <span className="font-semibold text-[var(--fg)]">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            {onDownload && (
              <button
                onClick={onDownload}
                className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent)]/90"
              >
                <Download className="h-3.5 w-3.5" /> 下载
              </button>
            )}
            <button onClick={onClose} className="rounded-md p-1.5 hover:bg-[var(--surface-subtle)]">
              <X className="h-4 w-4 text-[var(--fg-muted)]" />
            </button>
          </div>
        </div>
        <div className="max-h-[calc(80vh-60px)] overflow-auto p-4">
          <div className="prose prose-sm max-w-none overflow-hidden break-words [overflow-wrap:anywhere]">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {content}
            </ReactMarkdown>
          </div>
        </div>
        {filePath && (
          <div className="border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--fg-ghost)]">
            文件路径：{filePath}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Artifact card (embedded in chat) ───────────────────────────────

function ArtifactCard({ msg }: { msg: ChatMessage }) {
  const typeKey = String(msg.artifactType || '').toLowerCase()
  const cfg = artifactTypeConfig[typeKey] || artifactTypeConfig.deliverable
  const Icon = cfg.icon
  const [previewOpen, setPreviewOpen] = useState(false)

  // Extract summary from content — first paragraph or first 200 chars
  const raw = msg.content || ''
  const firstPara = raw.split(/\n{2,}/)[0] || raw.slice(0, 200)
  const downloadText = String(msg.artifactDownloadText || raw || '')
  const downloadName = String(msg.artifactDownloadName || msg.artifactTitle || 'artifact.md')

  return (
    <>
      <div className="animate-fade-in my-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex items-start gap-2">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.style}`}>
            <Icon size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`soft-label text-[10px] ${cfg.style}`}>{cfg.label}</span>
              <span className="truncate text-xs font-medium text-[var(--fg)]">{msg.artifactTitle || firstPara.slice(0, 60)}</span>
            </div>
            {raw.length > 10 && (
              <div className="mt-1.5 whitespace-pre-wrap break-words text-[12px] leading-5 text-[var(--fg-muted)] [overflow-wrap:anywhere] line-clamp-4">
                {firstPara.slice(0, 200)}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1 text-[11px] text-[var(--fg-secondary)] hover:bg-[var(--overlay-light)]"
              >
                <Eye className="h-3.5 w-3.5" /> 预览
              </button>
              {downloadText && (
                <button
                  type="button"
                  onClick={() => triggerDownload(downloadName, downloadText)}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1 text-[11px] text-[var(--fg-secondary)] hover:bg-[var(--overlay-light)]"
                >
                  <Download className="h-3.5 w-3.5" /> 下载
                </button>
              )}
              <span className="text-[10px] text-[var(--fg-ghost)]">{formatExactTime(msg.timestamp)}</span>
            </div>
          </div>
        </div>
      </div>
      <PreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={msg.artifactTitle || firstPara.slice(0, 60) || '产物预览'}
        content={downloadText || raw}
        filePath={msg.artifactFilePath}
        onDownload={downloadText ? () => triggerDownload(downloadName, downloadText) : undefined}
      />
    </>
  )
}

// ─── Stage collapse helper ──────────────────────────────────────────
// When consecutive messages share the same role + taskId within 3s,
// only the latest message is shown; earlier ones become a collapsed strip.

function buildCollapsedMessages(messages: ChatMessage[]): { msg: ChatMessage; collapsed: number }[] {
  const result: { msg: ChatMessage; collapsed: number }[] = []
  if (!messages.length) return result

  let group: ChatMessage[] = [messages[0]]
  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1]
    const cur = messages[i]
    const sameRole = prev.role === cur.role
    const sameTask = prev.taskId === cur.taskId
    const closeTime = Math.abs(cur.timestamp - prev.timestamp) < 3000

    // Never collapse user messages, artifact messages, or noCollapse messages.
    // Also avoid collapsing meaningful stage messages: planner/critic/judge/executor/output should usually stay visible.
    const isSystemLike = (r: string) => ['system', 'assistant'].includes(String(r || '').toLowerCase())
    const isCollapseSafe =
      prev.role !== 'user' &&
      !prev.artifactId &&
      !prev.noCollapse &&
      !cur.artifactId &&
      !cur.noCollapse &&
      isSystemLike(prev.role) &&
      isSystemLike(cur.role)

    if (sameRole && sameTask && closeTime && isCollapseSafe) {
      group.push(cur)
    } else {
      // Flush group: keep last message, mark earlier as collapsed
      if (group.length > 1) {
        result.push({ msg: group[group.length - 1], collapsed: group.length - 1 })
      } else {
        result.push({ msg: group[0], collapsed: 0 })
      }
      group = [cur]
    }
  }
  // Flush last group
  if (group.length > 1) {
    result.push({ msg: group[group.length - 1], collapsed: group.length - 1 })
  } else {
    result.push({ msg: group[0], collapsed: 0 })
  }
  return result
}

// ─── Collapsed strip indicator ──────────────────────────────────────

function CollapsedStrip({ count, role }: { count: number; role: string }) {
  const roleLabels: Record<string, string> = {
    planner: '规划师', critic: '评审官', judge: '裁决官', executor: '执行者', system: '系统',
  }
  const label = roleLabels[role] || role
  return (
    <div className="flex items-center justify-center py-0.5">
      <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-0.5 text-[10px] text-[var(--fg-ghost)]">
        {label} · 已折叠 {count} 条旧状态
      </span>
    </div>
  )
}

// ─── Markdown with code highlighting ────────────────────────────────

const markdownComponents = {
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '')
    const code = String(children).replace(/\n$/, '')

    if (!inline && match) {
      return (
        <div className="my-2 rounded-lg overflow-hidden border border-[var(--border)]">
          <div className="flex items-center justify-between bg-[var(--surface-muted)] px-3 py-1.5 text-[11px] text-[var(--fg-muted)]">
            <span>{match[1]}</span>
            <button
              onClick={() => navigator.clipboard?.writeText(code)}
              className="hover:text-[var(--fg-secondary)] transition"
            >复制</button>
          </div>
          <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words bg-[var(--surface-subtle)] p-3 text-[13px] leading-5 [overflow-wrap:anywhere]">
            <code className={className} {...props}>{children}</code>
          </pre>
        </div>
      )
    }

    return (
      <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[13px] font-mono text-[var(--fg)]" {...props}>
        {children}
      </code>
    )
  },
  table({ children }: any) {
    return (
      <div className="my-2 overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">{children}</table>
      </div>
    )
  },
  th({ children }: any) {
    return <th className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-left text-xs font-medium text-[var(--fg-secondary)]">{children}</th>
  },
  td({ children }: any) {
    return <td className="border-b border-[var(--border-subtle)] px-3 py-2 text-sm">{children}</td>
  },
  blockquote({ children }: any) {
    return <blockquote className="my-2 border-l-3 border-[var(--accent)] pl-3 text-[var(--fg-secondary)] italic">{children}</blockquote>
  },
  a({ href, children }: any) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline hover:text-[var(--accent)]">{children}</a>
  },
}

// ─── Message bubble ─────────────────────────────────────────────────

function MessageBubbleBase({ msg }: { msg: ChatMessage }) {
  // Artifact messages render as embedded cards, not full bubbles
  if (msg.artifactId) {
    return <ArtifactCard msg={msg} />
  }

  const config = roleConfig[msg.role] || roleConfig.system
  const isUser = msg.role === 'user'

  return (
    <div className={`animate-fade-in flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <RoleAvatar role={msg.role} />

      <div className={`flex-1 min-w-0 ${isUser ? 'flex justify-end' : ''}`}>
        <div className={`mb-1 flex items-center gap-2 ${isUser ? 'justify-end' : ''}`}>
          <span className={`soft-label ${config.style}`}>{config.label}</span>
          <NodePill node={msg.node} />
          <span className="text-[11px] text-[var(--fg-ghost)]">{formatExactTime(msg.timestamp)}</span>
          {msg.status === 'pending' && <Loader2 className="h-3 w-3 animate-spin text-[var(--accent)]" />}
          {msg.status === 'error' && <span className="text-[11px] text-[var(--danger)]">发送失败</span>}
        </div>

        <div className={`min-w-0 max-w-full overflow-hidden rounded-xl border px-4 py-3 ${isUser ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)] bg-[var(--surface)]'}`}>
          {(msg.status === 'pending' && !msg.content) || msg.streaming ? (
            <div className="flex min-w-0 items-start gap-2 overflow-hidden">
              <TypingIndicator />
              {msg.content && (
                <div className={`prose prose-sm min-w-0 max-w-none overflow-hidden break-words [overflow-wrap:anywhere] ${isUser ? 'prose-invert' : ''}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          ) : (
            <div className={`prose prose-sm max-w-none overflow-hidden break-words [overflow-wrap:anywhere] ${isUser ? 'prose-invert' : ''}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {msg.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const MessageBubble = memo(MessageBubbleBase)

// ─── Main panel ─────────────────────────────────────────────────────

interface ChatPanelProps {
  messages: ChatMessage[]
  onSendMessage: (message: string) => void
  isLoading?: boolean
  connected?: boolean
  thinking?: boolean
  transportStatus?: ChatTransportStatus
  showHeader?: boolean
}

function transportMeta(status: ChatTransportStatus, connected?: boolean) {
  if (connected || status === 'realtime') return { label: '实时连接', dot: 'bg-[var(--success)]', tone: 'text-[var(--success)]' }
  if (status === 'fallback_native') return { label: '自动接管', dot: 'bg-[var(--warning)]', tone: 'text-[var(--warning)]' }
  if (status === 'fallback_template') return { label: '模板响应', dot: 'bg-[var(--danger)]', tone: 'text-[var(--danger)]' }
  if (status === 'fallback') return { label: '备用路径', dot: 'bg-[var(--warning)]', tone: 'text-[var(--warning)]' }
  if (status === 'reconnecting' || status === 'connecting') return { label: '重连中', dot: 'bg-[var(--accent)]', tone: 'text-[var(--accent)]' }
  return { label: '离线', dot: 'bg-[var(--danger)]', tone: 'text-[var(--danger)]' }
}

const collaborationRoles: ChatRole[] = ['planner', 'critic', 'judge', 'executor', 'output']

export function ChatPanel({ messages, onSendMessage, isLoading, connected, thinking, transportStatus = connected ? 'realtime' : 'offline', showHeader = true }: ChatPanelProps) {
  const { nodes } = useTaskStore()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const roleNodeMap = useMemo(() => buildRoleNodeMap(nodes), [nodes])
  const draftTarget = useMemo(() => parseTargetHint(input), [input])
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
      ? `当前新任务默认优先看 ${recommendedNodeLabel}。${roleRouteSummary ? ` 角色落点：${roleRouteSummary}` : ''}`
      : roleRouteSummary || '团队会按当前调度策略自动选择更合适的节点。'

  // Stage collapsing: consecutive same-role messages within 3s get collapsed
  const collapsed = useMemo(() => buildCollapsedMessages(messages), [messages])
  const transport = useMemo(() => transportMeta(transportStatus, connected), [transportStatus, connected])
  const activeRoles = useMemo(() => {
    const seen = new Set<string>()
    for (const msg of messages) {
      const role = String(msg.role || '')
      if (collaborationRoles.includes(role as ChatRole)) seen.add(role)
    }
    return Array.from(seen)
  }, [messages])
  const artifactMessageCount = useMemo(() => messages.filter((msg) => Boolean(msg.artifactId)).length, [messages])
  const roleMessageCounts = useMemo(() => {
    const counts: Partial<Record<ChatRole, number>> = {}
    for (const msg of messages) {
      if (collaborationRoles.includes(msg.role)) counts[msg.role] = (counts[msg.role] || 0) + 1
    }
    return counts
  }, [messages])
  const latestAgentMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (collaborationRoles.includes(messages[i].role)) return messages[i]
    }
    return null
  }, [messages])
  const executorMessageCount = Number(roleMessageCounts.executor || 0)
  const outputMessageCount = Number(roleMessageCounts.output || 0)
  const channelPulse = latestAgentMessage
    ? `${roleConfig[latestAgentMessage.role]?.label || latestAgentMessage.role} · ${formatExactTime(latestAgentMessage.timestamp)}`
    : '等待新消息'

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 160
    if (nearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, thinking])

  const submit = () => {
    if (!input.trim() || isLoading) return
    onSendMessage(input.trim())
    setInput('')
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[var(--surface)]">
      {showHeader && (
        <div className="border-b border-[var(--border)] px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
                <span className="text-sm font-semibold text-[var(--fg)]">会话</span>
                <span>·</span>
                <span className="truncate">{channelPulse}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">
                  {messages.length} 条消息
                </span>
                <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">
                  {Math.max(outputMessageCount, artifactMessageCount)} 个交付信号
                </span>
                {activeRoles.length > 0 && (
                  <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">
                    {activeRoles.map((role) => roleConfig[role as ChatRole]?.label || role).join('、')}
                  </span>
                )}
              </div>
            </div>
            <div className={`inline-flex shrink-0 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs ${transport.tone}`}>
              <span className={`h-2 w-2 rounded-full ${transport.dot}`} />
              {transport.label}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} className="panel-scroll flex-1 min-h-0 space-y-4 overflow-y-auto px-4 py-4">
        {collapsed.length === 0 ? (
          <div className="flex h-full min-h-[260px] items-center justify-center">
            <div className="max-w-sm text-center">
              <div className="mx-auto h-12 w-12 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] flex items-center justify-center">
                <Bot className="h-6 w-6 text-[var(--fg-ghost)]" />
              </div>
              <p className="mt-4 text-sm text-[var(--fg-muted)]">团队还没开始发言。你可以抛出一个任务，或者直接点名角色开工。</p>
            </div>
          </div>
        ) : (
          collapsed.map((item, idx) => (
            <div key={item.msg.id + '-' + idx}>
              {item.collapsed > 0 && <CollapsedStrip count={item.collapsed} role={item.msg.role} />}
              <MessageBubble msg={item.msg} />
            </div>
          ))
        )}
        {thinking && (
          <div className="flex items-start gap-3 animate-fade-in">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
              <Bot size={14} />
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[var(--fg-muted)]">团队正在组织回复</span>
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); submit() }}
        className="border-t border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <div className="mb-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2 text-[12px] leading-5 text-[var(--fg-secondary)]">
          <span className="font-medium text-[var(--fg)]">调度提示：</span>{inputHint}
        </div>
        <div className="flex items-end gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={1}
            disabled={isLoading}
            placeholder={suggestedNodeLabel ? `给团队留条消息，当前建议优先走 ${suggestedNodeLabel}` : '给团队留条消息，Enter 发送'}
            enterKeyHint="send"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
            }}
            className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-base md:text-sm text-[var(--fg)] outline-none placeholder:text-[var(--fg-ghost)]"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent)] text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--border-strong)]"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  )
}
