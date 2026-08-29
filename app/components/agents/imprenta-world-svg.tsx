"use client"

import { useMemo, useState, useEffect, type CSSProperties, type ReactNode, type SVGProps } from "react"
import { cn } from "@/lib/utils"
import {
  worldConnectionBezier,
  worldConnectionPathD,
  worldSvgBox,
  worldSvgLayout,
  type WorldPoint,
} from "@/app/lib/imprenta-world-svg"

type WorldSpaceSvgProps = {
  points: readonly WorldPoint[]
  pad?: number
  className?: string
  style?: CSSProperties
  children: ReactNode
} & Omit<SVGProps<SVGSVGElement>, "viewBox" | "width" | "height" | "style" | "points">

/**
 * SVG sized to its path geometry so Chrome paints strokes. Percentage
 * width/height on a collapsed (0×0) parent yields a 0×0 SVG, which Chrome
 * clips even when overflow is visible.
 */
export function WorldSpaceSvg({
  points,
  pad,
  className,
  style,
  children,
  ...rest
}: WorldSpaceSvgProps) {
  const box = useMemo(() => worldSvgBox(points, pad), [points, pad])
  if (!box) return null
  const layout = worldSvgLayout(box)
  return (
    <svg
      className={cn("imprenta-world-svg", className)}
      width={layout.width}
      height={layout.height}
      viewBox={layout.viewBox}
      overflow="visible"
      style={{ ...layout.style, width: layout.width, height: layout.height, ...style }}
      {...rest}
    >
      {children}
    </svg>
  )
}

type LoadingRouteEdge = { parentId: string; childId: string }

type LoadingRouteEdgesProps = {
  edges: LoadingRouteEdge[]
  positions: Record<string, { x: number; y: number }>
  nodeHeights: Record<string, number>
  nodeW: number
  rowH: number
}

export function ImprentaLoadingRouteEdges({
  edges,
  positions,
  nodeHeights,
  nodeW,
  rowH,
}: LoadingRouteEdgesProps) {
  const geoms = useMemo(() => {
    const out: { key: string; d: string; start: WorldPoint; end: WorldPoint }[] = []
    for (const { parentId, childId } of edges) {
      const start = positions[parentId]
      const end = positions[childId]
      if (!start || !end) continue
      const x1 = start.x + nodeW
      const y1 = start.y + (nodeHeights[parentId] || rowH) / 2
      const x2 = end.x
      const y2 = end.y + (nodeHeights[childId] || rowH) / 2
      out.push({
        key: `loading-edge-${parentId}-${childId}`,
        d: `M ${x1} ${y1} C ${x1 + 50} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`,
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
      })
    }
    return out
  }, [edges, positions, nodeHeights, nodeW, rowH])

  const points = useMemo(() => {
    const pts: WorldPoint[] = []
    for (const g of geoms) pts.push(g.start, g.end)
    return pts
  }, [geoms])

  if (geoms.length === 0) return null

  return (
    <>
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none imprenta-world-svg safari-only-svg"
        style={{ zIndex: 12, overflow: 'visible' }}
        shapeRendering="optimizeSpeed"
      >
        {geoms.map((g) => (
          <path key={g.key} d={g.d} className="imprenta-loading-edge" />
        ))}
      </svg>
      <WorldSpaceSvg
        points={points}
        className="absolute top-0 left-0 pointer-events-none chrome-only-svg"
        style={{ zIndex: 12 }}
      >
        {geoms.map((g) => (
          <path key={g.key} d={g.d} className="imprenta-loading-edge" />
        ))}
      </WorldSpaceSvg>
    </>
  )
}

type TempConnectionLineProps = {
  fromX: number
  fromY: number
  toX: number
  toY: number
}

export function ImprentaTempConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
}: TempConnectionLineProps) {
  const points = useMemo(
    () => [
      { x: fromX, y: fromY },
      { x: toX, y: toY },
    ],
    [fromX, fromY, toX, toY]
  )
  const d = worldConnectionPathD(worldConnectionBezier(fromX, fromY, toX, toY))
  
  const pathContent = (
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  )

  return (
    <>
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none text-primary imprenta-world-svg safari-only-svg"
        style={{ zIndex: 50, color: "hsl(var(--primary))", overflow: 'visible' }}
        shapeRendering="optimizeSpeed"
      >
        {pathContent}
      </svg>
      <WorldSpaceSvg
        points={points}
        className="absolute top-0 left-0 pointer-events-none text-primary chrome-only-svg"
        style={{ zIndex: 50, color: "hsl(var(--primary))" }}
      >
        {pathContent}
      </WorldSpaceSvg>
    </>
  )
}
