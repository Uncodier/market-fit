"use client"

import type { InstanceNode } from "@/app/types/instance-nodes"
import { NODE_H, NODE_W } from "./types"
import { readSavedPosition, type WFPoint } from "./use-workflow-layout"

export function WorkflowEdges({
  nodes,
  positions,
  heights,
}: {
  nodes: InstanceNode[]
  positions: Record<string, WFPoint>
  heights: Record<string, number>
}) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const paths = nodes
    .filter((n) => n.parent_node_id && byId.has(n.parent_node_id))
    .map((n) => {
      const parent = byId.get(n.parent_node_id!)!
      const from = positions[parent.id] || readSavedPosition(parent, 0)
      const to = positions[n.id] || readSavedPosition(n, 1)
      const fromH = heights[parent.id] || NODE_H
      const toH = heights[n.id] || NODE_H
      const x1 = from.x + NODE_W
      const y1 = from.y + fromH / 2
      const x2 = to.x
      const y2 = to.y + toH / 2
      const mid = (x1 + x2) / 2
      return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`
    })

  if (paths.length === 0) return null

  return (
    <svg className="absolute inset-0 overflow-visible pointer-events-none" width="1" height="1">
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" className="text-border" strokeWidth="2" />
      ))}
    </svg>
  )
}
