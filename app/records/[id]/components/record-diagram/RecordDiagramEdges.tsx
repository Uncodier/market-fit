"use client"

import { cn } from "@/lib/utils"
import {
  formatRecordEdgeType,
  type RecordDiagramEdge,
  type RecordDiagramNode,
  type RecordNodePort,
} from "@/app/records/lib/record-diagram"
import { getRecordNodePortPoint } from "./record-diagram-layout"
import { getRecordEdgeVisualStyle } from "./record-diagram-edge-style"

interface RecordDiagramEdgesProps {
  nodes: RecordDiagramNode[]
  edges: RecordDiagramEdge[]
  selectedEdgeId: string | null
  onSelectEdge: (edgeId: string, anchor: { x: number; y: number }) => void
  connectionPreview?: {
    sourceNodeId: string
    sourcePort: RecordNodePort
    to: { x: number; y: number }
  } | null
}

export function RecordDiagramEdges({
  nodes,
  edges,
  selectedEdgeId,
  onSelectEdge,
  connectionPreview,
}: RecordDiagramEdgesProps) {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const routeTotals = new Map<string, number>()
  for (const edge of edges) {
    const key = routeKey(edge.source, edge.target)
    routeTotals.set(key, (routeTotals.get(key) || 0) + 1)
  }
  const routeIndexes = new Map<string, number>()
  const paths = edges.flatMap((edge) => {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    if (!source || !target) return []
    const sourcePort = edge.metadata.sourcePort || "right"
    const targetPort = edge.metadata.targetPort || "left"
    const from = getRecordNodePortPoint(source, sourcePort)
    const to = getRecordNodePortPoint(target, targetPort)
    const key = routeKey(edge.source, edge.target)
    const routeIndex = routeIndexes.get(key) || 0
    routeIndexes.set(key, routeIndex + 1)
    const routeOffset = (routeIndex - ((routeTotals.get(key) || 1) - 1) / 2) * 36
    const path = buildPath(from, to, sourcePort, targetPort, routeOffset)
    return [{
      edge,
      visual: getRecordEdgeVisualStyle(edge.type),
      ...path,
    }]
  })

  const previewSource = connectionPreview
    ? byId.get(connectionPreview.sourceNodeId)
    : null
  const previewPath = previewSource && connectionPreview
    ? buildPath(
        getRecordNodePortPoint(previewSource, connectionPreview.sourcePort),
        connectionPreview.to,
        connectionPreview.sourcePort
      ).d
    : null

  return (
    <>
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <marker id="record-diagram-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 z" fill="currentColor" />
          </marker>
        </defs>
        {paths.map(({ edge, d, arrowPoint, startArrowPoint, visual }) => (
          <g key={edge.id}>
            <path
              d={d}
              fill="none"
              stroke="currentColor"
              markerStart={edge.metadata.bidirectional ? "url(#record-diagram-arrow)" : undefined}
              markerEnd="url(#record-diagram-arrow)"
              className={selectedEdgeId === edge.id ? "text-primary" : "text-border"}
              strokeWidth={visual.strokeWidth + (selectedEdgeId === edge.id ? 1.5 : 0)}
              strokeDasharray={visual.strokeDasharray}
              strokeLinecap={visual.strokeLinecap}
            />
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth="20"
              className="cursor-pointer"
              style={{ pointerEvents: "stroke" }}
              onClick={(event) => {
                event.stopPropagation()
                onSelectEdge(edge.id, { x: event.clientX, y: event.clientY })
              }}
            />
            <circle
              cx={arrowPoint.x}
              cy={arrowPoint.y}
              r="10"
              fill="transparent"
              role="button"
              tabIndex={0}
              aria-label={`Select relation ${edge.label || formatRecordEdgeType(edge.type)}`}
              style={{ pointerEvents: "all" }}
              onClick={(event) => {
                event.stopPropagation()
                onSelectEdge(edge.id, { x: event.clientX, y: event.clientY })
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return
                event.preventDefault()
                const rect = event.currentTarget.getBoundingClientRect()
                onSelectEdge(edge.id, {
                  x: rect.left + rect.width / 2,
                  y: rect.top + rect.height / 2,
                })
              }}
            />
            {edge.metadata.bidirectional && (
              <circle
                cx={startArrowPoint.x}
                cy={startArrowPoint.y}
                r="10"
                fill="transparent"
                role="button"
                tabIndex={0}
                aria-label={`Select reverse relation ${edge.label || formatRecordEdgeType(edge.type)}`}
                style={{ pointerEvents: "all" }}
                onClick={(event) => {
                  event.stopPropagation()
                  onSelectEdge(edge.id, { x: event.clientX, y: event.clientY })
                }}
              />
            )}
          </g>
        ))}
        {previewPath && connectionPreview && (
          <>
            <path
              data-testid="record-relation-preview"
              d={previewPath}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeDasharray="8 6"
              strokeLinecap="round"
              className="text-primary"
            />
            <circle
              cx={connectionPreview.to.x}
              cy={connectionPreview.to.y}
              r="5"
              fill="currentColor"
              className="text-primary"
            />
          </>
        )}
      </svg>
      {paths.map(({ edge, middleX, middleY, visual }) => (
        <button
          type="button"
          key={`${edge.id}-label`}
          aria-pressed={selectedEdgeId === edge.id}
          className={cn(
            "absolute z-20 inline-flex h-6 appearance-none items-center whitespace-nowrap rounded-full border bg-background px-2 text-[10px] font-medium text-primary shadow-sm transition-colors hover:bg-accent",
            selectedEdgeId === edge.id ? "border-primary ring-2 ring-primary/20" : "border-primary/20"
          )}
          style={{
            left: middleX,
            top: middleY,
            borderStyle: visual.chipBorderStyle,
            transform: "translate(-50%, -50%)",
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onSelectEdge(edge.id, { x: event.clientX, y: event.clientY })
          }}
        >
          {edge.label || formatRecordEdgeType(edge.type)}
        </button>
      ))}
    </>
  )
}

function buildPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  sourcePort: RecordNodePort,
  targetPort = inferTargetPort(from, to),
  routeOffset = 0,
) {
  const sourceVector = portVector(sourcePort)
  const targetVector = portVector(targetPort)
  const distance = Math.max(
    80,
    Math.min(240, Math.hypot(to.x - from.x, to.y - from.y) * 0.4)
  )
  const length = Math.max(Math.hypot(to.x - from.x, to.y - from.y), 1)
  const normal = { x: -(to.y - from.y) / length, y: (to.x - from.x) / length }
  const control1 = {
    x: from.x + sourceVector.x * distance + normal.x * routeOffset,
    y: from.y + sourceVector.y * distance + normal.y * routeOffset,
  }
  const control2 = {
    x: to.x + targetVector.x * distance + normal.x * routeOffset,
    y: to.y + targetVector.y * distance + normal.y * routeOffset,
  }
  const approachLength = Math.max(Math.hypot(to.x - control2.x, to.y - control2.y), 1)
  const arrowPoint = {
    x: to.x - ((to.x - control2.x) / approachLength) * 9,
    y: to.y - ((to.y - control2.y) / approachLength) * 9,
  }
  const departureLength = Math.max(Math.hypot(control1.x - from.x, control1.y - from.y), 1)
  const startArrowPoint = {
    x: from.x + ((control1.x - from.x) / departureLength) * 9,
    y: from.y + ((control1.y - from.y) / departureLength) * 9,
  }
  return {
    d: `M ${from.x} ${from.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${to.x} ${to.y}`,
    middleX: (from.x + 3 * control1.x + 3 * control2.x + to.x) / 8,
    middleY: (from.y + 3 * control1.y + 3 * control2.y + to.y) / 8,
    arrowPoint,
    startArrowPoint,
  }
}

function routeKey(source: string, target: string) {
  return [source, target].sort().join(":")
}

function portVector(port: RecordNodePort) {
  if (port === "top") return { x: 0, y: -1 }
  if (port === "bottom") return { x: 0, y: 1 }
  if (port === "left") return { x: -1, y: 0 }
  return { x: 1, y: 0 }
}

function inferTargetPort(
  from: { x: number; y: number },
  to: { x: number; y: number }
): RecordNodePort {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "left" : "right"
  return dy >= 0 ? "top" : "bottom"
}
