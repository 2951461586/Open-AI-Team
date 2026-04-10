'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Bot, RefreshCw, Server, Heart, Activity, Puzzle, Zap
} from 'lucide-react'
import { cn, roleLabel, nodeLabel, probeLatencyLabel, formatTime } from '@/lib/utils'
import { useTaskStore } from '@/lib/store'
import { fetchNodes } from '@/lib/api'
import { NodeSummary } from '@/lib/types'

function Chip({ label, value, tone = 'default' }: { label?: string; value: string; tone?: 'default' | 'success' | 'warning' | 'accent' | 'danger' }) {
  const cls = tone === 'success' ? 'border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]'
    : tone === 'warning' ? 'border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]'
    : tone === 'accent' ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
    : tone === 'danger' ? 'border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]'
    : 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label && <span className="text-[var(--fg-ghost)]">{label}</span>}
      <span>{value}</span>
    </span>
  )
}

function MetricBox({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-[var(--surface-subtle)] p-3">
      <div className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)] mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm font-semibold text-[var(--fg)]">{value}</div>
    </div>
  )
}

function NodeCard({ nodeKey, node }: { nodeKey: string; node: NodeSummary }) {
  const stats = (node.stats || {}) as { load1?: number; memoryUsedPercent?: number; diskUsedPercent?: number }
  const load1 = Number(stats.load1 || 0)
  const mem = Number(stats.memoryUsedPercent || 0)
  const capLabel = node.reachable && Number(node.activeResidentCount || 0) > 0 ? 'Active' : node.reachable ? 'Standby' : 'Offline'
  const capTone = node.reachable && Number(node.activeResidentCount || 0) > 0 ? 'success' as const : node.reachable ? 'accent' as const : 'warning' as const
  const pressLabel = load1 >= 2 || mem >= 85 ? 'High' : load1 >= 1 || mem >= 70 ? 'Medium' : load1 > 0 || mem > 0 ? 'Low' : 'Idle'
  const pressTone = load1 >= 2 || mem >= 85 ? 'danger' as const : load1 >= 1 || mem >= 70 ? 'warning' as const : 'success' as const
  const roles = (node.activeResidentRoles || []).map(r => roleLabel(r)).join(', ') || 'None'

  return (
    <article className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-all">
      <div className="flex items-start gap-4">
        <div className={cn(
          'h-12 w-12 shrink-0 rounded-xl flex items-center justify-center text-white text-sm font-bold',
          nodeKey === 'node-a' ? 'bg-[var(--node-laoda)]' :
          nodeKey === 'node-b' ? 'bg-[var(--node-violet)]' :
          nodeKey === 'node-c' ? 'bg-[var(--node-lebang)]' : 'bg-[var(--fg-muted)]'
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
            <Chip value={capLabel} tone={capTone} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip label="Latency" value={probeLatencyLabel(node.latencyMs)} />
            <Chip label="Active" value={`${Number(node.activeResidentCount || 0)}`} tone={Number(node.activeResidentCount || 0) > 0 ? 'success' : 'default'} />
            <Chip label="Load" value={pressLabel} tone={pressTone} />
          </div>
          <div className="mt-2 text-xs text-[var(--fg-muted)]">
            <span className="font-medium">Roles:</span> {roles}
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
  return s === 'active' ? { label: 'Active', tone: 'success' as const }
    : s === 'busy' ? { label: 'Busy', tone: 'accent' as const }
    : s === 'degraded' ? { label: 'Degraded', tone: 'danger' as const }
    : { label: 'Idle', tone: 'default' as const }
}

function AgentRuntimeCard({ agent }: { agent: AgentRuntime }) {
  const st = statusInfo(agent.status)
  const ago = agent.lastActiveAt ? formatTime(Date.now() - agent.lastActiveAt) + ' ago' : '—'

  return (
    <article className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-all">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)]">
          <Bot size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[var(--fg)] truncate">{agent.displayName}</span>
          <Chip value={st.label} tone={st.tone} />
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs text-[var(--fg-muted)] mb-2">Roles</div>
        <div className="flex flex-wrap gap-1.5">
          {agent.roles.map((r) => (
            <span key={r} className="px-2.5 py-1 rounded-lg bg-[var(--surface-subtle)] text-xs font-medium text-[var(--fg-secondary)] border border-[var(--border)]">
              {roleLabel(r)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MetricBox icon={<Heart size={12} />} label="Heartbeat" value={agent.heartbeatMs ? `${agent.heartbeatMs}ms` : '—'} />
        <MetricBox icon={<Server size={12} />} label="Memory" value={agent.memorySize ? `${agent.memorySize}` : '—'} />
        <MetricBox icon={<Zap size={12} />} label="Last Active" value={ago} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MetricBox icon={<Puzzle size={12} />} label="Skills" value={agent.skillsInstalled ?? '—'} />
        <MetricBox icon={<Activity size={12} />} label="Status" value={st.label} />
      </div>

      {agent.config && (
        <div className="mt-4 p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)]">
          <div className="text-xs font-medium text-[var(--fg-muted)] mb-1.5">Runtime Config</div>
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
      const canonicalLabels: Record<string, string> = { 'node-a': 'Local', 'node-b': 'Observer', 'node-c': 'Review' }
      const list = Object.entries(rawNodes)
        .filter(([key, value]) => key !== 'ts' && value && typeof value === 'object')
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
      <div className="shrink-0 px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[var(--fg)]">Agent Runtime</h1>
              <p className="text-xs text-[var(--fg-muted)]">Monitor and manage agent instances</p>
            </div>
          </div>
          <button
            onClick={loadNodes}
            className="p-2 rounded-xl hover:bg-[var(--surface-subtle)] transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4 text-[var(--fg-muted)]', loading && 'animate-spin')} />
          </button>
        </div>

        <div className="flex gap-1 p-1 bg-[var(--surface-subtle)] rounded-xl w-fit">
          {([
            { id: 'runtime' as AgentTab, label: 'Runtime', icon: Bot },
            { id: 'nodes' as AgentTab, label: 'Nodes', icon: Server },
          ]).map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all',
                  active
                    ? 'bg-[var(--accent)] text-white shadow-md'
                    : 'text-[var(--fg-secondary)] hover:bg-[var(--surface-muted)]'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="mb-4 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-[var(--fg-muted)]">Active:</span>
            <span className="px-2.5 py-1 rounded-lg bg-[var(--success-soft)] font-semibold text-[var(--success)]">
              {tab === 'runtime' ? agentMet.active : nodeMet.online}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--fg-muted)]">Total:</span>
            <span className="px-2.5 py-1 rounded-lg bg-[var(--surface-subtle)] font-semibold text-[var(--fg-secondary)]">
              {tab === 'runtime' ? agentMet.total : nodeMet.total}
            </span>
          </div>
          {tab === 'nodes' && (
            <div className="flex items-center gap-2">
              <span className="text-[var(--fg-muted)]">Residents:</span>
              <span className="px-2.5 py-1 rounded-lg bg-[var(--accent-soft)] font-semibold text-[var(--accent)]">
                {nodeMet.resident}
              </span>
            </div>
          )}
        </div>

        {tab === 'runtime' && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((a) => <AgentRuntimeCard key={a.agentId} agent={a} />)}
          </div>
        )}

        {tab === 'nodes' && (
          loading && entries.length === 0
            ? <div className="flex items-center justify-center h-48 text-[var(--fg-muted)]">Loading nodes...</div>
            : entries.length === 0
              ? <div className="flex items-center justify-center h-48 text-[var(--fg-muted)]">No node data</div>
              : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{entries.map((n) => <NodeCard key={n.key} nodeKey={n.key} node={n} />)}</div>
        )}
      </div>
    </div>
  )
}
