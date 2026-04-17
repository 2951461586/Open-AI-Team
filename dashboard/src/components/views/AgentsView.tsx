'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Bot, RefreshCw, Server, Heart, Activity, Puzzle, Zap, Cpu, Wifi, PanelLeftClose, PanelLeftOpen,
  Settings, MemoryStick, Palette, LayoutDashboard
} from 'lucide-react'
import { cn, roleLabel, nodeLabel, probeLatencyLabel, formatTime } from '@/lib/utils'
import { useTaskStore } from '@/lib/store'
import { fetchNodes } from '@/lib/api'
import { NodeSummary } from '@/lib/types'
import { useI18n } from '@/i18n/context'
import { PersonalityPanel } from '@/components/panels/PersonalityPanel'
import { MemoryDecayPanel } from '@/components/panels/MemoryDecayPanel'
import { SkillMarketplace } from '@/components/panels/SkillMarketplace'
import { DeskPanel } from '@/components/panels/DeskPanel'

export type AgentTab = 'runtime' | 'nodes' | 'memory' | 'skills' | 'desk'

function MetricTile({ icon, label, value, tone }: { icon?: React.ReactNode; label: string; value: string | number; tone?: 'default' | 'success' | 'warning' | 'accent' | 'danger' }) {
  const textCls = tone === 'success' ? 'text-[var(--success)]'
    : tone === 'warning' ? 'text-[var(--warning)]'
    : tone === 'accent' ? 'text-[var(--accent)]'
    : tone === 'danger' ? 'text-[var(--danger)]'
    : 'text-[var(--fg)]'
  return (
    <div className="metric-tile">
      <div className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)] mb-1.5">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn('text-sm font-semibold', textCls)}>{value}</div>
    </div>
  )
}

function NodeCard({ nodeKey, node }: { nodeKey: string; node: NodeSummary }) {
  const stats = (node.stats || {}) as { load1?: number; memoryUsedPercent?: number; diskUsedPercent?: number }
  const load1 = Number(stats.load1 || 0)
  const mem = Number(stats.memoryUsedPercent || 0)
  const capLabel = node.reachable && Number(node.activeResidentCount || 0) > 0 ? '活跃' : node.reachable ? '待机' : '离线'
  const capTone = node.reachable && Number(node.activeResidentCount || 0) > 0 ? 'success' as const : node.reachable ? 'accent' as const : 'warning' as const
  const pressLabel = load1 >= 2 || mem >= 85 ? '高' : load1 >= 1 || mem >= 70 ? '中' : load1 > 0 || mem > 0 ? '低' : '空闲'
  const pressTone = load1 >= 2 || mem >= 85 ? 'danger' as const : load1 >= 1 || mem >= 70 ? 'warning' as const : 'success' as const
  const roles = (node.activeResidentRoles || []).map(r => roleLabel(r)).join(', ') || '无'
  const nodeColor = nodeKey === 'node-a' ? 'bg-[var(--node-laoda)]' : nodeKey === 'node-b' ? 'bg-[var(--node-violet)]' : nodeKey === 'node-c' ? 'bg-[var(--node-lebang)]' : 'bg-[var(--fg-muted)]'

  return (
    <article className="surface-card-hero p-4 hover-lift">
      <div className="flex items-start gap-3">
        <div className={cn(
          'h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-white text-sm font-bold',
          nodeColor
        )}>
          {nodeLabel(nodeKey).slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              'w-2 h-2 rounded-full',
              node.reachable ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--fg-ghost)]'
            )} />
            <span className="text-sm font-bold text-[var(--fg)]">{nodeLabel(nodeKey)}</span>
            <span className={cn(
              'soft-label text-[10px]',
              capTone === 'success' ? 'border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)]' :
              capTone === 'accent' ? 'border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]' :
              'border-[var(--warning)]/30 bg-[var(--warning-soft)] text-[var(--warning)]'
            )}>
              {capLabel}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            <span className="soft-label text-[10px]">
              <Wifi size={9} className="mr-0.5 inline" />
              {probeLatencyLabel(node.latencyMs)}
            </span>
            <span className={cn(
              'soft-label text-[10px]',
              Number(node.activeResidentCount || 0) > 0
                ? 'border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)]'
                : ''
            )}>
              <Cpu size={9} className="mr-0.5 inline" />
              {Number(node.activeResidentCount || 0)}
            </span>
            <span className={cn(
              'soft-label text-[10px]',
              pressTone === 'danger' ? 'border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger)]' :
              pressTone === 'warning' ? 'border-[var(--warning)]/30 bg-[var(--warning-soft)] text-[var(--warning)]' :
              'border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)]'
            )}>
              {pressLabel}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-[var(--fg-muted)]">
            <span className="font-medium text-[var(--fg-secondary)]">角色:</span> {roles}
          </div>
        </div>
      </div>
    </article>
  )
}

