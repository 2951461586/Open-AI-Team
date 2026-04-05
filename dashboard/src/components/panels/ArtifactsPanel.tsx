'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { PackageOpen, FileText, Loader2, Info, Inbox, ChevronDown, ChevronUp, Download, Eye, X, ExternalLink } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArtifactItem, TaskCard, FocusTarget } from '@/lib/types'
import { fetchTaskArtifacts, fetchTaskArtifactFile } from '@/lib/api'
import { formatDateTime, artifactTypeLabel, roleLabel } from '@/lib/utils'
import { focusSummaryLabel, focusAssignmentId, focusChildTaskId, hasTaskFocus, withFocusOpenTab } from '@/lib/task-focus'
import { useTaskStore } from '@/lib/store'
import { PanelEmptyState, PanelErrorState, PanelLoadingState } from '@/components/ui/panel-states'

const markdownComponents = {
  code({ inline, className, children, ...props }: any) {
    return inline ? (
      <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[13px] font-mono text-[var(--fg)]" {...props}>{children}</code>
    ) : (
      <pre className="my-2 max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-[12px] leading-5 [overflow-wrap:anywhere]">
        <code className={className} {...props}>{children}</code>
      </pre>
    )
  },
  table({ children }: any) {
    return <div className="my-2 overflow-x-auto rounded-lg border border-[var(--border)]"><table className="w-full text-sm">{children}</table></div>
  },
  th({ children }: any) {
    return <th className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-left text-xs font-medium text-[var(--fg-secondary)]">{children}</th>
  },
  td({ children }: any) {
    return <td className="border-b border-[var(--border-subtle)] px-3 py-2 text-sm">{children}</td>
  },
  a({ href, children }: any) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline hover:text-[var(--accent)]">{children}</a>
  },
}

// ─── Preview Modal Component ────────────────────────────────────────
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

function translateBodyText(text: string): string {
  if (!text) return text
  let out = text
  const replacements: [string, string][] = [
    ['auto_skip_judge_non_high_risk', '低风险任务自动通过'],
    ['auto_skip_low_risk', '低风险自动跳过'],
    ['judge.auto_skip', '自动裁决'],
    ['critic.auto_skip', '自动评审'],
    ['output_request', '任务完成通知'],
    ['executor_result', '执行结果'],
    ['auto_planner', '自动规划'],
    ['streaming_planner', '流式规划'],
    ['real_planner_agent', '规划师'],
  ]
  for (const [raw, label] of replacements) {
    out = out.replace(new RegExp(raw, 'g'), label)
  }
  return out
}

function safeTextFromBody(body: any): string {
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body)
      return safeTextFromBody(parsed)
    } catch {
      return translateBodyText(body)
    }
  }
  const t = body?.markdown ?? body?.text ?? body?.body ?? body?.summary ?? body?.content ?? body?.reason
  if (typeof t === 'string') return translateBodyText(t)
  if (body && typeof body === 'object') {
    try {
      const keys = Object.keys(body)
      if (keys.length <= 3) {
        const entries = keys.map((k) => `${k}: ${String(body[k]).slice(0, 80)}`).join(' | ')
        return translateBodyText(entries)
      }
    } catch {}
  }
  return ''
}

function isAwaitingExecutor(task: TaskCard | null): boolean {
  return Boolean(task && task.state === 'approved' && task.latestDecisionType === 'approve')
}

