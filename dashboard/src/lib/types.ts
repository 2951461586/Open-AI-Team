// ─── Task ───────────────────────────────────────────────────────────

export interface TaskCard {
  taskId: string
  teamId: string
  title: string
  state: TaskState
  updatedAt: number
  currentDriver: string
  currentMemberKey?: string
  nextBestAction: string
  latestReviewVerdict: Verdict | null
  latestDecisionType: DecisionType | null
  artifactCount: number
  evidenceCount: number
  issueCount: number
  deliverableReady: boolean
  humanInterventionReady: boolean
  deliveryStatus: string
  interventionStatus: string
  requestedNode?: string
  actualNode?: string
  degradedReason?: string
  sessionMode?: string
  sessionPersistent?: boolean
  sessionFallbackReason?: string
  planSummary: string
  executiveSummary: string
  protocolSource?: string
  acceptanceState?: string
  recommendedSurface?: string
}

export type TaskState =
  | 'pending'
  | 'planning'
  | 'plan_review'
  | 'approved'
  | 'revision_requested'
  | 'done'
  | 'cancelled'
  | 'blocked'

export type Verdict = 'approve' | 'approve_with_notes' | 'revise'

export type DecisionType = 'approve' | 'revise' | 'cancel' | 'escalate_human'

export interface Protocol {
  memberKey: string
  contractVersion: string
  outputType: string
}

// ─── Chat ───────────────────────────────────────────────────────────

export type ChatRole = 'user' | 'assistant' | 'planner' | 'critic' | 'judge' | 'executor' | 'output' | 'system'

export type ChatTransportStatus = 'connecting' | 'realtime' | 'fallback' | 'fallback_native' | 'fallback_template' | 'reconnecting' | 'offline'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: number
  status?: 'pending' | 'done' | 'error'
  node?: string
  scopeKey?: string
  /** streaming content chunk (for typing indicator) */
  streaming?: boolean
  /** associated taskId if message relates to a task */
  taskId?: string
  /** artifact metadata — if this message represents a task artifact/deliverable */
  artifactId?: string
  artifactType?: string
  artifactTitle?: string
  artifactFilePath?: string
  artifactDownloadText?: string
  artifactDownloadName?: string
  /** suppress collapse logic for this message */
  noCollapse?: boolean
}

export interface NodeConnectivityInfo {
  mode?: string
  controlBaseUrl?: string
  controlHost?: string
  controlPort?: number
  tailnetHost?: string
  tailnetIp?: string
  note?: string
}

export interface LegacyNodeConnectivityInfoCompat {
  /** legacy compatibility only; active UI should prefer controlBaseUrl */
  gatewayBaseUrl?: string
  /** legacy compatibility only; active UI should prefer controlHost */
  gatewayHost?: string
  /** legacy compatibility only; active UI should prefer controlPort */
  gatewayPort?: number
}

export type ThreadType = 'workspace' | 'task' | 'execution' | 'review' | 'decision'

export interface ChatSession {
  sessionId: string
  title: string
  /** icon for channel category: # general, @ task, ★ starred */
  icon?: string
  lastMessage: string
  updatedAt: number
  messageCount: number
  unreadCount?: number
  /** associated taskId if this session is task-scoped */
  taskId?: string
  /** stable logical thread id */
  threadId?: string
  /** conversation / task / review / execution semantics */
  threadType?: ThreadType
  /** parent thread if this is derived from a parent task thread */
  parentThreadId?: string
  /** current task phase snapshot for quick UI display */
  phase?: string
  /** thread goal / objective */
  goal?: string
  /** current owner / driver */
  owner?: string
  /** source task state */
  state?: string
  /** count of active blocking issues */
  blockingIssues?: number
  /** count of pending human decisions / actions */
  pendingHumanActions?: number
  /** latest deliverable artifact reference if available */
  latestDeliverableId?: string
  /** pinned to top of list */
  pinned?: boolean
  /** user explicitly opened this task channel */
  explicit?: boolean
  /** stable backend scope key for routing/isolation */
  scopeKey?: string
}

