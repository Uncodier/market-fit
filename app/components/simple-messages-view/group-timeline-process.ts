import { InstanceLog, InstancePlan } from './types'
import { formatToolDisplayName, getToolName } from './parse-tool-call'
import type { ProcessedTimelineItem, TimelineItemType } from './utils'

export type ProcessActivityKind = 'thinking' | 'tool' | 'responding' | 'step' | 'infrastructure'

export type ProcessGroupEntry =
  | { type: 'log'; timestamp: string; data: InstanceLog }
  | { type: 'completed_plan'; timestamp: string; data: InstancePlan }

export interface ProcessGroup {
  groupId: string
  entries: ProcessGroupEntry[]
}

export function isStepCompletedLog(log: InstanceLog): boolean {
  const name = (log.tool_name || log.toolName || '').toLowerCase()
  return name === 'structured_output' && (log.message || '').includes('event=step_completed')
}

export function isExcludedProcessTool(log: InstanceLog): boolean {
  const name = (log.tool_name || log.toolName || '').toLowerCase()
  if (name === 'show_artifact') return true
  if (name === 'structured_output') return !isStepCompletedLog(log)
  return false
}

export function isProcessLog(log: InstanceLog): boolean {
  if (isExcludedProcessTool(log)) return false
  return (
    log.log_type === 'thinking' ||
    log.log_type === 'agent_action' ||
    log.log_type === 'infrastructure' ||
    log.log_type === 'tool_call' ||
    log.log_type === 'tool_result' ||
    isStepCompletedLog(log)
  )
}

export function isPlaceholderAgentAction(log: InstanceLog): boolean {
  const msg = (log.message || '').trim()
  return msg.includes('placeholder response') || msg === 'Assistant step execution'
}

export function isProcessTimelineItem(item: { type: string; data: any }): boolean {
  if (item.type === 'completed_plan') return true
  if (item.type !== 'log') return false
  return isProcessLog(item.data as InstanceLog) && !isPlaceholderAgentAction(item.data as InstanceLog)
}

