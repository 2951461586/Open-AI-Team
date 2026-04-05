import { ArrowRightCircle, Clock, FolderOpen, PackageOpen, RefreshCcw, RotateCcw } from 'lucide-react'
import { FocusTarget } from '@/lib/types'
import { formatDateTime, nodeLabel, roleLabel, stateLabel } from '@/lib/utils'
import { pickTaskFocusRef } from '@/lib/task-focus'

export function WorkbenchReplanSection({
  latestReplanResult,
  latestReplanMap,
  replanStructureRows,
  onFocusTarget,
}: {
  latestReplanResult: any
  latestReplanMap: any
  replanStructureRows: any[]
  onFocusTarget?: (target: FocusTarget) => void
}) {
  if (!latestReplanResult) return null
  return (
    <section className="surface-card p-4 md:p-5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--fg)]">
        <RefreshCcw className="h-4 w-4 text-[var(--accent)]" /> 最近重排
      </div>
      <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--fg-muted)]">
          <span className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">局部重排记录</span>
          {latestReplanResult?.payload?.workItemCount ? <span className="soft-label border-[var(--accent)]/25 bg-[var(--accent-soft)] text-[var(--accent)]">{latestReplanResult.payload.workItemCount} 个新执行项</span> : null}
          {latestReplanResult?.createdAt ? <span>{formatDateTime(latestReplanResult.createdAt)}</span> : null}
        </div>
        <div className="mt-2 text-[13px] font-medium leading-6 text-[var(--fg)]">{latestReplanResult?.payload?.summary || '总控已给出新的局部规划。'}</div>
        {latestReplanResult?.payload?.reason ? <div className="mt-1 text-[12px] leading-5 text-[var(--fg-secondary)]">原因：{latestReplanResult.payload.reason}</div> : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => onFocusTarget?.({ intent: 'replan', sourceKind: 'replan', openTab: 'timeline', ...pickTaskFocusRef(latestReplanResult?.payload), summary: latestReplanResult?.payload?.summary, replanCreatedAt: Number(latestReplanResult?.createdAt || 0) || undefined })} className="inline-flex items-center gap-1 rounded-lg border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-3 py-1.5 text-[11px] font-medium text-[var(--accent)] transition hover:opacity-90"><Clock className="h-3.5 w-3.5" /> 在脉络中定位</button>
          <button type="button" onClick={() => onFocusTarget?.({ intent: 'replan', sourceKind: 'replan', openTab: 'deliverables', ...pickTaskFocusRef(latestReplanResult?.payload), summary: latestReplanResult?.payload?.summary, replanCreatedAt: Number(latestReplanResult?.createdAt || 0) || undefined })} className="inline-flex items-center gap-1 rounded-lg border border-[var(--success)]/25 bg-[var(--success-soft)] px-3 py-1.5 text-[11px] font-medium text-[var(--success)] transition hover:opacity-90"><PackageOpen className="h-3.5 w-3.5" /> 看相关产物</button>
          <button type="button" onClick={() => onFocusTarget?.({ intent: 'replan', sourceKind: 'replan', openTab: 'files', ...pickTaskFocusRef(latestReplanResult?.payload), summary: latestReplanResult?.payload?.summary, replanCreatedAt: Number(latestReplanResult?.createdAt || 0) || undefined })} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--fg-secondary)] transition hover:bg-[var(--surface-muted)]"><FolderOpen className="h-3.5 w-3.5" /> 查看文件</button>
        </div>

        {latestReplanMap && replanStructureRows.length > 0 && (
          <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-medium text-[var(--accent)]">重排映射</div>
              <div className="flex flex-wrap gap-1.5 text-[11px] text-[var(--fg-muted)]">
                <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">已挂接 {replanStructureRows.filter((row) => row.matchState === 'attached').length}</span>
                <span className="soft-label border-[var(--warning)]/25 bg-[var(--warning-soft)] text-[var(--warning)]">待挂接 {replanStructureRows.filter((row) => row.matchState !== 'attached').length}</span>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {replanStructureRows.map((row) => (
                <div key={`${row.itemId || row.itemTitle}-${row.index}`} className="surface-card-subtle p-3">
                  <div className="grid gap-3 lg:grid-cols-[1.35fr_0.8fr_1.35fr]">
                    <div>
                      <div className="text-[10px] text-[var(--fg-ghost)]">新执行项</div>
                      <div className="mt-1 text-[12px] font-medium leading-5 text-[var(--fg)]">{row.itemTitle || `执行项 ${row.index + 1}`}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[var(--fg-muted)]">{row.itemRole ? <span>{roleLabel(row.itemRole)}</span> : null}</div>
                      {row.objective ? <div className="mt-2 text-[11px] leading-5 text-[var(--fg-secondary)]">目标：{row.objective}</div> : null}
                    </div>
                    <div className="flex items-center justify-center"><div className={`rounded-xl border px-3 py-2 text-center text-[11px] font-medium ${row.matchState === 'attached' ? 'border-[var(--success)]/25 bg-[var(--success-soft)] text-[var(--success)]' : 'border-[var(--warning)]/25 bg-[var(--warning-soft)] text-[var(--warning)]'}`}>{row.matchState === 'attached' ? '已挂接到现场子任务' : '现场还未挂接'}</div></div>
                    <div>
                      <div className="text-[10px] text-[var(--fg-ghost)]">现场子任务</div>
                      {row.matchedChild ? (
                        <>
                          <div className="mt-1 text-[12px] font-medium leading-5 text-[var(--fg)]">已关联现场子任务</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[var(--fg-muted)]">{row.matchedChild.targetRole ? <span>{roleLabel(row.matchedChild.targetRole)}</span> : null}{row.matchedChild.node ? <span>{nodeLabel(row.matchedChild.node)}</span> : null}</div>
                          {row.matchedChild.summary ? <div className="mt-2 text-[11px] leading-5 text-[var(--fg-secondary)]">{row.matchedChild.summary}</div> : null}
                        </>
                      ) : <div className="mt-1 text-[11px] leading-5 text-[var(--fg-muted)]">当前还未挂接到子任务。</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export function WorkbenchChildTasksSection({ focusableChildTasks, onFocusTarget }: { focusableChildTasks: any[]; onFocusTarget?: (target: FocusTarget) => void }) {
  if (focusableChildTasks.length === 0) return null
  return (
    <section className="surface-card p-4 md:p-5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--fg)]"><ArrowRightCircle className="h-4 w-4 text-[var(--accent)]" /> 子任务动作</div>
      <div className="mt-3 space-y-2">
        {focusableChildTasks.map((item) => {
          const riskState = item.failed ? 'failed' : item.retrying ? 'retrying' : 'normal'
          const requestStateLabel = item.requestState === 'requested' ? `${item.requestIntent === 'retry' ? '重试' : item.requestIntent === 'replan' ? '重排' : '跟进'}已发起` : item.requestState === 'accepted' ? 'TL 已接住' : item.requestState === 'routed' ? '已转交成员' : item.requestState === 'completed' ? '本轮已完成' : item.requestState === 'failed' ? '本轮处理失败' : ''
          return (
            <div key={item.childTaskId} className="surface-card-subtle px-3 py-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--fg-muted)]">
                <span className="font-medium text-[var(--fg)]">当前子任务</span>
                {item.targetRole ? <span className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">{roleLabel(item.targetRole)}</span> : null}
                {item.node ? <span className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">{nodeLabel(item.node)}</span> : null}
                <span className={`soft-label ${riskState === 'failed' ? 'border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]' : riskState === 'retrying' ? 'border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]'}`}>{riskState === 'failed' ? '失败/卡住' : riskState === 'retrying' ? '重试中' : '可继续推进'}</span>
              </div>
              <div className="mt-1 text-[12px] leading-5 text-[var(--fg-secondary)]">{item.summary || '继续跟进这条子任务。'}</div>
              {requestStateLabel ? <div className="mt-2 text-[11px] text-[var(--fg-muted)]">当前状态：{requestStateLabel}</div> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => onFocusTarget?.({ intent: 'followup', openTab: 'chat', targetRole: item.targetRole, ...pickTaskFocusRef(item), summary: item.summary })} className="rounded-lg border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-3 py-1.5 text-[11px] font-medium text-[var(--accent)] transition hover:opacity-90">继续跟进</button>
                <button type="button" onClick={() => onFocusTarget?.({ intent: 'retry', openTab: 'chat', targetRole: item.targetRole, ...pickTaskFocusRef(item), summary: item.summary })} className="inline-flex items-center gap-1 rounded-lg border border-[var(--warning)]/25 bg-[var(--warning-soft)] px-3 py-1.5 text-[11px] font-medium text-[var(--warning)] transition hover:opacity-90"><RotateCcw className="h-3.5 w-3.5" /> 定向重试</button>
                <button type="button" onClick={() => onFocusTarget?.({ intent: 'replan', openTab: 'chat', targetRole: item.targetRole, ...pickTaskFocusRef(item), summary: item.summary })} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--fg-secondary)] transition hover:bg-[var(--surface-muted)]"><RefreshCcw className="h-3.5 w-3.5" /> 重新安排</button>
                <button type="button" onClick={() => onFocusTarget?.({ openTab: 'deliverables', targetRole: item.targetRole, ...pickTaskFocusRef(item), summary: item.summary })} className="rounded-lg border border-[var(--success)]/25 bg-[var(--success-soft)] px-3 py-1.5 text-[11px] font-medium text-[var(--success)] transition hover:opacity-90">查看交付</button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function WorkbenchMemorySection({ memoryLayers }: { memoryLayers: any }) {
  if (Number(memoryLayers?.layerCount || 0) < 3) return null
  return (
    <section className="surface-card p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-semibold text-[var(--fg)]">三层 Memory</div>
        <div className="flex flex-wrap gap-1.5 text-[11px] text-[var(--fg-muted)]">
          <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">L1 依赖绑定 {Number(memoryLayers?.working?.dependencyBoundCount || 0)}</span>
          <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">L2 黑板条目 {Number(memoryLayers?.shared?.entryCount || 0)}</span>
          <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">L3 产物 {Number(memoryLayers?.durable?.artifactCount || 0)}</span>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="surface-card-subtle p-3"><div className="text-[12px] font-medium text-[var(--fg)]">{String(memoryLayers?.working?.label || 'L1 即时工作记忆')}</div><div className="mt-1 text-[11px] leading-5 text-[var(--fg-muted)]">来源：{String(memoryLayers?.working?.source || 'workItem.context + dependency results')}</div></div>
        <div className="surface-card-subtle p-3"><div className="text-[12px] font-medium text-[var(--fg)]">{String(memoryLayers?.shared?.label || 'L2 任务共享记忆')}</div><div className="mt-1 text-[11px] leading-5 text-[var(--fg-muted)]">来源：{String(memoryLayers?.shared?.source || 'blackboard / member findings / signals')}</div></div>
        <div className="surface-card-subtle p-3"><div className="text-[12px] font-medium text-[var(--fg)]">{String(memoryLayers?.durable?.label || 'L3 持久证据记忆')}</div><div className="mt-1 text-[11px] leading-5 text-[var(--fg-muted)]">来源：{String(memoryLayers?.durable?.source || 'plans / reviews / decisions / artifacts / evidence')}</div></div>
      </div>
    </section>
  )
}

export function WorkbenchExecutionSurfaceSection({ executionSurfaceRows, executionSurfaceSummary }: { executionSurfaceRows: any[]; executionSurfaceSummary: any }) {
  if (executionSurfaceRows.length === 0) return null
  return (
    <section className="surface-card p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-semibold text-[var(--fg)]">Skill / Tool / MCP 执行面</div>
        <div className="flex flex-wrap gap-1.5 text-[11px] text-[var(--fg-muted)]">
          <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">子任务 {Number(executionSurfaceSummary.childTaskCount || executionSurfaceRows.length || 0)}</span>
          <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">Skill 绑定 {Number(executionSurfaceSummary.skillBoundCount || 0)}</span>
          <span className="soft-label border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--fg-secondary)]">Tool 绑定 {Number(executionSurfaceSummary.toolBoundCount || 0)}</span>
        </div>
      </div>
      <div className="mt-3 space-y-2">{executionSurfaceRows.map((item: any) => <div key={item.taskId || item.assignmentId} className="surface-card-subtle p-3"><div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--fg-muted)]"><span className="font-medium text-[var(--fg)]">{item.title || item.taskId || '未命名子任务'}</span>{item.role ? <span className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">{roleLabel(item.role)}</span> : null}{item.state ? <span className="soft-label border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">{stateLabel(item.state)}</span> : null}</div></div>)}</div>
    </section>
  )
}

export function WorkbenchPeopleSection({ peopleView, currentDriverKey }: { peopleView: any[]; currentDriverKey: string }) {
  if (peopleView.length === 0) return null
  return <section className="surface-card p-4 md:p-5"><div className="text-[13px] font-semibold text-[var(--fg)]">在场角色</div><div className="mt-3 space-y-2">{peopleView.map((r) => { const roleKey = String(r.role || '').trim().toLowerCase().split(/[.:]/)[0] || ''; const isLead = roleKey && roleKey === currentDriverKey; const statusText = r.status === 'busy' ? (isLead ? '正在担任当前角色' : '正在协同处理') : '已在场，等待接力'; const badgeText = r.status === 'busy' ? (isLead ? '当前角色' : '协同中') : '待命'; return <div key={r.memberId} className="surface-card-subtle flex items-center justify-between px-3 py-2"><div className="min-w-0"><div className="text-[13px] font-medium text-[var(--fg)] truncate">{roleLabel(r.role)}</div><div className="mt-0.5 text-[11px] text-[var(--fg-muted)]">{statusText}</div></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] ${r.status === 'busy' ? (isLead ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[var(--warning-soft)] text-[var(--warning)]') : 'bg-[var(--surface-muted)] text-[var(--fg-ghost)]'}`}>{badgeText}</span></div> })}</div></section>
}

export function WorkbenchLiveFeedSection({ liveEvents }: { liveEvents: any[] }) {
  if (liveEvents.length === 0) return null
  return <section className="surface-card p-4 md:p-5"><div className="text-[13px] font-semibold text-[var(--fg)]">现场播报</div><div className="mt-1 text-[11px] leading-5 text-[var(--fg-muted)]">把最近几条真实协作信号按角色与节点摊开看。</div><div className="mt-3 space-y-2">{liveEvents.slice(0, 5).map((event) => <div key={event.id} className="surface-card-subtle px-3 py-2"><div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--fg-muted)]"><span>{formatDateTime(event.timestamp)}</span>{event.role && <span className="soft-label border-[var(--border)] bg-[var(--background)] text-[var(--fg-secondary)]">{roleLabel(event.role)}</span>}{event.node && <span className="soft-label border-[var(--border)] bg-[var(--background)] text-[var(--fg-secondary)]">{nodeLabel(event.node)}</span>}</div><div className="mt-1 text-[12px] leading-5 text-[var(--fg)]">{event.content || event.title || '收到新进展'}</div></div>)}</div></section>
}
