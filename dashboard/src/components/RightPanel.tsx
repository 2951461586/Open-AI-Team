'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Sparkles, ClipboardList, PackageOpen, MessageCircle, FolderOpen } from 'lucide-react'
import { MissionControlPanel } from './panels/MissionControlPanel'
import { WorkbenchPanel } from './panels/WorkbenchPanel'
import { TimelinePanel } from './panels/TimelinePanel'
import { ArtifactsPanel } from './panels/ArtifactsPanel'
import { TaskChatPanel } from './panels/TaskChatPanel'
import { TaskFilesPanel } from './panels/TaskFilesPanel'
import { TeamConsolePanel } from './panels/TeamConsolePanel'
import { TaskCard as TaskCardType, LiveFlowEvent, FocusTarget } from '@/lib/types'
import { useChatStore, useLiveStore, useTaskStore } from '@/lib/store'
import { routeModeLabel, sessionModeLabel, roleLabel, stateLabel, acceptanceStateLabel } from '@/lib/utils'

export type DetailTab = 'mission' | 'workbench' | 'timeline' | 'deliverables' | 'chat' | 'files'
type MainTab = 'mission' | 'collaboration' | 'delivery'

export function isDetailTab(value: string): value is DetailTab {
  return ['mission', 'workbench', 'timeline', 'deliverables', 'chat', 'files'].includes(String(value || '').trim())
}

interface Props {
  selectedTaskId: string | null
  selectedTeamId?: string | null
  selectedTask: TaskCardType | null
  liveEvents?: LiveFlowEvent[]
  onCloseTask: () => void
  refreshKey?: number
  defaultTab?: DetailTab
}

const MAIN_TAB_DEFAULTS: Record<MainTab, DetailTab> = {
  mission: 'mission',
  collaboration: 'workbench',
  delivery: 'deliverables',
}

function normalizeRecommendedDetailTab(value?: string | null): DetailTab | null {
  const raw = String(value || '').trim()
  return isDetailTab(raw) ? raw : null
}

function detailToMainTab(tab: DetailTab): MainTab {
  if (tab === 'mission' || tab === 'timeline') return 'mission'
  if (tab === 'workbench' || tab === 'chat') return 'collaboration'
  return 'delivery'
}

const MAIN_TABS: Array<{ key: MainTab; label: string; Icon: typeof Sparkles; desc: string }> = [
  { key: 'mission', label: '现场', Icon: Sparkles, desc: '概况与判断' },
  { key: 'collaboration', label: '协作', Icon: ClipboardList, desc: '操作与对话' },
  { key: 'delivery', label: '交付', Icon: PackageOpen, desc: '交付、文件与结果回看' },
]

const DETAIL_TAB_META: Record<DetailTab, { label: string; Icon: typeof Sparkles }> = {
  mission: { label: '概况', Icon: Sparkles },
  timeline: { label: '进展', Icon: Sparkles },
  workbench: { label: '操作', Icon: ClipboardList },
  chat: { label: '对话', Icon: MessageCircle },
  deliverables: { label: '交付', Icon: PackageOpen },
  files: { label: '文件', Icon: FolderOpen },
}

const DETAIL_TAB_GROUPS: Record<MainTab, DetailTab[]> = {
  mission: ['mission', 'timeline'],
  collaboration: ['workbench', 'chat'],
  delivery: ['deliverables', 'files'],
}

