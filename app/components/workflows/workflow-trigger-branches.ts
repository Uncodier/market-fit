import type { InstanceNode } from "@/app/types/instance-nodes"

function belongsToTrigger(nodesById: Map<string, InstanceNode>, node: InstanceNode, triggerId: string): boolean {
  const visited = new Set<string>()
  let parentId = node.parent_node_id
  while (parentId && !visited.has(parentId)) {
    if (parentId === triggerId) return true
    visited.add(parentId)
    parentId = nodesById.get(parentId)?.parent_node_id || null
  }
  return false
}

export function triggerHasExecutableStep(nodes: InstanceNode[], triggerId: string): boolean {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  return nodes.some((node) => node.type === "wf-step" && belongsToTrigger(byId, node, triggerId))
}

export function triggerHasUnsupportedChannelStep(nodes: InstanceNode[], triggerId: string): boolean {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  return nodes.some((node) => {
    if (node.type !== "wf-step" || !belongsToTrigger(byId, node, triggerId)) return false
    const step = node.settings?.step
    return Boolean(step?.requires_sandbox || step?.requires_browser || step?.browser_interaction_required)
  })
}