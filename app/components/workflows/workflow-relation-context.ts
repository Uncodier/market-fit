export const DEFAULT_RELATION_CONTEXT = "on success"
export const RELATION_CONTEXT_OPTIONS = ["on success", "on fail", "on error", "always"] as const
export const MAX_RELATION_CONTEXT_LENGTH = 120
export const WORKFLOW_RELATION_GROUPS = [
  {
    label: "Outcomes",
    options: RELATION_CONTEXT_OPTIONS.map((value) => ({ value, label: value })),
  },
]

export function workflowRelationContext(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, MAX_RELATION_CONTEXT_LENGTH)
    : DEFAULT_RELATION_CONTEXT
}