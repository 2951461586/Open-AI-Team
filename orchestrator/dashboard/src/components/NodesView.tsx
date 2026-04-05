'use client'

import Image from 'next/image'
import { useMemo } from 'react'
import {
  GlobeLock,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useTaskStore } from '@/lib/store'
import { NodeConnectivityInfo, NodeSummary, NodeSystemStats } from '@/lib/types'
import { nodeLabel, nodeServiceStatusLabel, probeLatencyLabel, roleLabel } from '@/lib/utils'

const dotMap: Record<string, string> = {
  laoda: 'bg-[var(--node-laoda)]',
  violet: 'bg-[var(--node-violet)]',
  lebang: 'bg-[var(--success)]',
}

const nodeAvatarMap: Record<string, string> = {
  laoda: '/node-avatars/laoda.png',
  violet: '/node-avatars/violet.png',
  lebang: '/node-avatars/lebang.png',
}

const nodeAvatarRingMap: Record<string, string> = {
  laoda: 'ring-[var(--node-laoda)]/30',
  violet: 'ring-[var(--node-violet)]/30',
  lebang: 'ring-[var(--success)]/30',
}

const nodeAvatarGlowMap: Record<string, string> = {
  laoda: 'shadow-[0_10px_30px_rgba(107,127,202,0.22)]',
  violet: 'shadow-[0_10px_30px_rgba(155,126,212,0.22)]',
  lebang: 'shadow-[0_10px_30px_rgba(107,175,140,0.22)]',
}

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
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${toneClass}`}>
      <span className="text-[var(--fg-ghost)]">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  )
}

function NodeAvatar({ nodeKey }: { nodeKey: string }) {
  const src = nodeAvatarMap[nodeKey]
  const ring = nodeAvatarRingMap[nodeKey] || 'ring-[var(--border)]'
  const glow = nodeAvatarGlowMap[nodeKey] || 'shadow-[var(--shadow-sm)]'

  return (
    <div className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl ring-1 ${ring} ${glow} bg-[var(--surface-subtle)]`}>
      {src ? (
        <Image
          src={src}
          alt={`${nodeLabel(nodeKey)} 头像`}
          fill
          sizes="56px"
          className="object-cover"
          priority
        />
      ) : (
        <div className={`flex h-full w-full items-center justify-center text-sm font-semibold text-white ${dotMap[nodeKey] || 'bg-[var(--fg-ghost)]'}`}>
          {nodeLabel(nodeKey).slice(0, 1)}
        </div>
      )}
    </div>
  )
}

function connectivityModeLabel(mode?: string) {
  const raw = String(mode || '').trim().toLowerCase()
  if (!raw) return '本机直连'
  if (raw === 'tailnet_https_gateway') return '远端入口'
  return raw.replaceAll('_', ' ')
}

function routeModeTone(mode?: string) {
  const raw = String(mode || '').trim().toLowerCase()
  if (raw === 'tailnet_https_gateway') return 'accent' as const
  if (!raw) return 'success' as const
  return 'default' as const
}

function buildCapability(node: NodeSummary) {
  if (node.reachable && Number(node.activeResidentCount || 0) > 0) return { label: '在线承接', tone: 'success' as const }
  if (node.reachable) return { label: '在线待命', tone: 'accent' as const }
  return { label: '待恢复', tone: 'warning' as const }
}

function pressureSeverity(stats: NodeSystemStats) {
  const load1 = Number(stats.load1 || 0)
  const mem = Number(stats.memoryUsedPercent || 0)
  const disk = Number(stats.diskUsedPercent || 0)
  let level = 0
  if (load1 >= 2 || mem >= 85 || disk >= 90) level = Math.max(level, 3)
  else if (load1 >= 1 || mem >= 70 || disk >= 75) level = Math.max(level, 2)
  else if (load1 > 0 || mem > 0 || disk > 0) level = Math.max(level, 1)
  return level
}

function pressureBadge(stats: NodeSystemStats) {
  const level = pressureSeverity(stats)
  if (level >= 3) return { label: '高压', tone: 'danger' as const }
  if (level === 2) return { label: '中压', tone: 'warning' as const }
  if (level === 1) return { label: '低压', tone: 'success' as const }
  return { label: '待同步', tone: 'default' as const }
}