function titleCaseWords(value: string): string {
  return value
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function infrastructureLabel(log: InstanceLog): string {
  const event = typeof log.details?.event === 'string' ? log.details.event : ''
  if (event === 'cron_infra_step_status') {
    const stepTitle = typeof log.details?.step_title === 'string' ? log.details.step_title : null
    const stepOrder = log.details?.step_order ?? log.details?.order
    if (stepTitle) return `Step: ${stepTitle}`
    if (stepOrder != null) return `Step ${stepOrder}`
    return 'Step'
  }

  const known: Record<string, string> = {
    cron_infra_sandbox_vm_created: 'Infrastructure: Sandbox',
    cron_infra_workflow_sandbox_ready: 'Infrastructure: Sandbox',
    cron_infra_sandbox_reprovisioned: 'Infrastructure: Sandbox',
    cron_infra_git_workspace_ready: 'Infrastructure: Workspace',
    cron_infra_commit_push: 'Infrastructure: Push',
    cron_infra_checkpoint: 'Infrastructure: Checkpoint',
    cron_infra_gate_build: 'Infrastructure: Build',
    cron_infra_gate_origin: 'Infrastructure: Origin',
    cron_infra_gate_vercel_deploy: 'Infrastructure: Deploy',
    cron_infra_vercel_build_log: 'Infrastructure: Build log',
    cron_infra_sandbox_stop: 'Infrastructure: Sandbox',
    cron_infra_preview_url_recorded: 'Infrastructure: Preview',
  }

  if (known[event]) return known[event]
  if (event.startsWith('cron_infra_')) {
    return `Infrastructure: ${titleCaseWords(event.replace(/^cron_infra_/, ''))}`
  }
  return 'Infrastructure'
}

function stepCompletedLabel(log: InstanceLog): string {
  const stepMatch = (log.message || '').match(/step=(\d+)/)
  return stepMatch ? `Step ${stepMatch[1]} completed` : 'Step completed'
}

function planLabel(plan: InstancePlan): string {
  if (plan.status === 'completed') return plan.title ? `Plan completed: ${plan.title}` : 'Plan completed'
  if (plan.status === 'failed') return plan.title ? `Plan failed: ${plan.title}` : 'Plan failed'
  if (plan.status === 'in_progress' || plan.status === 'pending') {
    return plan.title ? `Plan: ${plan.title}` : 'Plan'
  }
  return plan.title ? `Plan: ${plan.title}` : 'Plan'
}

export function getProcessActivity(log: InstanceLog): { label: string; kind: ProcessActivityKind } {
  if (log.log_type === 'thinking') {
    return { label: 'Thinking', kind: 'thinking' }
  }

  if (log.log_type === 'infrastructure') {
    return { label: infrastructureLabel(log), kind: 'infrastructure' }
  }

  if (isStepCompletedLog(log)) {
    return { label: stepCompletedLabel(log), kind: 'step' }
  }

  if (log.log_type === 'tool_call' || log.log_type === 'tool_result') {
    const name = formatToolDisplayName(getToolName(log) || 'tool')
    return { label: `Tool call: ${name}`, kind: 'tool' }
  }

  const message = (log.message || '').trim()
  const streamingEmpty = Boolean(log.details?.streaming) && message.length === 0
  if (!message || streamingEmpty) {
    return { label: 'Thinking', kind: 'thinking' }
  }

  // Si el mensaje es corto, lo mostramos como la acción actual
  if (message.length < 80 && !message.includes('\n')) {
    return { label: message, kind: 'responding' }
  }

  return { label: 'Responding', kind: 'responding' }
}

export function getProcessEntryActivity(entry: ProcessGroupEntry): { label: string; kind: ProcessActivityKind } {
  if (entry.type === 'completed_plan') {
    return { label: planLabel(entry.data), kind: 'step' }
  }
  return getProcessActivity(entry.data)
}

export function getFinishedProcessCountLabel(count: number): string {
  return count === 1 ? '1 step' : `${count} steps`
}

export type ProcessDurationBucket = 'thought' | 'operated' | 'worked'

export function durationBucket(kind: ProcessActivityKind): ProcessDurationBucket | null {
  if (kind === 'thinking') return 'thought'
  if (kind === 'tool' || kind === 'infrastructure') return 'operated'
  if (kind === 'step' || kind === 'responding') return 'worked'
  return null
}

export function formatProcessDuration(ms: number): string {
  if (ms < 1000) return '<1s'
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
}

const MAX_SEGMENT_MS = 2 * 60 * 60 * 1000

function firstValidTimeMs(values: Array<string | null | undefined>): number {
  for (const raw of values) {
    if (!raw) continue
    const ms = new Date(raw).getTime()
    if (Number.isFinite(ms) && ms > 0) return ms
  }
  return 0
}

function entryTimeMs(entry: ProcessGroupEntry): number {
  if (entry.type === 'log') {
    return firstValidTimeMs([entry.timestamp, entry.data.created_at])
  }
  return firstValidTimeMs([
    entry.timestamp,
    entry.data.updated_at,
    entry.data.completed_at,
    entry.data.created_at,
  ])
}

function segmentMs(start: number, next: number): number {
  if (!start || !next || next <= start) return 0
  const gap = next - start
  if (gap > MAX_SEGMENT_MS) return 0
  return gap
}

export function measureProcessDurations(
  entries: ProcessGroupEntry[],
  endedAt?: string | null
): Record<ProcessDurationBucket, number> {
  const totals: Record<ProcessDurationBucket, number> = { thought: 0, operated: 0, worked: 0 }
  if (entries.length === 0) return totals

  const endBound = endedAt ? new Date(endedAt).getTime() : 0

  for (let i = 0; i < entries.length; i++) {
    const bucket = durationBucket(getProcessEntryActivity(entries[i]).kind)
    if (!bucket) continue

    const start = entryTimeMs(entries[i])
    const next = i + 1 < entries.length ? entryTimeMs(entries[i + 1]) : endBound
    totals[bucket] += segmentMs(start, next)
  }

  return totals
}

function formatDurationParts(durations: Record<ProcessDurationBucket, number>): string[] {
  const parts: string[] = []
  if (durations.thought > 0) parts.push(`Thought ${formatProcessDuration(durations.thought)}`)
  if (durations.worked > 0) parts.push(`Worked ${formatProcessDuration(durations.worked)}`)
  if (durations.operated > 0) parts.push(`Operated ${formatProcessDuration(durations.operated)}`)
  return parts
}

export function getProcessHeader(
  entries: ProcessGroupEntry[],
  isLive: boolean,
  endedAt?: string | null
): { label: string; kind: ProcessActivityKind } {
  // Find the last actual action log (ignoring empty thinking messages unless it's all we have)
  const latestActualAction = [...entries].reverse().find(e => {
    if (e.type !== 'log') return true
    const activity = getProcessActivity(e.data)
    return activity.label !== 'Thinking'
  })
  
  const latest = latestActualAction || entries[entries.length - 1]
  
  if (isLive) {
    return latest ? getProcessEntryActivity(latest) : { label: 'Thinking', kind: 'thinking' }
  }

  const parts = [
    getFinishedProcessCountLabel(entries.length),
    ...formatDurationParts(measureProcessDurations(entries, endedAt)),
  ]

  return {
    label: parts.join(' · '),
    kind: latest ? getProcessEntryActivity(latest).kind : 'thinking',
  }
}

export function processGroupLogs(group: ProcessGroup): InstanceLog[] {
  return group.entries.filter((entry): entry is Extract<ProcessGroupEntry, { type: 'log' }> => entry.type === 'log').map((entry) => entry.data)
}

export function splitProcessAnswer(logs: InstanceLog[]): {
  processLogs: InstanceLog[]
  answer: InstanceLog | null
} {
  const answerIndex = [...logs]
    .map((log, index) => ({ log, index }))
    .reverse()
    .find(({ log }) =>
      log.log_type === 'agent_action' &&
      (log.message || '').trim().length > 0 &&
      !isPlaceholderAgentAction(log)
    )?.index

  if (answerIndex == null) {
    return { processLogs: logs.filter((log) => !isPlaceholderAgentAction(log)), answer: null }
  }

  return {
    processLogs: logs.filter((log, index) => index !== answerIndex && !isPlaceholderAgentAction(log)),
    answer: logs[answerIndex],
  }
}

export function isProcessGroupLive(group: ProcessGroup): boolean {
  if (group.entries.length === 0) return true
  
  const logs = processGroupLogs(group)
  if (logs.length === 0) return true

  const lastEntry = group.entries[group.entries.length - 1]
  if (lastEntry.type === 'completed_plan' && (lastEntry.data.status === 'completed' || lastEntry.data.status === 'failed' || lastEntry.data.status === 'cancelled')) {
    return false
  }

  if (lastEntry.type === 'log') {
    if (isStepCompletedLog(lastEntry.data)) {
      return false
    }
    if (lastEntry.data.log_type === 'infrastructure' && lastEntry.data.details?.event === 'cron_infra_sandbox_stop') {
      return false
    }
  }
  
  const { answer } = splitProcessAnswer(logs)
  if (answer) {
    const index = logs.findIndex(l => l.id === answer.id)
    const subsequentLogs = logs.slice(index + 1).filter(l => !isPlaceholderAgentAction(l))
    if (subsequentLogs.length === 0) {
      return false
    }
  }

  return true
}

export function groupTimelineProcess(
  sortedTimeline: Array<{ type: string; timestamp: string; data: any }>
): ProcessedTimelineItem[] {
  const result: ProcessedTimelineItem[] = []
  let i = 0

  while (i < sortedTimeline.length) {
    const item = sortedTimeline[i]

    if (!isProcessTimelineItem(item)) {
      if (item.type === 'log' && isPlaceholderAgentAction(item.data as InstanceLog)) {
        i++
        continue
      }
      result.push({
        type: item.type as TimelineItemType,
        timestamp: item.timestamp,
        data: item.data,
      })
      i++
      continue
    }

    const entries: ProcessGroupEntry[] = [
      item.type === 'completed_plan'
        ? { type: 'completed_plan', timestamp: item.timestamp, data: item.data }
        : { type: 'log', timestamp: item.timestamp, data: item.data },
    ]
    i++

    while (i < sortedTimeline.length) {
      const nextItem = sortedTimeline[i]
      if (!isProcessTimelineItem(nextItem)) {
        if (nextItem.type === 'log' && isPlaceholderAgentAction(nextItem.data as InstanceLog)) {
          i++
          continue
        }
        break
      }
      entries.push(
        nextItem.type === 'completed_plan'
          ? { type: 'completed_plan', timestamp: nextItem.timestamp, data: nextItem.data }
          : { type: 'log', timestamp: nextItem.timestamp, data: nextItem.data }
      )
      i++
    }

    const first = entries[0]
    const groupId = first.type === 'log' ? `process-${first.data.id}` : `process-plan-${first.data.id}`

    result.push({
      type: 'process_group',
      timestamp: first.timestamp,
      data: { groupId, entries } satisfies ProcessGroup,
    })
  }

  return result
}
