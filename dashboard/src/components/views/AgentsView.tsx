'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Bot, RefreshCw, Package, Heart,
  FolderOpen, FileText, Terminal, Puzzle, Calendar,
  CheckCircle2, Activity, Server, Zap
} from 'lucide-react'
import { cn, roleLabel, nodeLabel, probeLatencyLabel, formatTime } from '@/lib/utils'
import { useTaskStore } from '@/lib/store'
import { fetchNodes } from '@/lib/api'
import { NodeSummary } from '@/lib/types'

const nodeAvatarMap: Record<string, string> = { 'node-a': '/node-avatar.png', 'node-b': '/node-avatar.png', 'node-c': '/node-avatar.png' }
const dotMap: Record<string, string> = { 'node-a': 'bg-gradient-to-br from-blue-500 to-indigo-600', 'node-b': 'bg-gradient-to-br from-violet-500 to-purple-600', 'node-c': 'bg-gradient-to-br from-emerald-500 to-teal-600' }

function Chip({ label, value, tone = 'default' }: { label?: string; value: string; tone?: 'default' | 'success' | 'warning' | 'accent' | 'danger' }) {
  const cls = tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
    : tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    : tone === 'accent' ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    : tone === 'danger' ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400'
    : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label && <span className="text-gray-400 dark:text-gray-500">{label}</span>}
      <span>{value}</span>
    </span>
  )
}

function MetricBox({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 border border-gray-100 dark:border-gray-700/50">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm font-semibold text-gray-900 dark:text-white">{value}</div>
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
  const ring = dotMap[nodeKey] || 'bg-gray-400'

  return (
    <article className="p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-xl hover:shadow-gray-900/10 transition-all duration-200">
      <div className="flex items-start gap-4">
        <div className={`h-12 w-12 shrink-0 rounded-xl ${ring} flex items-center justify-center text-white text-sm font-bold shadow-lg`}>
          {nodeLabel(nodeKey).slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${node.reachable ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
            <span className="text-base font-bold text-gray-900 dark:text-white">{nodeLabel(nodeKey)}</span>
            <Chip value={capLabel} tone={capTone} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip label="Latency" value={probeLatencyLabel(node.latencyMs)} />
            <Chip label="Active" value={`${Number(node.activeResidentCount || 0)}`} tone={Number(node.activeResidentCount || 0) > 0 ? 'success' : 'default'} />
            <Chip label="Load" value={pressLabel} tone={pressTone} />
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
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
    <article className="p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-xl hover:shadow-gray-900/10 transition-all duration-200">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
          <Bot size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-gray-900 dark:text-white truncate">{agent.displayName}</span>
          <Chip value={st.label} tone={st.tone} />
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Roles</div>
        <div className="flex flex-wrap gap-1.5">
          {agent.roles.map((r) => (
            <span key={r} className="px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-700">{roleLabel(r)}</span>
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
        <MetricBox icon={<Activity size={12} />} label="Status" value={st.label} tone={st.tone} />
      </div>

      {agent.config && (
        <div className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/50">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Runtime Config</div>
          <div className="space-y-1 font-mono text-xs text-gray-600 dark:text-gray-300">
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
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="shrink-0 p-6 pb-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
              <Server className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agent Runtime</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Monitor and manage agent instances</p>
            </div>
          </div>
          <button
            onClick={loadNodes}
            className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm transition-all"
          >
            <RefreshCw className={cn('h-4 w-4 text-gray-500', loading && 'animate-spin')} />
          </button>
        </div>

        <div className="flex gap-2 p-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
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
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                  active
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Active:</span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-semibold">
              {tab === 'runtime' ? agentMet.active : nodeMet.online}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Total:</span>
            <span className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold">
              {tab === 'runtime' ? agentMet.total : nodeMet.total}
            </span>
          </div>
          {tab === 'nodes' && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 dark:text-gray-400">Residents:</span>
              <span className="px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold">
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
            ? <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400">Loading nodes...</div>
            : entries.length === 0
              ? <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400">No node data</div>
              : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{entries.map((n) => <NodeCard key={n.key} nodeKey={n.key} node={n} />)}</div>
        )}
      </div>
    </div>
  )
}
