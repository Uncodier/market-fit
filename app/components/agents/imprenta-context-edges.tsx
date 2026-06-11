import { memo, useMemo, useEffect, useState } from "react"
import { InstanceNode } from "@/app/types/instance-nodes"
import { getPublishContextAnchorY } from "./imprenta-publish-context"
import type { ImprentaHoverStore } from "@/app/lib/imprenta-hover-store"

const ROW_H = 64
const NODE_W = 384

function collectNodeAndAncestorIds(startId: string, nodes: InstanceNode[]) {
  const chain = new Set<string>()
  const byId = new Map(nodes.map(n => [n.id, n]))
  let curr = startId
  while (curr) {
    chain.add(curr)
    const n = byId.get(curr)
    if (!n || !n.parent_node_id) break
    curr = n.parent_node_id
  }
  return chain
}

type ImprentaContextEdgesProps = {
  contexts: any[]
  nodesRef: React.MutableRefObject<InstanceNode[]>
  positions: Record<string, { x: number; y: number }>
  nodeHeightsRef: React.MutableRefObject<Record<string, number>>
  selectedContextId: string | null
  setSelectedContextId: (id: string | null) => void
  hoverStore: ImprentaHoverStore
  visibleNodeIds: Set<string> | null
}

export const ImprentaContextEdges = memo(function ImprentaContextEdges({
  contexts,
  nodesRef,
  positions,
  nodeHeightsRef,
  selectedContextId,
  setSelectedContextId,
  hoverStore,
  visibleNodeIds,
}: ImprentaContextEdgesProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(hoverStore.get())

  useEffect(() => {
    return hoverStore.subscribe(setHoveredNodeId)
  }, [hoverStore])

  const imprentaHoverChainIds = useMemo(() => {
    if (!hoveredNodeId) return null
    return collectNodeAndAncestorIds(hoveredNodeId, nodesRef.current)
  }, [hoveredNodeId, nodesRef])

  const resolveNodePosition = (nodeId: string) => positions[nodeId]

  if (contexts.length === 0) return null

  // We filter edges where either source or target is visible
  const visibleContexts = contexts.filter(ctx => 
    !visibleNodeIds || 
    visibleNodeIds.has(ctx.context_node_id) || 
    visibleNodeIds.has(ctx.target_node_id)
  )

  if (visibleContexts.length === 0) return null

  return (
    <svg
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0, overflow: 'visible' }}
      shapeRendering="optimizeSpeed"
    >
      {visibleContexts.map((ctx) => {
        if (!positions[ctx.context_node_id] || !positions[ctx.target_node_id]) return null
        const start = resolveNodePosition(ctx.context_node_id)
        const end = resolveNodePosition(ctx.target_node_id)
        const startCy = (nodeHeightsRef.current[ctx.context_node_id] || ROW_H) / 2
        const targetNodeForCtx = nodesRef.current.find((n) => n.id === ctx.target_node_id)
        const endH = nodeHeightsRef.current[ctx.target_node_id] || ROW_H
        const endCy = getPublishContextAnchorY(targetNodeForCtx?.type, ctx.type, endH)
        const startX = start.x + NODE_W
        const startY = start.y + startCy
        const endX = end.x
        const endY = end.y + endCy
        const isSelected = selectedContextId === ctx.id
        const chain = imprentaHoverChainIds
        const touchesHoverChain =
          chain != null &&
          (chain.has(ctx.context_node_id) || chain.has(ctx.target_node_id))
        const strokeClass =
          isSelected || touchesHoverChain ? "text-primary" : "text-primary/50"
        const strokeWidth = isSelected ? 4 : touchesHoverChain ? 3 : 2
        const d = `M ${startX} ${startY} C ${startX + 50} ${startY}, ${endX - 50} ${endY}, ${endX} ${endY}`
        return (
          <g key={`ctx-edge-${ctx.id}`}>
            <path
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className={`${strokeClass} stroke-dashed cursor-pointer`}
              strokeDasharray="4 4"
              style={{ pointerEvents: "stroke" }}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedContextId(isSelected ? null : ctx.id)
              }}
            />
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth="20"
              className="cursor-pointer"
              style={{ pointerEvents: "stroke" }}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedContextId(isSelected ? null : ctx.id)
              }}
            />
          </g>
        )
      })}
    </svg>
  )
})
