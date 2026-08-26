import { memo, useMemo, useEffect, useState, type MutableRefObject } from "react"
import { InstanceNode } from "@/app/types/instance-nodes"
import { getPublishContextAnchorY } from "./imprenta-publish-context"
import { WorldSpaceSvg } from "./imprenta-world-svg"
import type { ImprentaHoverStore } from "@/app/lib/imprenta-hover-store"
import type { WorldPoint } from "@/app/lib/imprenta-world-svg"

const ROW_H = 300
const NODE_W = 480

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

type ContextEdgeGeom = {
  id: string
  d: string
  start: WorldPoint
  end: WorldPoint
  isSelected: boolean
  touchesHoverChain: boolean
}

type ImprentaContextEdgesProps = {
  contexts: any[]
  nodesRef: MutableRefObject<InstanceNode[]>
  positions: Record<string, { x: number; y: number }>
  nodeHeightsRef: MutableRefObject<Record<string, number>>
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

  const edges = useMemo(() => {
    const out: ContextEdgeGeom[] = []
    const chain = imprentaHoverChainIds
    for (const ctx of contexts) {
      if (
        visibleNodeIds &&
        !visibleNodeIds.has(ctx.context_node_id) &&
        !visibleNodeIds.has(ctx.target_node_id)
      ) {
        continue
      }
      if (!positions[ctx.context_node_id] || !positions[ctx.target_node_id]) continue
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
      const touchesHoverChain =
        chain != null &&
        (chain.has(ctx.context_node_id) || chain.has(ctx.target_node_id))
      out.push({
        id: ctx.id,
        d: `M ${startX} ${startY} C ${startX + 50} ${startY}, ${endX - 50} ${endY}, ${endX} ${endY}`,
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
        isSelected,
        touchesHoverChain,
      })
    }
    return out
  }, [
    contexts,
    positions,
    visibleNodeIds,
    selectedContextId,
    imprentaHoverChainIds,
    nodeHeightsRef,
    nodesRef,
  ])

  const points = useMemo(() => {
    const pts: WorldPoint[] = []
    for (const edge of edges) {
      pts.push(edge.start, edge.end)
    }
    return pts
  }, [edges])

  if (edges.length === 0) return null

  return (
    <WorldSpaceSvg
      points={points}
      className="pointer-events-none text-primary"
      style={{ zIndex: 0, color: "hsl(var(--primary))" }}
    >
      {edges.map((edge) => {
        const strokeWidth = edge.isSelected ? 4 : edge.touchesHoverChain ? 3 : 2
        return (
          <g key={`ctx-edge-${edge.id}`}>
            <path
              d={edge.d}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeOpacity={edge.isSelected || edge.touchesHoverChain ? 1 : 0.5}
              strokeWidth={strokeWidth}
              className="cursor-pointer"
              strokeDasharray="4 4"
              style={{ pointerEvents: "stroke" }}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedContextId(edge.isSelected ? null : edge.id)
              }}
            />
            <path
              d={edge.d}
              fill="none"
              stroke="transparent"
              strokeWidth="20"
              className="cursor-pointer"
              style={{ pointerEvents: "stroke" }}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedContextId(edge.isSelected ? null : edge.id)
              }}
            />
          </g>
        )
      })}
    </WorldSpaceSvg>
  )
})