export interface ThreadSummaryItem {
  threadId: string
  taskId: string
  parentThreadId?: string
  threadType: ThreadType
  title: string
  state: string
  phase: string
  owner: string
  goal: string
  blockingIssues: number
  pendingHumanActions: number
  latestDeliverableId?: string
  updatedAt: number
}

export interface ThreadSummaryResponse {
  ok: boolean
  items: ThreadSummaryItem[]
}

export interface ThreadDetailResponse {
  ok: boolean
  thread: ThreadSummaryItem | null
  links?: {
    workbench?: string
    summary?: string
    control?: string
  }
}

// ─── Live Feed ──────────────────────────────────────────────────────

export interface LiveFlowEvent {
  id: string
  taskId: string
  type: string
  role: string
  node: string
  title: string
  content: string
  state: string
  timestamp: number
  eventKind?: string
  lane?: string
  sourceKind?: string
  confidence?: 'verified' | 'inferred' | 'template'
  subtaskId?: string
  artifactType?: string
  status?: string
  actorLabel?: string
  /** Elapsed milliseconds since execution started */
  elapsedMs?: number
  /** Bound session key for task-scoped execution */
  sessionKey?: string
  /** Child task/work item metadata for TL runtime v2+ */
  childTaskId?: string
  assignmentId?: string
  intent?: 'followup' | 'retry' | 'replan'
  layerIndex?: number
  layerLabel?: string
}

export interface TaskFocusRef {
  assignmentId?: string
  childTaskId?: string
}

export type FocusIntent = 'followup' | 'retry' | 'replan'
export type FocusOpenTab = 'chat' | 'timeline' | 'deliverables' | 'files'

export interface TaskFocusTarget extends TaskFocusRef {
  intent?: FocusIntent
  openTab?: FocusOpenTab
  targetRole?: string
  summary?: string
  sourceKind?: 'child_task' | 'timeline' | 'replan'
  timelineMessageId?: string
  replanCreatedAt?: number
}

export type FocusTarget = TaskFocusTarget

// ─── Subtask Progress ───────────────────────────────────────────────

export interface SubtaskEntry {
  subtaskId: string
  status: 'running' | 'done' | 'failed' | 'retrying'
  summary: string
  roundNum: number
  artifactCount: number
  role: string
  timestamp: number
}

// ─── Nodes ──────────────────────────────────────────────────────────

export interface NodeSystemStats {
  load1?: number
  load5?: number
  load15?: number
  cpuPercent?: number
  memoryTotalMb?: number
  memoryUsedMb?: number
  memoryUsedPercent?: number
  diskTotalGb?: number
  diskUsedGb?: number
  diskUsedPercent?: number
  uptimeHuman?: string
  controlPlaneOk?: boolean
  controlPlaneStatus?: string
  host?: string
}

export interface LegacyNodeSystemStatsCompat {
  /** legacy compatibility only; active UI should prefer controlPlane* */
  openclawOk?: boolean
  /** legacy compatibility only; active UI should prefer controlPlane* */
  openclawStatus?: string
}

export interface NodeSummary {
  key: string
  label: string
  reachable: boolean
  latencyMs?: number
  fallbackReady?: boolean
  probe?: string
  stats?: NodeSystemStats
  activeResidentCount?: number
  activeResidentRoles?: string[]
  connectivity?: NodeConnectivityInfo
  weight?: number
  pressureReason?: string
  recommended?: boolean
  preferredRoles?: string[]
  fallbackRoles?: string[]
}

// ─── Artifacts ──────────────────────────────────────────────────────

export interface ArtifactItem {
  artifactId: string
  taskId: string
  teamId: string
  artifactType: string
  role: string
  refId: string
  title: string
  body: any
  metadata?: (TaskFocusRef & {
    [key: string]: any
  })
  status: string
  createdAt: number
  updatedAt: number
}

export interface EvidenceItem {
  evidenceId: string
  taskId: string
  teamId: string
  evidenceType: string
  sourceType: string
  sourceId: string
  title: string
  detail: any
  severity: string
  createdAt: number
}

// ─── Timeline ───────────────────────────────────────────────────────