export function RightPanel({
  selectedTaskId,
  selectedTeamId,
  selectedTask,
  liveEvents: liveEventsProp,
  onCloseTask,
  refreshKey = 0,
  defaultTab = 'mission',
}: Props) {
  const [detailTab, setDetailTab] = useState<DetailTab>(defaultTab)
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null)
  const { getEvents } = useLiveStore()
  const { tasks, nodes, setSelectedTaskId } = useTaskStore()
  const { sessions, sessionMessages, messages } = useChatStore()
  const liveEvents = selectedTaskId ? getEvents(selectedTaskId) : (liveEventsProp || [])
  const activeMainTab = detailToMainTab(detailTab)
  const activeDetailTabs = DETAIL_TAB_GROUPS[activeMainTab]
  const routeMode = routeModeLabel({ requestedNode: selectedTask?.requestedNode, actualNode: selectedTask?.actualNode, degradedReason: selectedTask?.degradedReason })
  const sessionModeText = sessionModeLabel({ sessionMode: selectedTask?.sessionMode, sessionPersistent: selectedTask?.sessionPersistent })

  const taskMessages = useMemo(() => {
    if (!selectedTaskId) return []
    const taskSession = sessions.find((session) => String(session.taskId || '') === String(selectedTaskId))
    if (taskSession) return sessionMessages[taskSession.sessionId] || []
    return messages.filter((msg) => String(msg.taskId || '') === String(selectedTaskId))
  }, [selectedTaskId, sessions, sessionMessages, messages])

  useEffect(() => {
    setFocusTarget(null)
  }, [selectedTaskId])

  useEffect(() => {
    if (!selectedTaskId) return
    if (focusTarget) {
      setDetailTab((focusTarget.openTab as DetailTab) || 'chat')
      return
    }
    const preferredTab = normalizeRecommendedDetailTab(selectedTask?.recommendedSurface)
    setDetailTab(preferredTab || defaultTab)
  }, [selectedTaskId, focusTarget, defaultTab, selectedTask?.recommendedSurface])

  const handleMainTabClick = (mainTab: MainTab) => {
    if (detailToMainTab(detailTab) === mainTab) return
    setDetailTab(MAIN_TAB_DEFAULTS[mainTab])
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[var(--surface)]" data-testid="right-panel" data-detail-tab={detailTab}>
      <div className="border-b border-[var(--border-subtle)] bg-[var(--surface)]/95">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold tracking-tight text-[var(--fg)]">
              {selectedTask?.title || '总览'}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]" data-testid="right-panel-summary-chips">
              {selectedTask ? (
                <>
                  <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">状态：{stateLabel((selectedTask.state || 'pending') as any)}</span>
                  <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">当前角色：{roleLabel(selectedTask.currentDriver || 'tl')}</span>
                  <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">产物：{selectedTask.artifactCount}</span>
                  <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">证据：{selectedTask.evidenceCount}</span>
                  <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">路由：{routeMode}</span>
                  <span className={`soft-label ${selectedTask.sessionPersistent ? 'border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--warning)]/20 bg-[var(--warning-soft)] text-[var(--warning)]'}`}>会话：{sessionModeText}</span>
                  {!!selectedTask.issueCount && <span className="soft-label border-[var(--warning)]/20 bg-[var(--warning-soft)] text-[var(--warning)]">风险：{selectedTask.issueCount}</span>}
                  {selectedTask.deliverableReady && <span className="soft-label border-[var(--success)]/20 bg-[var(--success-soft)] text-[var(--success)]">可交付</span>}
                  {selectedTask.humanInterventionReady && <span className="soft-label border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent)]">待人工确认</span>}
                  {!!selectedTask.acceptanceState && <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">验收态：{acceptanceStateLabel(selectedTask.acceptanceState)}</span>}
                  {!!selectedTask.recommendedSurface && <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">推荐落点：{DETAIL_TAB_META[normalizeRecommendedDetailTab(selectedTask.recommendedSurface) || 'mission'].label}</span>}
                </>
              ) : (
                <>
                  <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">任务与节点</span>
                  <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">对话与交付</span>
                  <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">风险与节奏</span>
                </>
              )}
            </div>
          </div>
          {selectedTaskId ? (
            <button
              onClick={onCloseTask}
              className="rounded-xl border border-transparent p-2 text-[var(--fg-ghost)] transition hover:border-[var(--border-subtle)] hover:bg-[var(--surface)] hover:text-[var(--fg-secondary)]"
              aria-label="关闭详情"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
      </div>

      {selectedTask && (
        <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface)]/92 px-4 py-2 backdrop-blur">
          <div className="flex flex-wrap gap-1.5 overflow-x-auto scrollbar-none">
            {MAIN_TABS.map(({ key, label, Icon }) => {
              const active = activeMainTab === key
              return (
                <button
                  key={key}
                  onClick={() => handleMainTabClick(key)}
                  data-testid={`right-panel-main-tab-${key}`}
                  data-active={active ? 'true' : 'false'}
                  className={`press-scale inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition touch-manipulation ${active ? 'border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent)] shadow-[var(--shadow-xs)]' : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--fg-muted)] hover:border-[var(--border)] hover:bg-[var(--surface-subtle)] hover:text-[var(--fg)]'}`}
                >
                  <Icon size={13} />
                  {label}
                </button>
              )
            })}
            <span className="mx-0.5 my-auto h-4 w-px shrink-0 bg-[var(--border-subtle)]" />
            {activeDetailTabs.map((tabKey) => {
              const { label, Icon } = DETAIL_TAB_META[tabKey]
              const active = detailTab === tabKey
              return (
                <button
                  key={tabKey}
                  onClick={() => setDetailTab(tabKey)}
                  data-testid={`right-panel-detail-tab-${tabKey}`}
                  data-active={active ? 'true' : 'false'}
                  className={`press-scale inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition touch-manipulation ${active ? 'border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent)] shadow-[var(--shadow-xs)]' : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--fg-muted)] hover:border-[var(--border)] hover:bg-[var(--surface-subtle)] hover:text-[var(--fg)]'}`}
                >
                  <Icon size={13} />
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        {!selectedTaskId || !selectedTask ? (
          <TeamConsolePanel
            tasks={tasks}
            nodes={nodes}
            threads={sessions}
            onSelectTask={(taskId) => setSelectedTaskId(taskId)}
          />
        ) : (
          <>
            {detailTab === 'mission' && (
              <MissionControlPanel
                task={selectedTask}
                liveEvents={liveEvents}
                messages={taskMessages}
                taskId={selectedTaskId}
                focusTarget={focusTarget}
                onFocusTarget={(target) => setFocusTarget(target)}
              />
            )}
            {detailTab === 'workbench' && (
              <WorkbenchPanel
                taskId={selectedTaskId}
                teamId={selectedTeamId}
                task={selectedTask}
                liveEvents={liveEvents}
                onFocusTarget={(target) => setFocusTarget(target)}
              />
            )}
            {detailTab === 'timeline' && (
              <TimelinePanel
                taskId={selectedTaskId}
                focusTarget={focusTarget}
                onFocusTarget={(target) => setFocusTarget(target)}
              />
            )}
            {detailTab === 'deliverables' && (
              <ArtifactsPanel taskId={selectedTaskId} refreshKey={refreshKey} focusTarget={focusTarget} onFocusTarget={(target) => setFocusTarget(target)} />
            )}
            {detailTab === 'chat' && (
              <TaskChatPanel
                taskId={selectedTaskId}
                task={selectedTask}
                focusTarget={focusTarget}
                onFocusTarget={(target) => setFocusTarget(target)}
              />
            )}
            {detailTab === 'files' && (
              <TaskFilesPanel taskId={selectedTaskId} task={selectedTask} focusTarget={focusTarget} onFocusTarget={(target) => setFocusTarget(target)} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

export { ArtifactsPanel } from './panels/ArtifactsPanel'
