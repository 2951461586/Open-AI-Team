'use client'

import { useEffect, useState } from 'react'
import { FolderOpen, File, Loader2 } from 'lucide-react'
import { fetchTaskFiles } from '@/lib/api'
import { FocusTarget, TaskCard as TaskCardType } from '@/lib/types'
import { nodeLabel, routeModeLabel, sessionModeLabel, sessionCapabilityHint, rawPathLabel } from '@/lib/utils'
import { focusChildTaskId, focusSummaryLabel, hasTaskFocus, withFocusOpenTab } from '@/lib/task-focus'
import { PanelEmptyState, PanelErrorState, PanelLoadingState } from '@/components/ui/panel-states'

interface FileInfo {
  name: string
  size?: number
  mtime?: number
}

interface Props {
  taskId: string | null
  task?: TaskCardType | null
  focusTarget?: FocusTarget | null
  onFocusTarget?: (target: FocusTarget | null) => void
}

function formatSize(bytes?: number): string {
  if (bytes == null) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(ts?: number): string {
  if (!ts) return '--'
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function TaskFilesPanel({ taskId, task = null, focusTarget, onFocusTarget }: Props) {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [workspace, setWorkspace] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveTaskId = focusChildTaskId(focusTarget as Record<string, any>) || taskId
  const routeMode = routeModeLabel({ requestedNode: task?.requestedNode, actualNode: task?.actualNode, degradedReason: task?.degradedReason })
  const sessionModeText = sessionModeLabel({ sessionMode: task?.sessionMode, sessionPersistent: task?.sessionPersistent })
  const sessionHint = sessionCapabilityHint({ sessionMode: task?.sessionMode, sessionPersistent: task?.sessionPersistent, sessionFallbackReason: task?.sessionFallbackReason })

  useEffect(() => {
    if (!effectiveTaskId) {
      setFiles([])
      setWorkspace('')
      return
    }

    let alive = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetchTaskFiles(effectiveTaskId)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!alive) return
        setFiles(data.files || [])
        setWorkspace(data.workspace || '')
      } catch (e: any) {
        if (alive) setError(e?.message || '加载失败')
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    const timer = setInterval(load, 30000)
    return () => { alive = false; clearInterval(timer) }
  }, [effectiveTaskId])

  if (!effectiveTaskId) {
    return <PanelEmptyState icon={FolderOpen} title="选择任务后可查看文件沉淀" body="这里会展示工作区沉淀下来的文件沉淀产物。" />
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="task-files-panel">
      <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
        <div className="text-sm font-semibold text-[var(--fg)]" data-testid="task-files-title">文件沉淀</div>
        <div className="mt-1 text-[12px] leading-5 text-[var(--fg-muted)]">优先看工作区沉淀，再判断是否形成可复查文件沉淀结果。</div>
        {hasTaskFocus(focusTarget as Record<string, any>) && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--fg-muted)]">
            <span>{focusSummaryLabel(focusTarget)}</span>
            {focusTarget?.replanCreatedAt ? <span>· {formatTime(focusTarget.replanCreatedAt)}</span> : null}
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
        {workspace && (
          <div className="mt-1 truncate text-[11px] text-[var(--fg-ghost)]">{rawPathLabel(workspace)}</div>
        )}
        <div className="mt-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2.5" data-testid="task-files-routing">
          <div className="flex flex-wrap gap-1.5">
            <span className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">路由：{routeMode}</span>
            <span className={`soft-label ${task?.sessionPersistent ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]'}`}>会话：{sessionModeText}</span>
            {task?.actualNode ? <span className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">节点：{nodeLabel(String(task.actualNode || ''))}</span> : null}
          </div>
          <div className="mt-2 text-[11px] leading-5 text-[var(--fg-muted)]">{sessionHint}</div>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <div className="info-tile bg-[var(--surface-subtle)]">
            <div className="text-[10px] text-[var(--fg-ghost)]">工作区</div>
            <div className="mt-1 truncate text-[12px] font-medium text-[var(--fg)]">{rawPathLabel(workspace) || '等待工作区挂载'}</div>
          </div>
          <div className="info-tile bg-[var(--surface-subtle)]">
            <div className="text-[10px] text-[var(--fg-ghost)]">文件沉淀数量</div>
            <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{files.length} 个</div>
          </div>
          <div className="info-tile bg-[var(--surface-subtle)]">
            <div className="text-[10px] text-[var(--fg-ghost)]">文件沉淀判断</div>
            <div className="mt-1 text-[12px] font-medium text-[var(--fg)]">{files.length > 0 ? '已有可检查文件沉淀沉淀' : '当前还没有可见文件沉淀产物'}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {loading && files.length === 0 && <PanelLoadingState text="正在加载文件沉淀列表…" />}

        {error && <PanelErrorState text={error} />}

        {!loading && !error && files.length === 0 && (
          <PanelEmptyState
            icon={FolderOpen}
            title="当前还没有文件沉淀"
            body="后续文件沉淀产出会显示在这里。"
          />
        )}

        {files.length > 0 && (
          <div className="space-y-1.5">
            {files.map(f => (
              <div key={f.name} className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2.5">
                <File className="h-4 w-4 shrink-0 text-[var(--fg-ghost)]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-[var(--fg)]">{f.name}</div>
                  <div className="mt-0.5 text-[11px] text-[var(--fg-muted)]">
                    {formatSize(f.size)} · {formatTime(f.mtime)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