interface AgentRuntime {
  agentId: string
  displayName: string
  roles: string[]
  status: 'active' | 'idle' | 'busy' | 'degraded'
  heartbeatMs?: number
  memorySize?: number
  skillsInstalled?: number
  lastActiveAt?: number
  config?: Record<string, any>
}

const MOCK_AGENTS: AgentRuntime[] = [
  {
    agentId: 'agent:ai-team-oss-minimal-wrapper',
    displayName: 'AI Team OSS Minimal',
    roles: ['planner', 'executor', 'critic', 'judge'],
    status: 'active',
    heartbeatMs: 1250,
    memorySize: 2847,
    skillsInstalled: 8,
    lastActiveAt: Date.now() - 60000,
    config: { workflowPackId: 'workflow.oss-minimal.v1', policyPackId: 'policy.oss-minimal.v1' },
  },
]

function statusInfo(s: AgentRuntime['status']) {
  return s === 'active' ? { label: '活跃', tone: 'success' as const }
    : s === 'busy' ? { label: '忙碌', tone: 'accent' as const }
    : s === 'degraded' ? { label: '降级', tone: 'danger' as const }
    : { label: '空闲', tone: 'default' as const }
}

function AgentRuntimeCard({ agent }: { agent: AgentRuntime }) {
  const st = statusInfo(agent.status)
  const ago = agent.lastActiveAt ? formatTime(Date.now() - agent.lastActiveAt) : '—'

  return (
    <article className="surface-card-hero p-4 hover-lift">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-9 w-9 shrink-0 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)]">
          <Bot size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[var(--fg)] truncate">{agent.displayName}</span>
          <span className={cn(
            'soft-label text-[10px] mt-0.5',
            st.tone === 'success' ? 'border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)]' :
            st.tone === 'accent' ? 'border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]' :
            st.tone === 'danger' ? 'border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger)]' :
            'border-[var(--fg-ghost)]/30 bg-[var(--surface-subtle)] text-[var(--fg-muted)]'
          )}>
            {st.label}
          </span>
        </div>
      </div>

      <div className="mb-3">
        <div className="text-[11px] text-[var(--fg-muted)] mb-1.5">角色</div>
        <div className="flex flex-wrap gap-1">
          {agent.roles.map((r) => (
            <span key={r} className="soft-label text-[10px]">
              {roleLabel(r)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <MetricTile icon={<Heart size={10} />} label="心跳" value={agent.heartbeatMs ? `${agent.heartbeatMs}ms` : '—'} />
        <MetricTile icon={<Server size={10} />} label="内存" value={agent.memorySize ? `${agent.memorySize}` : '—'} />
        <MetricTile icon={<Zap size={10} />} label="活跃" value={ago} />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <MetricTile icon={<Puzzle size={10} />} label="技能" value={agent.skillsInstalled ?? '—'} />
        <MetricTile icon={<Activity size={10} />} label="状态" value={st.label} tone={st.tone === 'success' ? 'success' : st.tone === 'accent' ? 'accent' : st.tone === 'danger' ? 'danger' : 'default'} />
      </div>

      {agent.config && (
        <div className="mt-3 p-2 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border-subtle)]">
          <div className="text-[10px] font-medium text-[var(--fg-muted)] mb-1">运行时配置</div>
          <div className="space-y-0.5 font-mono text-[10px] text-[var(--fg-secondary)]">
            {agent.config.workflowPackId && <div>workflow: {agent.config.workflowPackId}</div>}
            {agent.config.policyPackId && <div>policy: {agent.config.policyPackId}</div>}
          </div>
        </div>
      )}
    </article>
  )
}

const TABS: { id: AgentTab; icon: typeof Bot; labelKey: string }[] = [
  { id: 'runtime', icon: Bot, labelKey: 'agents.runtime' },
  { id: 'nodes', icon: Server, labelKey: 'agents.nodes' },
  { id: 'memory', icon: MemoryStick, labelKey: 'memory.title' },
  { id: 'skills', icon: Palette, labelKey: 'skills.marketplace' },
  { id: 'desk', icon: LayoutDashboard, labelKey: 'desk.title' },
]

export function AgentsView() {
  const { t } = useI18n()
  const nodes = useTaskStore((s) => s.nodes)
  const [tab, setTab] = useState<AgentTab>('runtime')
  const [loading, setLoading] = useState(false)
  const [agents] = useState<AgentRuntime[]>(MOCK_AGENTS)
  const [sidebarVisible, setSidebarVisible] = useState(true)

  const renderContent = useCallback(() => {
    switch (tab) {
      case 'memory':
        return <MemoryDecayPanel />
      case 'skills':
        return <SkillMarketplace />
      case 'desk':
        return <DeskPanel />
      default:
        return null
    }
  }, [tab])

  const activeTabMeta = TABS.find((t) => t.id === tab)

  const loadNodes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchNodes()
      if (!res.ok) return
      const json = await res.json()
      const rawNodes = json?.nodes || json?.payload?.nodes || {}
      const deployment = json?.deployment || json?.payload?.deployment || {}
      const canonicalLabels: Record<string, string> = { 'node-a': '本地', 'node-b': '观察者', 'node-c': '评审' }
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
      useTaskStore.getState().setNodes(list)
    } catch (err) {
      console.error('Nodes load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNodes()
    const timer = setInterval(loadNodes, 15000)
    return () => clearInterval(timer)
  }, [loadNodes])

  const entries = useMemo(() => [...nodes].sort((a, b) => {
    if (!!a.recommended !== !!b.recommended) return a.recommended ? -1 : 1
    return (Number(b.weight || 0)) - (Number(a.weight || 0))
  }), [nodes])

  const nodeMet = useMemo(() => ({
    total: entries.length,
    online: entries.filter((n) => n.reachable).length,
    resident: entries.reduce((s, n) => s + Number(n.activeResidentCount || 0), 0),
  }), [entries])

  const agentMet = useMemo(() => ({
    total: agents.length,
    active: agents.filter((a) => a.status === 'active' || a.status === 'busy').length,
  }), [agents])

  const toggleSidebar = () => setSidebarVisible((prev) => !prev)

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl md:p-6">
      <div className="flex h-full min-h-0 w-full overflow-hidden bg-[var(--surface)] md:rounded-2xl md:border md:border-[var(--border)] md:shadow-[0_18px_36px_rgba(15,23,42,0.06)]">
        <aside className={`hidden shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-all duration-200 md:flex ${sidebarVisible ? 'w-52' : 'w-0 overflow-hidden border-r-0'}`}>
          {sidebarVisible && (
            <>
              <div className="border-b border-[var(--border)] px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--fg)]">{t('nav.agents', 'Agent')}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {(tab === 'runtime' || tab === 'nodes') && (
                      <button
                        onClick={loadNodes}
                        className="rounded-lg p-1.5 text-[var(--fg-ghost)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--fg-secondary)]"
                        title={t('agents.refresh', '刷新')}
                      >
                        <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                      </button>
                    )}
                    <button
                      onClick={toggleSidebar}
                      className="rounded-lg p-1.5 text-[var(--fg-ghost)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--fg-secondary)]"
                      title={t('agents.hideSidebar', '隐藏侧边栏')}
                    >
                      <PanelLeftClose className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {(tab === 'runtime' || tab === 'nodes') && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--fg-muted)]">
                  {tab === 'runtime' ? (
                    <>
                      <span className="soft-label border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)] text-[10px]">
                        {t('agents.active', '活跃')} {agentMet.active}
                      </span>
                      <span className="soft-label text-[10px]">
                        {t('agents.total', '总数')} {agentMet.total}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="soft-label border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)] text-[10px]">
                        {t('agents.online', '在线')} {nodeMet.online}
                      </span>
                      <span className="soft-label text-[10px]">
                        {t('agents.total', '总数')} {nodeMet.total}
                      </span>
                      <span className="soft-label border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)] text-[10px]">
                        {t('agents.resident', '常驻')} {nodeMet.resident}
                      </span>
                    </>
                  )}
                </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto py-2">
                <div className="px-3 py-1.5">
                  <div className="text-[10px] font-semibold text-[var(--fg-muted)] mb-1.5 uppercase tracking-wider">{t('settings.navigation', '设置分类')}</div>
                  <nav className="space-y-0.5">
                    {TABS.map((item) => {
                      const Icon = item.icon
                      return (
                        <button
                          key={item.id}
                          onClick={() => setTab(item.id)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition',
                            tab === item.id
                              ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_3px_0_0_var(--accent)]'
                              : 'text-[var(--fg-secondary)] hover:bg-[var(--surface-subtle)]'
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="text-xs font-medium">{t(item.labelKey, item.labelKey)}</span>
                        </button>
                      )
                    })}
                  </nav>
                </div>
              </div>
            </>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 md:px-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
                  <span className="text-sm font-semibold text-[var(--fg)]">{activeTabMeta ? t(activeTabMeta.labelKey, activeTabMeta.labelKey) : 'Agent'}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!sidebarVisible && (
                  <button
                    onClick={toggleSidebar}
                    className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)] shadow-[var(--shadow-xs)] transition hover:bg-[var(--surface-subtle)]"
                    aria-label={t('agents.showSidebar', '显示侧边栏')}
                    title={t('agents.showSidebar', '显示侧边栏')}
                  >
                    <PanelLeftOpen className="h-3.5 w-3.5" />
                  </button>
                )}
                {(tab === 'runtime' || tab === 'nodes') && (
                  <button
                    onClick={loadNodes}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)] shadow-[var(--shadow-xs)] transition hover:bg-[var(--surface)]"
                    aria-label={t('agents.refresh', '刷新')}
                    title={t('agents.refresh', '刷新')}
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-2.5 flex min-w-0 gap-1.5 overflow-x-auto pb-1 scrollbar-none md:hidden">
              {TABS.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                      tab === item.id
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{t(item.labelKey, item.labelKey)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto panel-scroll">
            <div className="p-3 md:p-4">
              {(tab === 'runtime' || tab === 'nodes') && (
                <>
                  {tab === 'runtime' && (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {agents.length === 0 ? (
                        <div className="col-span-full flex items-center justify-center h-32 text-[var(--fg-muted)] text-sm">{t('agents.noRuntimeData', '暂无运行时数据')}</div>
                      ) : (
                        agents.map((a) => <AgentRuntimeCard key={a.agentId} agent={a} />)
                      )}
                    </div>
                  )}

                  {tab === 'nodes' && (
                    loading && entries.length === 0
                      ? <div className="flex items-center justify-center h-32 text-[var(--fg-muted)] text-sm">{t('agents.loadingNodes', '正在加载节点...')}</div>
                      : entries.length === 0
                        ? <div className="flex items-center justify-center h-32 text-[var(--fg-muted)] text-sm">{t('agents.noNodes', '暂无节点数据')}</div>
                        : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{entries.map((n) => <NodeCard key={n.key} nodeKey={n.key} node={n} />)}</div>
                  )}
                </>
              )}

              {(tab === 'memory' || tab === 'skills' || tab === 'desk') && (
                renderContent()
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
