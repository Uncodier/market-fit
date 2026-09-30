"use client"
import { createRequirementLoader } from "./load-requirement-detail"
import { createRequirementDetailActions } from "./requirement-detail-actions"
import { createRequirementSegmentEdits } from "./requirement-segment-edits"
import { useRequirementLifecycle } from "./use-requirement-lifecycle"
import { useRequirementState } from "./use-requirement-state"
import { useRequirementWorkflow } from "./use-requirement-workflow"

export function useRequirementController() {
  const state = useRequirementState()
  const workflow = useRequirementWorkflow(state)
  const loadRequirement = createRequirementLoader(state)
  const actions = createRequirementDetailActions(state, loadRequirement)
  const segments = createRequirementSegmentEdits(state)
  useRequirementLifecycle(state, loadRequirement, actions.handleSaveChanges, actions.handleBuildRequirement)
  return { ...state, ...workflow, ...actions, ...segments }
}
export type RequirementController = ReturnType<typeof useRequirementController>