function metricTone(kind: 'load' | 'memory' | 'disk', value?: number) {
  const n = Number(value || 0)
  if (kind === 'load') {
    if (n >= 2) return 'danger' as const
    if (n >= 1) return 'warning' as const
    return 'success' as const
  }
  if (kind === 'memory') {
    if (n >= 85) return 'danger' as const
    if (n >= 70) return 'warning' as const
    return 'success' as const
  }
  if (kind === 'disk') {
    if (n >= 90) return 'danger' as const
    if (n >= 75) return 'warning' as const
    return 'success' as const
  }
  return 'default' as const
}

function buildHostMetrics(stats: NodeSystemStats) {
  const items: Array<{ label: string; value: string; tone?: 'default' | 'success' | 'warning' | 'accent' | 'danger' }> = []
  if (typeof stats.load1 === 'number') items.push({ label: '负载', value: String(stats.load1), tone: metricTone('load', stats.load1) })
  if (typeof stats.memoryUsedPercent === 'number') items.push({ label: '内存', value: `${stats.memoryUsedPercent}%`, tone: metricTone('memory', stats.memoryUsedPercent) })
  if (typeof stats.diskUsedPercent === 'number') items.push({ label: '磁盘', value: `${stats.diskUsedPercent}%`, tone: metricTone('disk', stats.diskUsedPercent) })
  if (stats.uptimeHuman) items.push({ label: '运行', value: stats.uptimeHuman, tone: 'default' })
  return items
}

function buildResidentSummary(roles: string[]) {
  if (!roles.length) return '当前没有驻留 Agent'
  return roles.map((role) => roleLabel(role)).join('、')
}

