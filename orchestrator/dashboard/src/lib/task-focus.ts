import type { FocusOpenTab, FocusTarget, FocusIntent, TaskFocusRef, TaskFocusTarget } from './types'
import { roleLabel } from './utils'

type FocusSource = TaskFocusRef | Record<string, any> | null | undefined

const TASK_FOCUS_ASSIGNMENT_KEY = 'assignmentId'
const TASK_FOCUS_CHILD_TASK_KEY = 'childTaskId'

export function focusAssignmentId(source?: FocusSource): string {
  const record = source as Record<string, any> | null | undefined
  return String(record?.[TASK_FOCUS_ASSIGNMENT_KEY] || '').trim()
}

export function focusChildTaskId(source?: FocusSource): string {
  const record = source as Record<string, any> | null | undefined
  return String(record?.[TASK_FOCUS_CHILD_TASK_KEY] || '').trim()
}

export function pickTaskFocusRef(source?: FocusSource): TaskFocusRef {
  const assignmentId = focusAssignmentId(source)
  const childTaskId = focusChildTaskId(source)
  return {
    assignmentId: assignmentId || undefined,
    childTaskId: childTaskId || undefined,
  }
}

export function hasTaskFocus(source?: FocusSource): boolean {
  return Boolean(focusAssignmentId(source) || focusChildTaskId(source))
}

export function focusSummaryLabel(target?: Pick<TaskFocusTarget, 'intent' | 'targetRole' | 'summary' | 'sourceKind'> | null): string {
  if (!target) return ''
  const intentText = target.intent === 'retry' ? '已定位到重试项。' : target.intent === 'replan' ? '已定位到重排项。' : '已定位到当前子任务。'
  const roleText = target.targetRole ? ` 当前责任角色：${roleLabel(target.targetRole)}。` : ''
  const sourceText = target.sourceKind === 'replan' ? ' 来源：局部重排。' : target.sourceKind === 'timeline' ? ' 来源：进展定位。' : ''
  const summaryText = target.summary ? ` 摘要：${String(target.summary).trim()}` : ''
  return `${intentText}${roleText}${sourceText}${summaryText}`.trim()
}

export function withFocusOpenTab(target: FocusTarget | null | undefined, openTab: FocusOpenTab): FocusTarget | null {
  if (!target) return null
  return { ...target, openTab }
}

export function makeTaskFocusTarget(base?: Partial<TaskFocusTarget> | null): TaskFocusTarget {
  return {
    ...pickTaskFocusRef(base as FocusSource),
    intent: (base?.intent as FocusIntent | undefined) || undefined,
    openTab: (base?.openTab as FocusOpenTab | undefined) || undefined,
    targetRole: String(base?.targetRole || '').trim() || undefined,
    summary: String(base?.summary || '').trim() || undefined,
    sourceKind: base?.sourceKind,
    timelineMessageId: String(base?.timelineMessageId || '').trim() || undefined,
    replanCreatedAt: typeof base?.replanCreatedAt === 'number' ? base.replanCreatedAt : undefined,
  }
}
