'use client'

import { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, MessageSquareMore, Route, Sparkles } from 'lucide-react'
import { ChatSession, NodeSummary, TaskCard } from '@/lib/types'
import { PanelEmptyState } from '@/components/ui/panel-states'
import {
  formatTime,
  nextBestActionLabel,
  nodeLabel,
  nodeServiceStatusLabel,
  roleLabel,
  stateLabel,
  threadPhaseLabel,
} from '@/lib/utils'

interface Props {
  tasks: TaskCard[]
  nodes: NodeSummary[]
  threads: ChatSession[]
  onSelectTask?: (taskId: string) => void
}

const ACTIVE_STATES = new Set(['planning', 'plan_review', 'approved', 'revision_requested'])

function sortByUpdatedAtDesc<T extends { updatedAt?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
}

export function TeamConsolePanel({ tasks, nodes, threads, onSelectTask }: Props) {
  const needsHuman = useMemo(
    () => sortByUpdatedAtDesc(tasks.filter((task) => task.humanInterventionReady || task.state === 'blocked')),
    [tasks],
  )
  const readyToDeliver = useMemo(
    () => sortByUpdatedAtDesc(tasks.filter((task) => task.deliverableReady && !task.humanInterventionReady)),
    [tasks],
  )
  const riskyInFlight = useMemo(
    () => sortByUpdatedAtDesc(tasks.filter((task) => !task.deliverableReady && !task.humanInterventionReady && task.issueCount > 0)),
    [tasks],
  )

  const threadItems = useMemo(() => {
    const dedup = new Map<string, ChatSession>()
    for (const session of threads) {
      if (!session?.taskId) continue
      const key = String(session.threadId || session.taskId || session.sessionId)
      if (!dedup.has(key)) dedup.set(key, session)
    }
    return sortByUpdatedAtDesc(Array.from(dedup.values())).slice(0, 8)
  }, [threads])

  const metrics = useMemo(() => {
    const active = tasks.filter((task) => ACTIVE_STATES.has(task.state)).length
    const deliverableReady = tasks.filter((task) => task.deliverableReady).length
    const pendingHuman = tasks.filter((task) => task.humanInterventionReady).length
    const risky = tasks.filter((task) => Number(task.issueCount || 0) > 0).length
    const onlineNodes = nodes.filter((node) => node.reachable).length
    return { active, deliverableReady, pendingHuman, risky, onlineNodes }
  }, [tasks, nodes])

  const rankedNodes = useMemo(() => [...nodes].sort((a, b) => Number(b.weight || 0) - Number(a.weight || 0)), [nodes])
  const recommendedNode = rankedNodes[0] || null
  const roleRoutes = useMemo(() => ['planner', 'critic', 'judge', 'executor'].map((role) => {
    const node = nodes.find((item) => Array.isArray(item.preferredRoles) && item.preferredRoles.includes(role))
    return node ? { role, nodeLabel: node.label || nodeLabel(node.key) } : null
  }).filter(Boolean) as Array<{ role: string; nodeLabel: string }>, [nodes])
  const pressuredNodes = useMemo(() => nodes.filter((node) => {
    const mem = Number(node.stats?.memoryUsedPercent || 0)
    const disk = Number(node.stats?.diskUsedPercent || 0)
    const load1 = Number(node.stats?.load1 || 0)
    return mem >= 85 || disk >= 75 || load1 >= 1
  }), [nodes])

  const queueGroups = [
    { key: 'human', title: '待人工拍板', desc: '优先处理需要老板接管或已阻塞的任务。', items: needsHuman, empty: '当前没有待人工拍板任务。', tone: 'warning' as const },
    { key: 'delivery', title: '可直接交付', desc: '这些任务已经进入验收/交付窗口。', items: readyToDeliver, empty: '当前没有进入交付窗口的任务。', tone: 'success' as const },
    { key: 'risk', title: '运行中但有风险', desc: '先盯住问题正在累积、但还没进入交付/人工位的任务。', items: riskyInFlight, empty: '当前没有需要优先盯防的运行中风险任务。', tone: 'danger' as const },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--surface)]">
      <div className="panel-scroll flex-1 min-h-0 overflow-y-auto p-3 md:p-4">
        <section className="space-y-3">
          <div className="surface-card surface-card-hero p-4 md:p-5">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--fg)]">
              <Sparkles className="h-4 w-4 text-[var(--accent)]" /> AI Team 驾驶舱
            </div>
            <div className="mt-1 text-[12px] text-[var(--fg-muted)]">先看优先级，再进现场处理，不再把任务列表和状态卡揉成一团。</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="metric-tile">
                <div className="text-[11px] text-[var(--fg-muted)]">主线推进</div>
                <div className="mt-1 text-xl font-semibold text-[var(--fg)]">{metrics.active}</div>
                <div className="mt-2 text-[12px] text-[var(--fg-muted)]">仍在规划 / 评审 / 批准链路中的任务</div>
              </div>
              <div className="metric-tile">
                <div className="text-[11px] text-[var(--fg-muted)]">待人工拍板</div>
                <div className="mt-1 text-xl font-semibold text-[var(--fg)]">{metrics.pendingHuman}</div>
                <div className="mt-2 text-[12px] text-[var(--fg-muted)]">需要老板确认或介入的任务</div>
              </div>
              <div className="metric-tile">
                <div className="text-[11px] text-[var(--fg-muted)]">可直接交付</div>
                <div className="mt-1 text-xl font-semibold text-[var(--fg)]">{metrics.deliverableReady}</div>
                <div className="mt-2 text-[12px] text-[var(--fg-muted)]">已经进入 deliverable-ready 窗口</div>
              </div>
              <div className="metric-tile">
                <div className="text-[11px] text-[var(--fg-muted)]">风险任务</div>
                <div className="mt-1 text-xl font-semibold text-[var(--fg)]">{metrics.risky}</div>
                <div className="mt-2 text-[12px] text-[var(--fg-muted)]">当前带 issue / 阻塞信号的任务</div>
              </div>
              <div className="metric-tile">
                <div className="text-[11px] text-[var(--fg-muted)]">在线节点</div>
                <div className="mt-1 text-xl font-semibold text-[var(--fg)]">{metrics.onlineNodes}</div>
                <div className="mt-2 text-[12px] text-[var(--fg-muted)]">当前仍可承接调度与会话的节点</div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-3">
              {queueGroups.map((group) => (
                <div key={group.key} className="surface-card-subtle p-3.5">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--fg)]">
                    {group.tone === 'warning' ? <AlertTriangle className="h-4 w-4 text-[var(--warning)]" /> : null}
                    {group.tone === 'success' ? <CheckCircle2 className="h-4 w-4 text-[var(--success)]" /> : null}
                    {group.tone === 'danger' ? <AlertTriangle className="h-4 w-4 text-[var(--danger)]" /> : null}
                    {group.title}
                  </div>
                  <div className="mt-1 text-[12px] text-[var(--fg-muted)]">{group.desc}</div>
                  <div className="mt-3 space-y-2.5">
                    {group.items.length === 0 ? (
                      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]">
                        <PanelEmptyState title={group.empty} body="当前这一类暂时不需要你接手。" />
                      </div>
                    ) : group.items.slice(0, 6).map((task) => (
                      <button
                        key={task.taskId}
                        type="button"
                        onClick={() => onSelectTask?.(task.taskId)}
                        className="surface-card-interactive press-scale w-full p-3 text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-medium text-[var(--fg)]">{task.title || task.taskId}</div>
                            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-[var(--fg-muted)]">
                              <span className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">{stateLabel(task.state)}</span>
                              {task.deliverableReady ? <span className="soft-label border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]">可交付</span> : null}
                              {task.humanInterventionReady ? <span className="soft-label border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]">待人工拍板</span> : null}
                              {task.issueCount > 0 ? <span className="soft-label border-[var(--danger)]/20 bg-[var(--danger-soft)] text-[var(--danger)]">{task.issueCount} 个风险</span> : null}
                            </div>
                            <div className="mt-2 text-[12px] leading-5 text-[var(--fg-secondary)]">下一动作：{nextBestActionLabel(task.nextBestAction)}</div>
                          </div>
                          <div className="shrink-0 text-[11px] text-[var(--fg-ghost)]">{formatTime(task.updatedAt)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="surface-card-subtle p-3.5">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--fg)]">
                  <Route className="h-4 w-4 text-[var(--accent)]" /> 调度建议与节点压力
                </div>
                <div className="mt-1 text-[12px] text-[var(--fg-muted)]">先给路由建议，再标出应该避让的节点，减少“看得到状态但不知道怎么派”。</div>
                <div className="mt-3 space-y-2.5">
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-3">
                    <div className="text-[12px] text-[var(--fg-muted)]">当前建议优先派给</div>
                    <div className="mt-1 text-[15px] font-semibold text-[var(--fg)]">{recommendedNode ? (recommendedNode.label || nodeLabel(recommendedNode.key)) : '待评估'}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-[var(--fg-muted)]">
                      {recommendedNode ? <span className="soft-label border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent)]">调度分 {Number(recommendedNode.weight || 0)}</span> : null}
                      {recommendedNode?.pressureReason ? <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">{recommendedNode.pressureReason}</span> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px] text-[var(--fg-muted)]">
                    {roleRoutes.map((item) => (
                      <span key={item.role} className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">{roleLabel(item.role as any)} → {item.nodeLabel}</span>
                    ))}
                  </div>
                  {pressuredNodes.length === 0 ? (
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-3 text-[12px] text-[var(--fg-muted)]">
                      当前没有需要特别避让的节点。
                    </div>
                  ) : pressuredNodes.slice(0, 3).map((node) => (
                    <div key={node.key} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[13px] font-medium text-[var(--fg)]">{node.label || nodeLabel(node.key)}</div>
                        <div className="text-[11px] text-[var(--fg-muted)]">{nodeServiceStatusLabel({ reachable: node.reachable, probe: node.probe, controlPlaneStatus: node.stats?.controlPlaneStatus })}</div>
                      </div>
                      <div className="mt-2 text-[12px] leading-5 text-[var(--fg-secondary)]">
                        负载 {Number(node.stats?.load1 || 0)} · 内存 {Number(node.stats?.memoryUsedPercent || 0)}% · 磁盘 {Number(node.stats?.diskUsedPercent || 0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="surface-card-subtle p-3.5">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--fg)]">
                  <MessageSquareMore className="h-4 w-4 text-[var(--accent)]" /> 最近对话
                </div>
                <div className="mt-3 space-y-2.5">
                  {threadItems.length === 0 ? (
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]">
                      <PanelEmptyState title="当前还没有可展示的任务对话摘要" body="等任务线程开始沉淀后，这里会出现最近对话。" />
                    </div>
                  ) : threadItems.map((thread) => (
                    <button
                      key={thread.threadId || thread.sessionId}
                      type="button"
                      onClick={() => thread.taskId && onSelectTask?.(thread.taskId)}
                      className="surface-card-interactive press-scale w-full p-3 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-[var(--fg)]">{thread.title}</div>
                          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-[var(--fg-muted)]">
                            {thread.phase ? <span className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">阶段：{threadPhaseLabel(thread.phase)}</span> : null}
                            {thread.owner ? <span className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">角色：{roleLabel(thread.owner)}</span> : null}
                            {thread.pendingHumanActions ? <span className="soft-label border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]">{thread.pendingHumanActions} 个待人工动作</span> : null}
                          </div>
                          <div className="mt-2 text-[12px] leading-5 text-[var(--fg-secondary)]">{thread.goal || thread.lastMessage || '继续推进这条任务。'}</div>
                        </div>
                        <div className="shrink-0 text-[11px] text-[var(--fg-ghost)]">{formatTime(thread.updatedAt)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
