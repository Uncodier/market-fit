"use client"

import type { InstanceNode } from "@/app/types/instance-nodes"
import { WorldSpaceSvg } from "@/app/components/agents/imprenta-world-svg"
import { worldConnectionBezier, worldConnectionPathD, type WorldPoint } from "@/app/lib/imprenta-world-svg"
import { cn } from "@/lib/utils"
import { NODE_H, NODE_W } from "./types"
import { readSavedPosition, type WFPoint } from "./use-workflow-layout"
import { workflowRelationContext } from "./workflow-relation-context"

export function WorkflowEdges({
  nodes,
  positions,
  heights,
  preview,
  selectedRelationId,
  onSelectRelation,
}: {
  nodes: InstanceNode[]
  positions: Record<string, WFPoint>
  heights: Record<string, number>
  preview?: { fromNode: string; to: WFPoint } | null
  selectedRelationId?: string | null
  onSelectRelation?: (stepId: string, anchor: { x: number; y: number }) => void
}) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const edges = nodes
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
      return {
        id: n.id,
        editable: n.type === "wf-step",
        context: workflowRelationContext(n.settings?.relation_context),
        labelX: (x1 + x2) / 2,
        labelY: (y1 + y2) / 2,
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        path: `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`,
      }
    })

  const source = preview && byId.get(preview.fromNode)
  const from = source && (positions[source.id] || readSavedPosition(source, 0))
  const previewStart = source && from
    ? { x: from.x + NODE_W, y: from.y + (heights[source.id] || NODE_H) / 2 }
    : null
  const points: WorldPoint[] = edges.flatMap(({ start, end }) => [start, end])
  if (previewStart && preview) points.push(previewStart, preview.to)
  if (!points.length) return null

  const paths = (
    <>
      {edges.map(({ id, path, context, editable }) => (
        <g key={id}>
          <path d={path} fill="none" stroke="currentColor"
            className={selectedRelationId === id ? "text-primary" : "text-border"}
            strokeWidth={selectedRelationId === id ? "3" : "2"} />
          {onSelectRelation && editable && (
            <path
              data-testid={`workflow-relation-hit-${id}`}
              d={path}
              fill="none"
              stroke="transparent"
              strokeWidth="20"
              className="cursor-pointer"
              style={{ pointerEvents: "stroke" }}
              aria-label={`Select relation ${context}`}
              onClick={(event) => {
                event.stopPropagation()
                onSelectRelation(id, { x: event.clientX, y: event.clientY })
              }}
            />
          )}
        </g>
      ))}
      {previewStart && preview && (
        <path
          d={worldConnectionPathD(worldConnectionBezier(previewStart.x, previewStart.y, preview.to.x, preview.to.y))}
          fill="none"
          stroke="currentColor"
          className="text-primary"
          strokeWidth="2.5"
          strokeDasharray="8 6"
        />
      )}
    </>
  )

  return (
    <>
      <svg className="absolute inset-0 h-full w-full overflow-visible pointer-events-none imprenta-world-svg safari-only-svg" aria-hidden>
        {paths}
      </svg>
      <WorldSpaceSvg points={points} className="pointer-events-none chrome-only-svg" aria-hidden>
        {paths}
      </WorldSpaceSvg>
      {onSelectRelation && edges.filter((edge) => edge.editable).map(({ id, context, labelX, labelY }) => (
        <button
          key={`${id}-label`}
          type="button"
          aria-label={`Edit relation context: ${context}`}
          aria-pressed={selectedRelationId === id}
          className={cn(
            "absolute z-20 inline-flex h-6 max-w-[160px] items-center truncate rounded-full border bg-background px-2 text-[10px] font-medium text-primary shadow-sm transition-colors hover:bg-accent",
            selectedRelationId === id ? "border-primary ring-2 ring-primary/20" : "border-primary/20",
          )}
          style={{ left: labelX, top: labelY, transform: "translate(-50%, -50%)" }}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onSelectRelation(id, { x: event.clientX, y: event.clientY })
          }}
        >
          {context}
        </button>
      ))}
    </>
  )
}
