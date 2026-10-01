type ExecutionHold = {
  kind?: string
  file?: string
  reason?: string
  updated_at?: string
}

export type CurrentRequirementState = {
  id: string
  status: string
  execution_hold?: ExecutionHold | null
}

/** History is not the execution authority. Only project the latest linked row. */
export function currentRequirementPresentation(
  history: { stage?: string; message?: string },
  requirement: CurrentRequirementState
) {
  const hold = requirement.execution_hold
  if (hold?.kind === 'migration_platform_review') {
    return {
      stage: 'blocked',
      message: `Execution blocked${hold.file ? `: ${hold.file}` : ''}. ${hold.reason || 'Technical migration review is required.'} No customer approval is needed. Updating a plan step does not resume execution.`,
    }
  }
  if (requirement.status === 'blocked') {
    return {
      stage: 'blocked',
      message: history.stage === 'blocked' && history.message
        ? history.message
        : 'Execution is blocked at the requirement level. The displayed plan may still say in progress, but no resumption is confirmed. Technical reconciliation is required.',
    }
  }
  // A released hold may leave older blocked history until the next worker reports.
  if (history.stage === 'blocked' && ['backlog', 'in-progress'].includes(requirement.status)) {
    return { stage: requirement.status, message: 'The requirement is eligible for scheduling. A running worker has not been confirmed by this status update.' }
  }
  return { stage: requirement.status || history.stage, message: history.message }
}