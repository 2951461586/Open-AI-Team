'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Image, { type StaticImageData } from 'next/image'
import {
  Bot, RefreshCw, Shield, Zap, Activity, AlertTriangle,
  Clock, Server, ChevronDown, ChevronRight, Package, Cpu,
  Heart, Wifi, WifiOff, GlobeLock,
} from 'lucide-react'
import { cn, roleLabel, formatTime, nodeLabel, probeLatencyLabel, nodeServiceStatusLabel } from '@/lib/utils'
import { useTaskStore } from '@/lib/store'
import { fetchNodes } from '@/lib/api'
import { NodeSummary, NodeConnectivityInfo, NodeSystemStats } from '@/lib/types'
import laodaAvatar from '@/assets/node-avatars/laoda.png'
import violetAvatar from '@/assets/node-avatars/violet.png'
import lebangAvatar from '@/assets/node-avatars/lebang.png'

/* ─── Node helpers ───────────────────────────────────────────── */

const nodeAvatarMap: Record<string, StaticImageData> = { laoda: laodaAvatar, violet: violetAvatar, lebang: lebangAvatar }
const dotMap: Record<string, string> = { laoda: 'bg-[var(--node-laoda)]', violet: 'bg-[var(--node-violet)]', lebang: 'bg-[var(--success)]' }
const nodeAvatarRingMap: Record<string, string> = { laoda: 'ring-[var(--node-laoda)]/30', violet: 'ring-[var(--node-violet)]/30', lebang: 'ring-[var(--success)]/30' }

function MiniChip({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'success' | 'warning' | 'accent' | 'danger' }) {
  const toneClass = tone === 'success'
    ? 'border-[var(--success)]/20 bg-[var(--success-soft)] text-[var(--success)]'
    : tone === 'warning'
      ? 'border-[var(--warning)]/20 bg-[var(--warning-soft)] text-[var(--warning)]'
      : tone === 'accent'
        ? 'border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent)]'
        : tone === 'danger'
          ? 'border-[var(--danger)]/20 bg-[var(--danger-soft)] text-[var(--danger)]'
          : 'border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${toneClass}`}>
      <span className="text-[var(--fg-ghost)]">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  )
}

function pressureBadge(stats: NodeSystemStats) {
  const load1 = Number(stats.load1 || 0)
  const mem = Number(stats.memoryUsedPercent || 0)
  const disk = Number(stats.diskUsedPercent || 0)
  if (load1 >= 2 || mem >= 85 || disk >= 90) return { label: '高压', tone: 'danger' as const }
  if (load1 >= 1 || mem >= 70 || disk >= 75) return { label: '中压', tone: 'warning' as const }
  if (load1 > 0 || mem > 0 || disk > 0) return { label: '低压', tone: 'success' as const }
  return { label: '待同步', tone: 'default' as const }
}

function metricTone(kind: 'load' | 'memory' | 'disk', value?: number) {
  const n = Number(value || 0)
  if (kind === 'load') return n >= 2 ? 'danger' as const : n >= 1 ? 'warning' as const : 'success' as const
  if (kind === 'memory') return n >= 85 ? 'danger' as const : n >= 70 ? 'warning' as const : 'success' as const
  if (kind === 'disk') return n >= 90 ? 'danger' as const : n >= 75 ? 'warning' as const : 'success' as const
  return 'default' as const
}

function buildCapability(node: NodeSummary) {
  if (node.reachable && Number(node.activeResidentCount || 0) > 0) return { label: '在线承接', tone: 'success' as const }
  if (node.reachable) return { label: '在线待命', tone: 'accent' as const }
  return { label: '待恢复', tone: 'warning' as const }
}

/* ─── Node card (compact) ────────────────────────────────────── */

