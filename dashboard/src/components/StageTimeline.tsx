'use client'

import { useMemo } from 'react'
import { Brain, Shield, Scale, Play, CheckCircle, XCircle, Loader2, Sparkles, Users, FileOutput } from 'lucide-react'
import { stateLabel as stateLabelFn } from '@/lib/utils'

type StageKey = 'planning' | 'plan_review' | 'approved' | 'executing' | 'done'

interface StageConfig {
  key: StageKey
  label: string
  icon: typeof Brain
  states: string[]
}

const PIPELINE_STAGES: StageConfig[] = [
  { key: 'planning', label: '规划中', icon: Brain, states: ['planning'] },
  { key: 'plan_review', label: '评审中', icon: Shield, states: ['plan_review'] },
  { key: 'approved', label: '已批准', icon: Scale, states: ['approved'] },
  { key: 'executing', label: '执行推进', icon: Play, states: ['approved'] },
  { key: 'done', label: '已完成', icon: CheckCircle, states: ['done'] },
]

// Coordinator-driven stages: simpler, reflects actual control flow
type TLStageKey = 'analyzing' | 'delegating' | 'executing' | 'summarizing' | 'done'

interface TLStageConfig {
  key: TLStageKey
  label: string
  icon: typeof Brain
}

const TL_STAGES: TLStageConfig[] = [
  { key: 'analyzing', label: '总控分析', icon: Sparkles },
  { key: 'delegating', label: '分配成员', icon: Users },
  { key: 'executing', label: '执行中', icon: Play },
  { key: 'summarizing', label: '汇总结果', icon: FileOutput },
  { key: 'done', label: '已完成', icon: CheckCircle },
]

function normalizeRole(role: string): string {
  return String(role || '').trim().toLowerCase().split(/[.:]/)[0] || ''
}

function deriveStageIndex(state: string, lastRole: string): number {
  const role = normalizeRole(lastRole)
  switch (state) {
    case 'pending': return -1
    case 'planning': return 0
    case 'plan_review': return 1
    case 'approved':
      return ['executor', 'output'].includes(role) ? 3 : 2
    case 'done': return 4
    case 'revision_requested': return 0
    case 'blocked': return -2
    case 'cancelled': return -2
    default: return -1
  }
}

/** Translate known internal values in stage messages */
function translateStageMessage(msg: string): string {
  if (!msg) return ''
  const map: Record<string, string> = {
    wait_for_plan: '等待规划',
    run_critic_review: '评审中',
    run_judge_decision: '裁决中',
    revise_plan: '修订计划',
    human_intervention: '需人工介入',
    deliver_or_archive: '交付或归档',
    deliver_output: '交付产物',
    judge_with_notes: '附注裁决',
    inspect_evidence: '审查证据',
    auto_skip_judge_non_high_risk: '低风险自动裁决通过',
    auto_skip_low_risk: '低风险自动跳过',
  }
  return map[msg] || msg
}

function deriveTLStageIndex(state: string, lastMessage: string, lastRole: string): number {
  const msg = String(lastMessage || '').toLowerCase()
  const role = String(lastRole || '').toLowerCase()
  if (state === 'done') return 4
  // Detect from event content
  if (msg.includes('汇总') || msg.includes('summariz')) return 3
  if (msg.includes('执行中') || msg.includes('执行完成') || msg.includes('execution.progress')) return 2
  if (msg.includes('分配') || msg.includes('delegate')) return 1
  if (role.includes('tl') || msg.includes('分析') || msg.includes('analyz')) return 0
  if (state === 'approved') return 2
  if (state === 'planning') return 0
  return -1
}

function isTLDriven(lastRole: string, lastMessage: string): boolean {
  const role = String(lastRole || '').toLowerCase()
  const msg = String(lastMessage || '').toLowerCase()
  return role === 'tl' || msg.includes('tl ') || msg.includes('tl分析') || msg.includes('tl 分析') || msg.includes('tl.decision') || msg.includes('tl.analyzed')
}

interface Props {
  state: string
  lastMessage?: string
  lastRole?: string
  compact?: boolean
}

export function StageTimeline({ state, lastMessage = '', lastRole = '', compact = false }: Props) {
  const tlMode = isTLDriven(lastRole, lastMessage)
  const stages = tlMode ? TL_STAGES : PIPELINE_STAGES
  const currentIndex = tlMode
    ? deriveTLStageIndex(state, lastMessage, lastRole)
    : deriveStageIndex(state, lastRole)
  const isCancelled = state === 'cancelled' || state === 'blocked'
  const isDone = state === 'done'
  const translatedMsg = translateStageMessage(lastMessage)

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--danger)]/20 bg-[var(--danger)]/5 px-3 py-2">
        <XCircle className="h-4 w-4 text-[var(--danger)]" />
        <span className="text-xs font-medium text-[var(--danger)]">
          {stateLabelFn(state as any)}
        </span>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {stages.map((stage, idx) => {
          const isCompleted = idx < currentIndex
          const isActive = idx === currentIndex
          const Icon = stage.icon
          return (
            <div key={stage.key} className="flex items-center gap-0.5">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full shadow-[var(--shadow-xs)] transition-all ${
                  isCompleted
                    ? 'bg-[var(--success)] text-white'
                    : isActive
                      ? isDone
                        ? 'bg-[var(--success)] text-white'
                        : 'bg-[var(--accent)] text-white animate-pulse'
                      : 'bg-[var(--border)] text-[var(--fg-muted)]'
                }`}
              >
                {isActive && !isDone && !isCompleted ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : (
                  <Icon className="h-2.5 w-2.5" />
                )}
              </div>
              {idx < stages.length - 1 && (
                <div className={`h-px w-4 ${isCompleted || isDone ? 'bg-[var(--success)]' : 'bg-[var(--border)]'}`} />
              )}
            </div>
          )
        })}
        {translatedMsg && (
          <span className="ml-1 max-w-[220px] truncate text-[10px] text-[var(--fg-muted)]">{translatedMsg}</span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {stages.map((stage, idx) => {
        const isCompleted = idx < currentIndex
        const isActive = idx === currentIndex
        const Icon = stage.icon
        return (
          <div key={stage.key} className="flex items-center gap-2.5">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all ${
                isCompleted
                  ? 'bg-[var(--success)] text-white'
                  : isActive
                    ? isDone
                      ? 'bg-[var(--success)] text-white'
                      : 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--surface-subtle)] border border-[var(--border)] text-[var(--fg-muted)]'
              }`}
            >
              {isActive && !isDone && !isCompleted ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span className={`text-[13px] font-medium ${isDone && isActive ? 'text-[var(--success)]' : isActive ? 'text-[var(--fg)]' : isCompleted ? 'text-[var(--success)]' : 'text-[var(--fg-secondary)]'}`}>
                {stage.label}
              </span>
              {isActive && translatedMsg && (
                <div className="mt-0.5 truncate text-[11px] text-[var(--fg-muted)]">{translatedMsg}</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
