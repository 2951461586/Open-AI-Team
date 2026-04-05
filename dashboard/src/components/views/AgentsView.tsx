'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Image from 'next/image'
import {
  Bot, RefreshCw, Package, Heart,
  FolderOpen, FileText, Terminal, Puzzle, Calendar,
  CheckCircle2,
} from 'lucide-react'
import { cn, roleLabel, nodeLabel, probeLatencyLabel, formatTime } from '@/lib/utils'
import { useTaskStore } from '@/lib/store'
import { fetchNodes } from '@/lib/api'
import { NodeSummary } from '@/lib/types'

/* ─── Shared ─────────────────────────────────────────────────── */

const nodeAvatarMap: Record<string, string> = { laoda: '/node-avatars/laoda.png', violet: '/node-avatars/violet.png', lebang: '/node-avatars/lebang.png' }
const dotMap: Record<string, string> = { laoda: 'bg-[var(--node-laoda)]', violet: 'bg-[var(--node-violet)]', lebang: 'bg-[var(--success)]' }
const nodeRingMap: Record<string, string> = { laoda: 'ring-[var(--node-laoda)]/30', violet: 'ring-[var(--node-violet)]/30', lebang: 'ring-[var(--success)]/30' }

function Chip({ label, value, tone = 'default' }: { label?: string; value: string; tone?: 'default' | 'success' | 'warning' | 'accent' | 'danger' }) {
  const cls = tone === 'success' ? 'border-[var(--success)]/20 bg-[var(--success-soft)] text-[var(--success)]'
    : tone === 'warning' ? 'border-[var(--warning)]/20 bg-[var(--warning-soft)] text-[var(--warning)]'
    : tone === 'accent' ? 'border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent)]'
    : tone === 'danger' ? 'border-[var(--danger)]/20 bg-[var(--danger-soft)] text-[var(--danger)]'
    : 'border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${cls}`}>
      {label && <span className="text-[var(--fg-ghost)]">{label}</span>}
      <span className="font-medium">{value}</span>
    </span>
  )
}

function MetricBox({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-[var(--surface-subtle)] px-2 py-1.5">
      <div className="flex items-center gap-1 text-[9px] text-[var(--fg-ghost)]">{icon}{label}</div>
      <div className="text-[11px] font-medium text-[var(--fg)]">{value}</div>
    </div>
  )
}

/* ─── Node Card ──────────────────────────────────────────────── */

function NodeCard({ nodeKey, node }: { nodeKey: string; node: NodeSummary }) {
  const stats = (node.stats || {}) as { load1?: number; memoryUsedPercent?: number; diskUsedPercent?: number }
  const load1 = Number(stats.load1 || 0)
  const mem = Number(stats.memoryUsedPercent || 0)
  const capLabel = node.reachable && Number(node.activeResidentCount || 0) > 0 ? '在线承接' : node.reachable ? '在线待命' : '待恢复'
  const capTone = node.reachable && Number(node.activeResidentCount || 0) > 0 ? 'success' as const : node.reachable ? 'accent' as const : 'warning' as const
  const pressLabel = load1 >= 2 || mem >= 85 ? '高压' : load1 >= 1 || mem >= 70 ? '中压' : load1 > 0 || mem > 0 ? '低压' : '待同步'
  const pressTone = load1 >= 2 || mem >= 85 ? 'danger' as const : load1 >= 1 || mem >= 70 ? 'warning' as const : load1 > 0 ? 'success' as const : 'default' as const
  const roles = (node.activeResidentRoles || []).map(r => roleLabel(r)).join('、') || '无驻留'
  const src = nodeAvatarMap[nodeKey]
  const ring = nodeRingMap[nodeKey] || 'ring-[var(--border)]'

  return (
    <article className="surface-card-interactive p-3.5">
      <div className="flex items-center gap-3">
        <div className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-xl ring-1 ${ring} bg-[var(--surface-subtle)]`}>
          {src ? <Image src={src} alt={nodeLabel(nodeKey)} fill sizes="40px" className="object-cover" />
            : <div className={`flex h-full w-full items-center justify-center text-[11px] font-semibold text-white ${dotMap[nodeKey] || 'bg-[var(--fg-ghost)]'}`}>{nodeLabel(nodeKey).slice(0, 1)}</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${node.reachable ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`} />
            <span className="truncate text-[13px] font-semibold text-[var(--fg)]">{nodeLabel(nodeKey)}</span>
            <Chip value={capLabel} tone={capTone} />
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Chip label="延迟" value={probeLatencyLabel(node.latencyMs)} />
            <Chip label="驻留" value={`${Number(node.activeResidentCount || 0)}`} tone={Number(node.activeResidentCount || 0) > 0 ? 'success' : 'default'} />
            <Chip label="压力" value={pressLabel} tone={pressTone} />
          </div>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-[var(--fg-muted)]">角色：{roles}</div>
    </article>
  )
}