export interface TimelineEntry {
  messageId: string
  kind: string
  fromMemberId: string
  toMemberId: string
  payload: any
  createdAt: number
  taskId: string
  teamId: string
  status?: string
  broadcast?: boolean
}

// ─── Workbench ──────────────────────────────────────────────────────

export interface TerminalState {
  isTerminal?: boolean
  terminalKind?: 'done' | 'blocked' | 'cancelled' | 'active' | string
  headline?: string
  operatorHint?: string
  archiveEligible?: boolean
  archiveStatus?: string
  archiveRoute?: string
}

export interface EvidenceRetrieval {
  route?: string
  totalCount?: number
  reviewIssueCount?: number
  blockingCount?: number
  recommendedSection?: 'blocking' | 'supporting' | 'empty' | string
  preferredSource?: 'evidence' | 'artifacts' | string
}

export interface DeliveryClosure {
  deliverableReady?: boolean
  humanInterventionReady?: boolean
  deliveryStatus?: string
  interventionStatus?: string
  issueCount?: number
  revisionCount?: number
  artifactCount?: number
  evidenceCount?: number
  nextBestAction?: string
  executiveSummary?: string
  acceptanceState?: string
  recommendedSurface?: 'mission' | 'workbench' | 'timeline' | 'deliverables' | 'chat' | 'files' | string
  terminalState?: TerminalState
  evidenceRetrieval?: EvidenceRetrieval
}

export interface WorkbenchSummary {
  executiveSummary?: string
  currentDriver?: string
  currentMemberKey?: string
  nextBestAction?: string
  deliveryStatus?: string
  requestedNode?: string
  actualNode?: string
  degradedReason?: string
  hasPlan?: boolean
  hasReview?: boolean
  hasDecision?: boolean
  deliverableReady?: boolean
  deliveryClosure?: DeliveryClosure
}

export interface ResidentInfo {
  memberId: string
  role: string
  node?: string
  preferredNode?: string
  status?: string
}

// ─── Dashboard ──────────────────────────────────────────────────────

export interface DashboardResponse {
  ok: boolean
  dashboard: {
    count: number
    totalCount: number
    cards: TaskCard[]
    cursor: number
    hasMore: boolean
    address: string
    viewAddress: string
  }
}

export interface NodesResponse {
  ok: boolean
  nodes: {
    ts: number
    [key: string]: NodeStatus | number
  }
  deployment: Record<string, RoleDeployment>
  recommendation?: {
    selectedNode?: string
    degraded?: boolean
    degradedReason?: string
    weights?: Record<string, { weight?: number; reason?: string }>
  }
}

export interface NodeStatus {
  node: string
  reachable: boolean
  latencyMs: number
  fallbackReady: boolean
  probe: string
  stats?: NodeSystemStats
  activeResidentCount?: number
  activeResidentRoles?: string[]
  connectivity?: NodeConnectivityInfo
  weight?: number
  pressureReason?: string
  recommended?: boolean
  preferredRoles?: string[]
  fallbackRoles?: string[]
}

export interface RoleDeployment {
  role: string
  displayName: string
  preferredNode: string
  fallbackNode: string
  workspace: string
  memoryScope: string
  capabilities: string[]
}

// ─── Kanban ─────────────────────────────────────────────────────────

export const KANBAN_ORDER: TaskState[] = [
  'pending',
  'planning',
  'plan_review',
  'approved',
  'revision_requested',
  'done',
  'blocked',
  'cancelled',
]

export const KANBAN_LABELS: Record<TaskState, string> = {
  pending: 'Pending',
  planning: 'Planning',
  plan_review: 'In Review',
  approved: 'Approved',
  revision_requested: 'Needs Revision',
  done: 'Done',
  blocked: 'Blocked',
  cancelled: 'Cancelled',
}

export function groupTasksByState(tasks: TaskCard[]): Record<TaskState, TaskCard[]> {
  const groups: Record<TaskState, TaskCard[]> = {
    pending: [],
    planning: [],
    plan_review: [],
    approved: [],
    revision_requested: [],
    done: [],
    cancelled: [],
    blocked: [],
  }
  for (const task of tasks) {
    if (groups[task.state]) {
      groups[task.state].push(task)
    }
  }
  return groups
}
