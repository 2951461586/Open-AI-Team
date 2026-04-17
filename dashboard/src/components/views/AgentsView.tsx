'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Bot, RefreshCw, Server, Heart, Activity, Puzzle, Zap, Cpu, Wifi, WifiOff
} from 'lucide-react'
import { cn, roleLabel, nodeLabel, probeLatencyLabel, formatTime } from '@/lib/utils'
import { useTaskStore } from '@/lib/store'
import { fetchNodes } from '@/lib/api'
import { NodeSummary } from '@/lib/types'

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
    <article className="surface-card-hero p-5 hover-lift">
      <div className="flex items-start gap-4">
        <div className={cn(
          'h-12 w-12 shrink-0 rounded-xl flex items-center justify-center text-white text-sm font-bold',
          nodeColor
        )}>
          {nodeLabel(nodeKey).slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-3">
            <div className={cn(
              'w-2 h-2 rounded-full',
              node.reachable ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--fg-ghost)]'
            )} />
            <span className="text-sm font-bold text-[var(--fg)]">{nodeLabel(nodeKey)}</span>
            <span className={cn(
              'soft-label',
              capTone === 'success' ? 'border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)]' :
              capTone === 'accent' ? 'border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]' :
              'border-[var(--warning)]/30 bg-[var(--warning-soft)] text-[var(--warning)]'
            )}>
              {capLabel}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="soft-label">
              <Wifi size={10} className="mr-1" />
              {probeLatencyLabel(node.latencyMs)}
            </span>
            <span className={cn(
              'soft-label',
              Number(node.activeResidentCount || 0) > 0
                ? 'border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)]'
                : ''
            )}>
              <Cpu size={10} className="mr-1" />
              {Number(node.activeResidentCount || 0)}
            </span>
            <span className={cn(
              'soft-label',
              pressTone === 'danger' ? 'border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger)]' :
              pressTone === 'warning' ? 'border-[var(--warning)]/30 bg-[var(--warning-soft)] text-[var(--warning)]' :
              'border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)]'
            )}>
              {pressLabel}
            </span>
          </div>
          <div className="mt-3 text-xs text-[var(--fg-muted)]">
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
    <article className="surface-card-hero p-5 hover-lift">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)]">
          <Bot size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[var(--fg)] truncate">{agent.displayName}</span>
          <span className={cn(
            'soft-label mt-1',
            st.tone === 'success' ? 'border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)]' :
            st.tone === 'accent' ? 'border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]' :
            st.tone === 'danger' ? 'border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger)]' :
            'border-[var(--fg-ghost)]/30 bg-[var(--surface-subtle)] text-[var(--fg-muted)]'
          )}>
            {st.label}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs text-[var(--fg-muted)] mb-2">角色</div>
        <div className="flex flex-wrap gap-1.5">
          {agent.roles.map((r) => (
            <span key={r} className="soft-label">
              {roleLabel(r)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MetricTile icon={<Heart size={12} />} label="心跳" value={agent.heartbeatMs ? `${agent.heartbeatMs}ms` : '—'} />
        <MetricTile icon={<Server size={12} />} label="内存" value={agent.memorySize ? `${agent.memorySize}` : '—'} />
        <MetricTile icon={<Zap size={12} />} label="活跃" value={ago} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MetricTile icon={<Puzzle size={12} />} label="技能" value={agent.skillsInstalled ?? '—'} />
        <MetricTile icon={<Activity size={12} />} label="状态" value={st.label} tone={st.tone === 'success' ? 'success' : st.tone === 'accent' ? 'accent' : st.tone === 'danger' ? 'danger' : 'default'} />
      </div>

      {agent.config && (
        <div className="mt-4 p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)]">
          <div className="text-xs font-medium text-[var(--fg-muted)] mb-1.5">运行时配置</div>
          <div className="space-y-1 font-mono text-xs text-[var(--fg-secondary)]">
            {agent.config.workflowPackId && <div>workflow: {agent.config.workflowPackId}</div>}
            {agent.config.policyPackId && <div>policy: {agent.config.policyPackId}</div>}
          </div>
        </div>
      )}
    </article>
  )
}

type AgentTab = 'runtime' | 'nodes'

export function AgentsView() {
  const nodes = useTaskStore((s) => s.nodes)
  const [tab, setTab] = useState<AgentTab>('runtime')
  const [loading, setLoading] = useState(false)
  const [agents] = useState<AgentRuntime[]>(MOCK_AGENTS)

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

  return (
    <div className="flex flex-col h-full bg-[var(--bg)]">
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Server className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-[var(--fg)]">Agent 运行时</h1>
              <p className="text-[11px] text-[var(--fg-muted)]">监控和管理 Agent 实例</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              {tab === 'runtime' ? (
                <>
                  <span className="soft-label border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)]">
                    活跃 {agentMet.active}
                  </span>
                  <span className="soft-label">
                    总数 {agentMet.total}
                  </span>
                </>
              ) : (
                <>
                  <span className="soft-label border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)]">
                    在线 {nodeMet.online}
                  </span>
                  <span className="soft-label">
                    总数 {nodeMet.total}
                  </span>
                  <span className="soft-label border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]">
                    常驻 {nodeMet.resident}
                  </span>
                </>
              )}
            </div>
            <button
              onClick={loadNodes}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)] transition hover:bg-[var(--surface-subtle)]"
              title="刷新节点"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        <div className="flex gap-1 p-1 bg-[var(--surface-subtle)] rounded-xl w-fit mt-3">
          {([
            { id: 'runtime' as AgentTab, label: '运行时', icon: Bot },
            { id: 'nodes' as AgentTab, label: '节点', icon: Server },
          ]).map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all',
                  active
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'text-[var(--fg-secondary)] hover:bg-[var(--surface-muted)]'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto panel-scroll">
        <div className="p-4 md:p-5">
          {tab === 'runtime' && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {agents.length === 0 ? (
                <div className="col-span-full flex items-center justify-center h-48 text-[var(--fg-muted)]">暂无运行时数据</div>
              ) : (
                agents.map((a) => <AgentRuntimeCard key={a.agentId} agent={a} />)
              )}
            </div>
          )}

          {tab === 'nodes' && (
            loading && entries.length === 0
              ? <div className="flex items-center justify-center h-48 text-[var(--fg-muted)]">正在加载节点...</div>
              : entries.length === 0
                ? <div className="flex items-center justify-center h-48 text-[var(--fg-muted)]">暂无节点数据</div>
                : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{entries.map((n) => <NodeCard key={n.key} nodeKey={n.key} node={n} />)}</div>
          )}
        </div>
      </div>
    </div>
  )
}