export function ArtifactsPanel({
  taskId,
  refreshKey = 0,
  focusTarget = null,
  onFocusTarget,
}: {
  taskId: string | null
  refreshKey?: number
  focusTarget?: FocusTarget | null
  onFocusTarget?: (target: FocusTarget | null) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ArtifactItem[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewTitle, setPreviewTitle] = useState('')
  const [previewContent, setPreviewContent] = useState('')
  const [previewPath, setPreviewPath] = useState('')
  const [previewArtifactId, setPreviewArtifactId] = useState('')
  const [fileLoadingId, setFileLoadingId] = useState('')
  const tasks = useTaskStore((s) => s.tasks)
  const task: TaskCard | null = taskId ? (tasks.find((t) => t.taskId === taskId) || null) : null

  const toggleExpanded = (artifactId: string) => {
    setExpanded((prev) => ({ ...prev, [artifactId]: !prev[artifactId] }))
  }

  const triggerDownload = useCallback((filename: string, content: string, contentType = 'text/plain;charset=utf-8') => {
    const blob = new Blob([content], { type: contentType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }, [])

  const openPreview = useCallback((title: string, content: string, filePath = '', artifactId = '') => {
    setPreviewTitle(title)
    setPreviewContent(content)
    setPreviewPath(filePath)
    setPreviewArtifactId(artifactId)
    setPreviewOpen(true)
  }, [])

  const handleOpenArtifact = useCallback(async (item: ArtifactItem, fallbackContent: string, rawJson: string, fileHint: string) => {
    const title = item.title || artifactTypeLabel(item.artifactType)
    if (!item.artifactId) {
      openPreview(title, rawJson || fallbackContent || '', fileHint)
      return
    }
    try {
      setFileLoadingId(item.artifactId)
      const res = await fetchTaskArtifactFile(item.artifactId)
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data = await res.json()
      const payload = data?.payload || data
      const content = String(payload?.content || rawJson || fallbackContent || '')
      const path = String(payload?.path || payload?.workspacePath || fileHint || '')
      openPreview(title, content, path, item.artifactId)
    } catch {
      openPreview(title, rawJson || fallbackContent || '', fileHint, item.artifactId)
    } finally {
      setFileLoadingId('')
    }
  }, [openPreview])

  const renderArtifactBody = (item: ArtifactItem) => {
    const body = item.body
    const isExpanded = !!expanded[item.artifactId]

    // Prefer readable text for quick scan
    const readable = safeTextFromBody(body)

    // If body is a stringified JSON with big content, show raw in expandable pre
    let rawJson: string | null = null
    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body)
        rawJson = JSON.stringify(parsed, null, 2)
      } catch {
        rawJson = body
      }
    } else if (body && typeof body === 'object') {
      try {
        rawJson = JSON.stringify(body, null, 2)
      } catch {
        rawJson = null
      }
    }

    const preview = readable || ''
    const hasRaw = Boolean(rawJson && rawJson.trim())

    // Heuristics to show file path if present
    const fileHint = (() => {
      const anyBody: any = body
      const p = anyBody?.workspaceRelativePath || anyBody?.workspacePath || anyBody?.path || anyBody?.refId
      return typeof p === 'string' && p.trim() ? p.trim() : ''
    })()

    return {
      isExpanded,
      hasRaw,
      preview,
      rawJson: rawJson || '',
      fileHint,
    }
  }

  useEffect(() => {
    let alive = true
    const run = async () => {
      if (!taskId) {
        setItems([])
        return
      }
      setLoading(true)
      setError(null)
      try {
        const res = await fetchTaskArtifacts(taskId, 200)
        if (!res.ok) throw new Error(`API error: ${res.status}`)
        const data = await res.json()
        const list = Array.isArray(data?.items) ? data.items : []
        list.sort((a: ArtifactItem, b: ArtifactItem) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
        if (alive) setItems(list)
      } catch (e: any) {
        if (alive) setError(e?.message || '加载失败')
      } finally {
        if (alive) setLoading(false)
      }
    }
    run()
    return () => { alive = false }
  }, [taskId, refreshKey])

  const waitingExecutor = isAwaitingExecutor(task)
  const currentFocusChildTaskId = focusChildTaskId(focusTarget as Record<string, any>)
  const currentFocusAssignmentId = focusAssignmentId(focusTarget as Record<string, any>)
  const filteredItems = useMemo(() => {
    if (!currentFocusChildTaskId && !currentFocusAssignmentId) return items
    return items.filter((i) => {
      const metaChildTaskId = focusChildTaskId(i.metadata as Record<string, any>)
      const metaAssignmentId = focusAssignmentId(i.metadata as Record<string, any>)
      const refId = String(i.refId || '').trim()
      if (currentFocusChildTaskId && metaChildTaskId === currentFocusChildTaskId) return true
      if (currentFocusAssignmentId && (metaAssignmentId === currentFocusAssignmentId || refId === currentFocusAssignmentId)) return true
      return false
    })
  }, [items, currentFocusAssignmentId, currentFocusChildTaskId])
  const visibleDeliverables = filteredItems.filter((i) => String(i.artifactType) === 'deliverable')
  const processItems = filteredItems.filter((i) => String(i.artifactType) !== 'deliverable')
  const closurePulse = waitingExecutor
    ? '这条线已经具备交付条件，但最终结果还在执行链上生成。'
    : visibleDeliverables.length > 0
      ? '这条线已经形成可读交付，可以直接进入验收。'
      : processItems.length > 0
        ? '这条线已经留下过程记录，但最终交付还没完全成形。'
        : '这条线暂时还没有沉淀出可读结果。'

  const sections = [
    { key: 'deliverable', label: waitingExecutor ? '最终交付（生成中）' : '最终交付', icon: PackageOpen, data: visibleDeliverables },
    { key: 'plan', label: '过程记录', icon: FileText, data: processItems },
  ]

  return (
    <>
      <PreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={previewTitle}
        content={previewContent}
        filePath={previewPath || undefined}
        onDownload={previewContent ? () => triggerDownload((previewPath.split('/').pop() || `${previewArtifactId || 'artifact'}.txt`), previewContent) : undefined}
      />
      <div className="flex h-full min-h-0 flex-col bg-[var(--surface)]">
      <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
        <div className="text-sm font-semibold text-[var(--fg)]">交付</div>
        <div className="mt-1 text-[12px] leading-5 text-[var(--fg-muted)]">优先看最终结果，再看关键过程和相关对象。</div>
        {hasTaskFocus(focusTarget as Record<string, any>) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--fg-ghost)]">
            <span>{focusSummaryLabel(focusTarget)}</span>
            {focusTarget?.replanCreatedAt ? <span>· {formatDateTime(focusTarget.replanCreatedAt)}</span> : null}
            {onFocusTarget && (
              <button
                type="button"
                onClick={() => onFocusTarget(withFocusOpenTab(focusTarget, 'timeline'))}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--fg-secondary)] transition hover:bg-[var(--surface-muted)]"
              >
                返回进展
              </button>
            )}
          </div>
        )}
        
      </div>
      <div className="panel-scroll flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-4 p-4 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] md:pb-4">
          {!taskId && <PanelEmptyState icon={PackageOpen} title="请先选择任务" body="从任务台选择一个任务，再查看它的产物与过程。" />}
          {taskId && loading && <PanelLoadingState text="正在加载交付结果…" />}
          {taskId && error && <PanelErrorState text={error} />}
          {taskId && !loading && !error && (
            <>
              {task && (
                <div className="surface-card p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--fg)]">
                    <Info className="h-4 w-4 text-[var(--accent)]" /> 交付概览
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 text-[10px] text-[var(--fg-muted)]">{task.artifactCount} 份内容</span>
                    {task.issueCount > 0 && <span className="rounded-full bg-[var(--warning-soft)] px-2.5 py-1 text-[10px] text-[var(--warning)]">{task.issueCount} 个提醒</span>}
                    {task.deliverableReady && <span className="rounded-full bg-[var(--success-soft)] px-2.5 py-1 text-[10px] text-[var(--success)]">已可交付</span>}
                  </div>
                  <div className="mt-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]/95 p-3 text-[12px] leading-5 text-[var(--fg-secondary)]">
                    <span className="font-medium text-[var(--fg)]">收口判断：</span>
                    {closurePulse}
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <div className="info-tile bg-[var(--surface-subtle)]">
                      <div className="text-[10px] text-[var(--fg-ghost)]">交付窗口</div>
                      <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{visibleDeliverables.length > 0 ? `${visibleDeliverables.length} 份结果待验收` : waitingExecutor ? '结果生成中' : '暂未形成最终交付'}</div>
                    </div>
                    <div className="info-tile bg-[var(--surface-subtle)]">
                      <div className="text-[10px] text-[var(--fg-ghost)]">过程沉淀</div>
                      <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{processItems.length > 0 ? `${processItems.length} 条过程记录` : '暂无额外过程记录'}</div>
                    </div>
                    <div className="info-tile bg-[var(--surface-subtle)]">
                      <div className="text-[10px] text-[var(--fg-ghost)]">当前建议</div>
                      <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{visibleDeliverables.length > 0 ? '优先做验收与导出' : waitingExecutor ? '先等执行链回传结果' : '继续观察推进并等待交付形成'}</div>
                    </div>
                  </div>
                  {(task.executiveSummary || task.planSummary) && (
                    <div className="mt-3 rounded-lg bg-[var(--surface-subtle)] p-3 text-[12px] leading-5 text-[var(--fg-secondary)]">
                      {task.executiveSummary || task.planSummary}
                    </div>
                  )}
                </div>
              )}

              {sections.map((section) => {
                const Icon = section.icon
                const emptyTitle = section.key === 'deliverable'
                  ? (waitingExecutor ? '等待最终交付' : '暂无交付结果')
                  : '暂无过程记录'
                const emptyBody = section.key === 'deliverable'
                  ? (waitingExecutor ? '执行完成后，这里会出现真正的交付结果。' : '任务推进后会在这里展示交付内容。')
                  : '后续的计划、评审或执行信息会显示在这里。'
                return (
                  <section key={section.key} className="surface-card p-4 md:p-5">
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--fg)]">
                      <Icon className="h-4 w-4 text-[var(--accent)]" />
                      {section.label}
                    </div>
                    <div className="mt-1 text-[12px] leading-5 text-[var(--fg-muted)]">
                      {section.key === 'deliverable' ? '先看最终可验收结果，再决定是否导出或回看相关对象。' : '这里保留计划、评审、裁决和执行沉淀，便于回溯过程。'}
                    </div>
                    <div className="mt-3 space-y-3">
                      {section.data.length === 0 ? (
                        <div className="py-2">
                          <PanelEmptyState
                            icon={Inbox}
                            title={emptyTitle}
                            body={emptyBody}
                          />
                        </div>
                      ) : (
                        section.data.map((item) => {
                          const rawBodyText = safeTextFromBody(item.body)

                          const view = renderArtifactBody(item)
                          const showExpand = view.hasRaw && view.rawJson.length > 260

                          const bodyPreview = rawBodyText || view.preview
                          const markdownPreview = String((item.body && typeof item.body === 'object' ? item.body.markdown : '') || bodyPreview || '').trim()

                          const isExecutorArtifact = String(item.role || '').toLowerCase() === 'executor'
                          const executorModeLabel = isExecutorArtifact
                            ? (view.fileHint || ['report', 'file', 'executor_artifact', 'executor_result'].includes(String(item.artifactType || '').toLowerCase()) ? '执行产物' : '')
                            : ''

                          const matchesFocusedArtifact = Boolean(
                            (currentFocusChildTaskId && focusChildTaskId(item.metadata as Record<string, any>) === currentFocusChildTaskId)
                            || (currentFocusAssignmentId && (
                              focusAssignmentId(item.metadata as Record<string, any>) === currentFocusAssignmentId
                              || String(item.refId || '').trim() === currentFocusAssignmentId
                            ))
                          )

                          return (
                            <div key={item.artifactId} className={`rounded-xl border p-3 ${matchesFocusedArtifact ? 'border-[var(--accent)] bg-[var(--accent-soft)]/35' : 'border-[var(--border)] bg-[var(--surface-subtle)]'}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="break-words text-sm font-medium text-[var(--fg)]">
                                    {item.title || artifactTypeLabel(item.artifactType)}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--fg-muted)]">
                                    <span>{formatDateTime(item.updatedAt)}</span>
                                    {item.role && <span>角色：{roleLabel(item.role)}</span>}
                                    {matchesFocusedArtifact && <span className="soft-label border-[var(--accent)]/25 bg-[var(--accent-soft)] text-[var(--accent)]">当前焦点</span>}
                                  </div>
                                  {view.fileHint && (
                                    <div className="mt-1 break-all text-[11px] text-[var(--fg-ghost)]">
                                      路径：{view.fileHint}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  <span className="shrink-0 soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">
                                    {artifactTypeLabel(item.artifactType)}
                                  </span>
                                  {executorModeLabel && (
                                    <span className="shrink-0 soft-label border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]">
                                      {executorModeLabel}
                                    </span>
                                  )}
                                  <button
                                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--fg-secondary)]"
                                    onClick={() => handleOpenArtifact(item, markdownPreview || bodyPreview || '', view.rawJson || markdownPreview || bodyPreview || '', view.fileHint || '')}
                                    type="button"
                                    disabled={fileLoadingId === item.artifactId}
                                  >
                                    {fileLoadingId === item.artifactId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (view.fileHint ? <ExternalLink className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />)}
                                    {view.fileHint ? '打开文件' : '预览'}
                                  </button>
                                  <button
                                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--fg-secondary)]"
                                    onClick={() => triggerDownload((view.fileHint?.split('/').pop() || `${item.artifactId || 'artifact'}.md`), markdownPreview || view.rawJson || bodyPreview || '')}
                                    type="button"
                                  >
                                    <Download className="h-3.5 w-3.5" />下载
                                  </button>
                                  {showExpand && (
                                    <button
                                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--fg-secondary)]"
                                      onClick={() => toggleExpanded(item.artifactId)}
                                      type="button"
                                    >
                                      {view.isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                      {view.isExpanded ? '收起' : '展开'}
                                    </button>
                                  )}
                                  {matchesFocusedArtifact && onFocusTarget && (
                                    <button
                                      className="inline-flex items-center gap-1 rounded-md border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-2 py-1 text-[11px] text-[var(--accent)]"
                                      onClick={() => onFocusTarget(withFocusOpenTab(focusTarget, 'timeline'))}
                                      type="button"
                                    >
                                      回到这次重排
                                    </button>
                                  )}
                                </div>
                              </div>

                              {markdownPreview && !view.isExpanded && (
                                <div className="prose prose-sm mt-2 max-w-none overflow-hidden break-words text-[12px] leading-5 [overflow-wrap:anywhere]">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                    {markdownPreview}
                                  </ReactMarkdown>
                                </div>
                              )}

                              {view.isExpanded && view.rawJson && (
                                <pre className="mt-2 max-h-[420px] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-[11px] leading-5 text-[var(--fg-secondary)]">
                                  {view.rawJson}
                                </pre>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </section>
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