/* ─── Agent Runtime types & mock ─────────────────────────────── */

interface AgentRuntime {
  agentId: string
  displayName: string
  roles: string[]
  status: 'active' | 'idle' | 'busy' | 'degraded'
  heartbeatMs?: number
  memorySize?: number
  deskFileCount?: number
  skillsInstalled?: number
  cronTasks?: number
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
    deskFileCount: 12,
    skillsInstalled: 8,
    cronTasks: 3,
    lastActiveAt: Date.now() - 60000,
    config: { workflowPackId: 'workflow.oss-minimal.v1', policyPackId: 'policy.oss-minimal.v1' },
  },
  {
    agentId: 'agent:third-party-sample',
    displayName: 'Third-Party Sample',
    roles: ['executor'],
    status: 'idle',
    heartbeatMs: 3420,
    memorySize: 892,
    deskFileCount: 3,
    skillsInstalled: 2,
    cronTasks: 0,
    lastActiveAt: Date.now() - 300000,
    config: { workflowPackId: 'workflow.third-party.v1', policyPackId: 'policy.third-party.v1' },
  },
]

/* ─── Agent Runtime Card ─────────────────────────────────────── */

function statusInfo(s: AgentRuntime['status']) {
  return s === 'active' ? { label: '活跃', tone: 'success' as const }
    : s === 'busy' ? { label: '忙碌', tone: 'accent' as const }
    : s === 'degraded' ? { label: '降级', tone: 'danger' as const }
    : { label: '空闲', tone: 'default' as const }
}