function NodeCard({ nodeKey, node }: { nodeKey: string; node: NodeSummary }) {
  const stats = (node.stats || {}) as NodeSystemStats
  const connectivity = (node.connectivity || {}) as NodeConnectivityInfo
  const capability = buildCapability(node)
  const pressure = pressureBadge(stats)
  const residentRoles = (node.activeResidentRoles || []).map(r => roleLabel(r)).join('、') || '无驻留'
  const src = nodeAvatarMap[nodeKey]
  const ring = nodeAvatarRingMap[nodeKey] || 'ring-[var(--border)]'

  return (
    <article className="surface-card-interactive p-3.5">
      <div className="flex items-center gap-3">
        <div className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-xl ring-1 ${ring} bg-[var(--surface-subtle)]`}>
          {src ? (
            <Image src={src} alt={nodeLabel(nodeKey)} fill sizes="40px" className="object-cover" />
          ) : (
            <div className={`flex h-full w-full items-center justify-center text-[11px] font-semibold text-white ${dotMap[nodeKey] || 'bg-[var(--fg-ghost)]'}`}>
              {nodeLabel(nodeKey).slice(0, 1)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${node.reachable ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`} />
            <span className="truncate text-[13px] font-semibold text-[var(--fg)]">{nodeLabel(nodeKey)}</span>
            <MiniChip label="" value={capability.label} tone={capability.tone} />
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <MiniChip label="延迟" value={probeLatencyLabel(node.latencyMs)} />
            <MiniChip label="驻留" value={`${Number(node.activeResidentCount || 0)}`} tone={Number(node.activeResidentCount || 0) > 0 ? 'success' : 'default'} />
            <MiniChip label="压力" value={pressure.label} tone={pressure.tone} />
            {typeof stats.load1 === 'number' && <MiniChip label="负载" value={String(stats.load1)} tone={metricTone('load', stats.load1)} />}
            {typeof stats.memoryUsedPercent === 'number' && <MiniChip label="内存" value={`${stats.memoryUsedPercent}%`} tone={metricTone('memory', stats.memoryUsedPercent)} />}
          </div>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-[var(--fg-muted)]">
        角色：{residentRoles}
      </div>
    </article>
  )
}

/* ─── Onboarding guide ───────────────────────────────────────── */

function OnboardingGuide() {
  return (
    <div className="animate-fade-in space-y-4 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Package size={18} />
        </div>
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
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[10px] font-bold text-[var(--accent)]">
              {item.step}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-[var(--fg)]">{item.title}</div>
              <div className="mt-0.5 text-[10px] text-[var(--fg-muted)]">{item.desc}</div>
              {item.file && (
                <code className="mt-1 inline-block rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--fg-secondary)]">
                  {item.file}
                </code>
              )}
              {item.cmd && (
                <code className="mt-1 inline-block rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--fg-secondary)]">
                  $ {item.cmd}
                </code>
              )}
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

type AgentTab = 'nodes' | 'onboarding'

/* ─── Main export ────────────────────────────────────────────── */

export function AgentsView() {
  const nodes = useTaskStore((s) => s.nodes)
  const [tab, setTab] = useState<AgentTab>('nodes')
  const [loading, setLoading] = useState(false)

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

  const entries = useMemo(() => {
    return [...nodes].sort((a, b) => {
      if (!!a.recommended !== !!b.recommended) return a.recommended ? -1 : 1
      return (Number(b.weight || 0)) - (Number(a.weight || 0))
    })
  }, [nodes])

  const metrics = useMemo(() => {
    const total = entries.length
    const online = entries.filter((n) => n.reachable).length
    const residentCount = entries.reduce((sum, n) => sum + Number(n.activeResidentCount || 0), 0)
    return { total, online, residentCount }
  }, [entries])

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 py-2.5 backdrop-blur md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2">
              {metrics.online > 0 ? <Wifi size={14} className="text-[var(--success)]" /> : <WifiOff size={14} className="text-[var(--warning)]" />}
              <span className="text-[13px] font-semibold text-[var(--fg)]">Agent · 节点</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MiniChip label="节点" value={`${metrics.online}/${metrics.total}`} tone="success" />
              <MiniChip label="驻留" value={`${metrics.residentCount}`} tone={metrics.residentCount > 0 ? 'accent' : 'default'} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-0.5">
              {([
                { id: 'nodes' as AgentTab, label: '节点状态' },
                { id: 'onboarding' as AgentTab, label: '接入指南' },
              ]).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[10px] font-medium transition',
                    tab === t.id
                      ? 'bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-xs)]'
                      : 'text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={loadNodes}
              disabled={loading}
              className="btn-ghost gap-1"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto panel-scroll">
        {tab === 'nodes' && (
          <div className="p-4 md:p-6 space-y-3">
            {loading && entries.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw size={18} className="animate-spin text-[var(--fg-ghost)]" />
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Server size={28} className="text-[var(--fg-ghost)]" />
                <div className="mt-3 text-[13px] font-semibold text-[var(--fg)]">暂无节点数据</div>
                <div className="mt-1 text-[11px] text-[var(--fg-muted)]">节点数据加载中</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {entries.map((node) => (
                  <NodeCard key={node.key} nodeKey={node.key} node={node} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'onboarding' && (
          <OnboardingGuide />
        )}
      </div>
    </div>
  )
}
