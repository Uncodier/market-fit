import type { InstanceNode } from "@/app/types/instance-nodes"

export function canSetWorkflowParent(nodes: InstanceNode[], stepId: string, parentId: string | null): boolean {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const step = byId.get(stepId)
  if (!step || step.type !== "wf-step") return false
  if (parentId === null) return true

  const parent = byId.get(parentId)
  if (!parent || (parent.type !== "wf-trigger" && parent.type !== "wf-step")) return false
  if (parent.instance_id !== step.instance_id || parent.site_id !== step.site_id) return false

  const visited = new Set<string>()
  let current: InstanceNode | undefined = parent
  while (current) {
    if (current.id === stepId || visited.has(current.id)) return false
    visited.add(current.id)
    current = current.parent_node_id ? byId.get(current.parent_node_id) : undefined
  }
  return true
}