function AgentRuntimeCard({ agent }: { agent: AgentRuntime }) {
  const st = statusInfo(agent.status)
  const ago = agent.lastActiveAt ? formatTime(Date.now() - agent.lastActiveAt) + '前' : '—'

  return (
    <article className="surface-card-interactive p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Bot size={16} /></div>
        <span className="truncate text-[14px] font-semibold text-[var(--fg)]">{agent.displayName}</span>
        <Chip value={st.label} tone={st.tone} />
      </div>
      <div className="mt-0.5 text-[10px] font-mono text-[var(--fg-muted)]">{agent.agentId}</div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {agent.roles.map((r) => (
          <span key={r} className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] text-[var(--fg-secondary)]">{roleLabel(r)}</span>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <MetricBox icon={<Heart size={10} />} label="心跳" value={agent.heartbeatMs ? `${agent.heartbeatMs}ms` : '—'} />
        <MetricBox label="记忆" value={agent.memorySize ? `${agent.memorySize} 条` : '—'} />
        <MetricBox label="活跃" value={ago} />
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <MetricBox icon={<FolderOpen size={10} />} label="书桌" value={agent.deskFileCount ?? '—'} />
        <MetricBox icon={<Puzzle size={10} />} label="技能" value={agent.skillsInstalled ?? '—'} />
        <MetricBox icon={<Calendar size={10} />} label="定时" value={agent.cronTasks ?? '—'} />
      </div>

      {agent.config && (
        <div className="mt-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-2">
          <div className="text-[9px] font-medium text-[var(--fg-ghost)]">运行时配置</div>
          <div className="mt-1 space-y-0.5 text-[9px] font-mono text-[var(--fg-muted)]">
            {agent.config.workflowPackId && <div>workflow: {agent.config.workflowPackId}</div>}
            {agent.config.policyPackId && <div>policy: {agent.config.policyPackId}</div>}
          </div>
        </div>
      )}
    </article>
  )
}

/* ─── Agent Desk View ────────────────────────────────────────── */

interface DeskFile { name: string; type: 'markdown' | 'json' | 'code' | 'other'; size: number; updatedAt: number }

const MOCK_DESK: DeskFile[] = [
  { name: 'agent-persona.md', type: 'markdown', size: 2048, updatedAt: Date.now() - 3600000 },
  { name: 'current-task.md', type: 'markdown', size: 1024, updatedAt: Date.now() - 7200000 },
  { name: 'workspace-config.json', type: 'json', size: 512, updatedAt: Date.now() - 86400000 },
  { name: 'notes.md', type: 'markdown', size: 3072, updatedAt: Date.now() - 172800000 },
]

function deskIcon(t: DeskFile['type']) {
  return t === 'markdown' ? <FileText size={14} className="text-[var(--accent)]" />
    : t === 'json' ? <Terminal size={14} className="text-[var(--warning)]" />
    : t === 'code' ? <Terminal size={14} className="text-[var(--success)]" />
    : <FileText size={14} className="text-[var(--fg-muted)]" />
}

function AgentDeskView() {
  return (
    <div className="space-y-4">
      <div className="surface-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-semibold text-[var(--fg)]">Agent 书桌</div>
            <div className="text-[11px] text-[var(--fg-muted)]">异步协作空间 · 文件与便签</div>
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--fg-secondary)] transition hover:bg-[var(--surface-subtle)]">
            <FolderOpen size={14} />打开书桌
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {MOCK_DESK.map((f) => (
            <div key={f.name} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                {deskIcon(f.type)}
                <span className="truncate text-[12px] font-medium text-[var(--fg)]">{f.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-[var(--fg-muted)]">{f.size < 1024 ? `${f.size}B` : `${Math.round(f.size / 1024)}KB`}</span>
                <span className="text-[10px] text-[var(--fg-ghost)]">{formatTime(Date.now() - f.updatedAt)}前</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="surface-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><CheckCircle2 size={16} /></div>
          <div>
            <div className="text-[13px] font-semibold text-[var(--fg)]">书桌能力</div>
            <div className="text-[11px] text-[var(--fg-muted)]">文件读写 · 便签自动读取 · 拖拽上传</div>
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {[
            { title: '文件预览', desc: 'Markdown / JSON / 代码' },
            { title: 'Agent 主动读取', desc: '巡检文件变化' },
            { title: '拖拽上传', desc: '快速分享文件' },
          ].map((c) => (
            <div key={c.title} className="rounded-lg bg-[var(--surface-subtle)] p-3">
              <div className="text-[11px] font-medium text-[var(--fg)]">{c.title}</div>
              <div className="mt-0.5 text-[10px] text-[var(--fg-muted)]">{c.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Onboarding guide ───────────────────────────────────────── */

function OnboardingGuide() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Package size={18} /></div>
        <div>
          <div className="text-[14px] font-semibold text-[var(--fg)]">Agent 接入指南</div>
          <div className="text-[11px] text-[var(--fg-muted)]">通过标准合同协议接入 Team Runtime</div>
        </div>
      </div>

      <div className="space-y-2.5">
        {[
          { step: '1', title: '准备 Agent Manifest', desc: '声明 runtime / provider / role / host contract', file: 'agent-manifest.json' },
          { step: '2', title: '准备 Agent Package', desc: '声明 session / desk / bridge / lifecycle / plugin', file: 'agent-package.json' },
          { step: '3', title: '实现 Provider Registry', desc: 'model / tool / memory / sandbox / events provider', file: 'provider-registry.mjs' },
          { step: '4', title: '通过 Doctor 检查', desc: '运行 activation checklist 确认所有合同就绪', cmd: 'npm run status:oss-minimal' },
          { step: '5', title: '注册并上线', desc: '通过心跳接口注册到 Team Runtime' },
        ].map((item) => (
          <div key={item.step} className="surface-card-subtle flex items-start gap-3 p-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[10px] font-bold text-[var(--accent)]">{item.step}</div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-[var(--fg)]">{item.title}</div>
              <div className="mt-0.5 text-[10px] text-[var(--fg-muted)]">{item.desc}</div>
              {item.file && <code className="mt-1 inline-block rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--fg-secondary)]">{item.file}</code>}
              {item.cmd && <code className="mt-1 inline-block rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--fg-secondary)]">$ {item.cmd}</code>}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
        <div className="text-[10px] font-medium text-[var(--fg-ghost)]">参考文档</div>
        <div className="mt-1.5 space-y-1 text-[10px] text-[var(--fg-muted)]">
          <div>📦 <code className="text-[var(--fg-secondary)]">examples/oss-minimal/</code> — 最小可运行示例</div>
          <div>🧩 <code className="text-[var(--fg-secondary)]">examples/third-party-agent-sample/</code> — 第三方接入模板</div>
        </div>
      </div>
    </div>
  )
}

/* ─── Tab type ───────────────────────────────────────────────── */

type AgentTab = 'runtime' | 'nodes' | 'desk' | 'onboarding'

/* ─── Main export ────────────────────────────────────────────── */

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
      const rawNodes = json?.payload?.nodes || json?.nodes || {}
      const deployment = json?.payload?.deployment || json?.deployment || {}
      const labels: Record<string, string> = { laoda: 'Laoda', violet: 'Violet', lebang: 'Lebang' }
      const list = Object.entries(rawNodes)
        .filter(([key, value]) => key !== 'ts' && value && typeof value === 'object')
        .map(([key, value]: [string, any]) => ({
          key,
          label: labels[key] || key,
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
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface)]/95 px-3 py-2.5 md:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            {([
              { id: 'runtime' as AgentTab, label: 'Agent 运行时' },
              { id: 'nodes' as AgentTab, label: '节点状态' },
              { id: 'desk' as AgentTab, label: 'Agent 书桌' },
              { id: 'onboarding' as AgentTab, label: '接入指南' },
            ]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'touch-manipulation rounded-full border px-3 py-1 text-[11px] font-medium transition',
                  tab === t.id
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)] hover:border-[var(--border)] hover:text-[var(--fg)]'
                )}
              >{t.label}</button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 text-[11px]">
            {tab === 'runtime' && <><span className="text-[var(--fg-ghost)]">活跃</span><span className="rounded-full bg-[var(--success-soft)] px-2 py-0.5 font-medium text-[var(--success)]">{agentMet.active}/{agentMet.total}</span></>}
            {tab === 'nodes' && <><span className="text-[var(--fg-ghost)]">在线</span><span className="rounded-full bg-[var(--success-soft)] px-2 py-0.5 font-medium text-[var(--success)]">{nodeMet.online}/{nodeMet.total}</span></>}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-3 md:p-5">
          {tab === 'runtime' && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {agents.map((a) => <AgentRuntimeCard key={a.agentId} agent={a} />)}
            </div>
          )}
          {tab === 'nodes' && (
            loading && entries.length === 0
              ? <div className="surface-card p-8 text-center text-[12px] text-[var(--fg-muted)]">节点加载中…</div>
              : entries.length === 0
                ? <div className="surface-card p-8 text-center text-[12px] text-[var(--fg-muted)]">暂无节点数据</div>
                : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{entries.map((n) => <NodeCard key={n.key} nodeKey={n.key} node={n} />)}</div>
          )}
          {tab === 'desk' && <AgentDeskView />}
          {tab === 'onboarding' && <OnboardingGuide />}
        </div>
      </div>
    </div>
  )
}
