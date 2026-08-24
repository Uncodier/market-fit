import type { WorkflowRunPlan, WorkflowRunPlanStep } from "./types"

export type WorkflowResultLog = {
  id: string
  log_type?: string
  message?: string
  created_at: string
  command_id?: string | null
  details?: Record<string, unknown> | null
  tool_result?: unknown
}

export type GroupedWorkflowLogs = {
  byNodeId: Record<string, WorkflowResultLog[]>
  overall: WorkflowResultLog[]
  stepOutputByNodeId: Record<string, string>
  summary: string
}

const RESULT_STEP_STATUSES = new Set(["in_progress", "completed", "failed"])

export function explicitLogNodeId(log: WorkflowResultLog): string | null {
  const details = log.details && typeof log.details === "object" ? log.details : null
  const fromDetails = details?.node_id ?? details?.workflow_node_id
  if (typeof fromDetails === "string" && fromDetails.trim()) return fromDetails.trim()
  if (typeof log.command_id === "string" && log.command_id.trim()) return log.command_id.trim()
  return null
}

export function stepOutputText(step: WorkflowRunPlanStep): string {
  const raw = step.step_output ?? step.output
  return typeof raw === "string" ? raw.trim() : ""
}

export function logsSince(logs: WorkflowResultLog[], iso?: string, padMs = 5000): WorkflowResultLog[] {
  if (!iso) return logs
  const start = new Date(iso).getTime() - padMs
  if (!Number.isFinite(start)) return logs
  return logs.filter((log) => {
    const t = new Date(log.created_at).getTime()
    return Number.isFinite(t) && t >= start
  })
}

function byCreatedAt(a: WorkflowResultLog, b: WorkflowResultLog) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
}

function stepsWithNodes(plan: WorkflowRunPlan | null): Array<WorkflowRunPlanStep & { node_id: string }> {
  if (!plan || !Array.isArray(plan.steps)) return []
  return plan.steps.flatMap((step) => {
    const node_id = step.metadata?.node_id
    return node_id ? [{ ...step, node_id }] : []
  })
}

function windowedNodeId(
  log: WorkflowResultLog,
  steps: Array<WorkflowRunPlanStep & { node_id: string }>,
  planCreatedAt?: string,
): string | null {
  const t = new Date(log.created_at).getTime()
  if (!Number.isFinite(t)) return null
  const planStart = planCreatedAt ? new Date(planCreatedAt).getTime() : NaN

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const startRaw = step.created_at || (i === 0 ? planCreatedAt : steps[i - 1].updated_at || steps[i - 1].created_at)
    const start = startRaw ? new Date(startRaw).getTime() : planStart
    const endRaw = step.updated_at || step.created_at
    const isOpen = step.status === "in_progress" || !endRaw
    const end = isOpen ? Date.now() : new Date(endRaw).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue
    if (t >= start && t <= end) return step.node_id
  }
  return null
}

export function summaryFromLogs(logs: WorkflowResultLog[]): string {
  const ranked = [...logs].reverse()
  const hit = ranked.find((log) => {
    const type = log.log_type
    const message = (log.message || "").trim()
    if (!message) return false
    return type === "agent_action" || type === "tool_result"
  })
  return (hit?.message || "").trim()
}

export function groupWorkflowResultLogs({
  logs,
  nodeIds,
  plan,
}: {
  logs: WorkflowResultLog[]
  nodeIds: string[]
  plan: WorkflowRunPlan | null
}): GroupedWorkflowLogs {
  const nodeSet = new Set(nodeIds)
  const scoped = logsSince(logs, plan?.created_at).slice().sort(byCreatedAt)
  const byNodeId: Record<string, WorkflowResultLog[]> = {}
  nodeIds.forEach((id) => {
    byNodeId[id] = []
  })

  const assigned = new Set<string>()
  const leftover: WorkflowResultLog[] = []
  const steps = stepsWithNodes(plan)

  for (const log of scoped) {
    const explicit = explicitLogNodeId(log)
    if (explicit && nodeSet.has(explicit)) {
      byNodeId[explicit].push(log)
      assigned.add(log.id)
      continue
    }
    leftover.push(log)
  }

  const hasWindows = steps.some((step) => step.created_at || step.updated_at)
  if (hasWindows) {
    leftover.forEach((log) => {
      const nodeId = windowedNodeId(log, steps, plan?.created_at)
      if (nodeId && nodeSet.has(nodeId)) {
        byNodeId[nodeId].push(log)
        assigned.add(log.id)
      }
    })
  } else {
    const active = steps.find((step) => step.status === "in_progress")
    if (active && nodeSet.has(active.node_id)) {
      leftover.forEach((log) => {
        if (assigned.has(log.id)) return
        byNodeId[active.node_id].push(log)
        assigned.add(log.id)
      })
    }
  }

  const stepOutputByNodeId: Record<string, string> = {}
  steps.forEach((step) => {
    const text = stepOutputText(step)
    if (text) stepOutputByNodeId[step.node_id] = text
  })

  return {
    byNodeId,
    overall: scoped,
    stepOutputByNodeId,
    summary: summaryFromLogs(scoped),
  }
}

export function shouldShowResultForStatus(status?: string) {
  return Boolean(status && RESULT_STEP_STATUSES.has(status))
}
