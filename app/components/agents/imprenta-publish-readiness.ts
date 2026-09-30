import type { InstanceNode } from "@/app/types/instance-nodes"

export function audienceNodeHasNonemptyResult(node: InstanceNode): boolean {
  const r: unknown = node.result
  if (r == null) return false
  if (typeof r === "string") return r.trim().length > 0
  if (typeof r === "object" && !Array.isArray(r)) return Object.keys(r).length > 0
  if (Array.isArray(r)) return r.length > 0
  return false
}