function NodeCard({ nodeKey, node }: { nodeKey: string; node: NodeSummary }) {
  const stats = (node.stats || {}) as NodeSystemStats
  const connectivity = (node.connectivity || {}) as NodeConnectivityInfo
  const capability = buildCapability(node)
  const hostMetrics = buildHostMetrics(stats)
  const pressure = pressureBadge(stats)
  const residentRoles = node.activeResidentRoles || []
  const residentSummary = buildResidentSummary(residentRoles)
  const preferredRoles = buildResidentSummary(node.preferredRoles || [])
  const fallbackRoles = buildResidentSummary(node.fallbackRoles || [])
  const serviceLabel = nodeServiceStatusLabel({ reachable: node.reachable, probe: node.probe, controlPlaneStatus: stats.controlPlaneStatus })
  const routeLabel = connectivityModeLabel(connectivity.mode)
  const hostAddress = String(connectivity.tailnetHost || connectivity.controlHost || stats.host || '').trim() || '—'
  const gatewayAddress = String(connectivity.controlBaseUrl || '').trim() || '本机无需单独入口'
  const weightLabel = typeof node.weight === 'number' ? `${node.weight}` : '--'
  const reasonLabel = String(node.pressureReason || '').trim() || '待评估'

  return (
    <article className="surface-card min-w-0 overflow-hidden p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-1 items-start gap-3">
          <NodeAvatar nodeKey={nodeKey} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotMap[nodeKey] || 'bg-[var(--fg-ghost)]'}`} />
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold text-[var(--fg)]">{nodeLabel(nodeKey)}</div>
                <div className="mt-1 text-[11px] text-[var(--fg-muted)]">{serviceLabel}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {node.recommended ? <MiniChip label="推荐" value="优先承接" tone="accent" /> : null}
          <MiniChip label="状态" value={capability.label} tone={capability.tone} />
          <MiniChip label="路由" value={routeLabel} tone={routeModeTone(connectivity.mode)} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <MiniChip label="延迟" value={probeLatencyLabel(node.latencyMs)} />
        <MiniChip label="驻留" value={`${Number(node.activeResidentCount || 0)} 个`} tone={Number(node.activeResidentCount || 0) > 0 ? 'success' : 'default'} />
        <MiniChip label="调度分" value={weightLabel} tone={node.recommended ? 'accent' : 'default'} />
        <MiniChip label="压力" value={pressure.label} tone={pressure.tone} />
        {hostMetrics.length > 0 ? hostMetrics.map((item) => (
          <MiniChip key={item.label} label={item.label} value={item.value} tone={item.tone || 'default'} />
        )) : <MiniChip label="主机压力" value="指标待同步" tone="warning" />}
      </div>

      <div className="mt-3 space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3.5 py-3 text-[12px] leading-5 text-[var(--fg-secondary)]">
        <div className="flex items-start justify-between gap-3">
          <span className="shrink-0 text-[var(--fg-ghost)]">入口</span>
          <span className="min-w-0 text-right font-mono text-[11px] text-[var(--fg)]">{gatewayAddress}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="shrink-0 text-[var(--fg-ghost)]">主机</span>
          <span className="min-w-0 text-right font-mono text-[11px] text-[var(--fg)]">{hostAddress}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="shrink-0 text-[var(--fg-ghost)]">角色</span>
          <span className="min-w-0 text-right text-[var(--fg)]">{residentSummary}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="shrink-0 text-[var(--fg-ghost)]">调度判断</span>
          <span className="min-w-0 text-right text-[var(--fg)]">{reasonLabel}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="shrink-0 text-[var(--fg-ghost)]">优先角色</span>
          <span className="min-w-0 text-right text-[var(--fg)]">{preferredRoles}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="shrink-0 text-[var(--fg-ghost)]">兜底角色</span>
          <span className="min-w-0 text-right text-[var(--fg)]">{fallbackRoles}</span>
        </div>
      </div>
    </article>
  )
}

export function NodesView() {
  const nodes = useTaskStore((s) => s.nodes)

  const entries = useMemo(() => {
    const rows = nodes.map((node) => [node.key, node] as [string, NodeSummary])
    return rows.sort((a, b) => {
      const av = a[1]
      const bv = b[1]
      if (!!av.recommended !== !!bv.recommended) return av.recommended ? -1 : 1
      const aw = Number(av.weight || 0)
      const bw = Number(bv.weight || 0)
      if (aw !== bw) return bw - aw
      return String(a[0]).localeCompare(String(b[0]))
    })
  }, [nodes])

  const metrics = useMemo(() => {
    const total = entries.length
    const online = entries.filter(([, node]) => !!node?.reachable).length
    const ready = entries.filter(([, node]) => !!node?.reachable && Number(node?.activeResidentCount || 0) > 0).length
    const remoteIngress = entries.filter(([, node]) => String(node?.connectivity?.mode || '').trim().toLowerCase() === 'tailnet_https_gateway').length
    const residentCount = entries.reduce((sum, [, node]) => sum + Number(node?.activeResidentCount || 0), 0)
    return { total, online, ready, remoteIngress, residentCount }
  }, [entries])

  if (entries.length === 0) {
    return (
      <div className="mx-auto w-full max-w-7xl px-3 py-3 md:px-6 md:py-6">
        <div className="surface-card flex items-center gap-2 p-6 text-sm text-[var(--fg-muted)]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--warning)]" />
          加载中…
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 overflow-x-hidden px-3 pb-[calc(env(safe-area-inset-bottom,0px)+84px)] pt-3 md:px-6 md:pb-6 md:pt-6">
      <section className="surface-card p-4 md:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="panel-kicker">
              <GlobeLock className="h-3.5 w-3.5" /> 节点
            </div>
            <h2 className="panel-title mt-2 text-[18px]">三节点编队</h2>
            <div className="panel-note mt-1">三节点并排看状态、入口和压力；不再铺风险解释页。</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <MiniChip label="在线" value={`${metrics.online}/${metrics.total}`} tone="success" />
            <MiniChip label="可承接" value={`${metrics.ready}`} tone="accent" />
            <MiniChip label="远端入口" value={`${metrics.remoteIngress}`} tone="accent" />
            <MiniChip label="驻留 Agent" value={`${metrics.residentCount}`} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-[var(--fg)]">
            {metrics.online > 0 ? <Wifi className="h-4 w-4 text-[var(--accent)]" /> : <WifiOff className="h-4 w-4 text-[var(--warning)]" />}
            节点状态
          </div>
          <div className="text-[11px] text-[var(--fg-ghost)]">自动刷新：15s</div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {entries.map(([key, node]) => (
            <NodeCard key={key} nodeKey={key} node={node} />
          ))}
        </div>
      </section>
    </div>
  )
}
