"use client"

import { useMemo, type CSSProperties, type ReactNode, type SVGProps } from "react"
import {
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
} & Omit<SVGProps<SVGSVGElement>, "viewBox" | "width" | "height" | "style">

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
      className={className}
      width={layout.width}
      height={layout.height}
      viewBox={layout.viewBox}
      style={{ ...layout.style, ...style }}
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
  visibleNodeIds: Set<string> | null
}

export function ImprentaLoadingRouteEdges({
  edges,
  positions,
  nodeHeights,
  nodeW,
  rowH,
  visibleNodeIds,
}: LoadingRouteEdgesProps) {
  const geoms = useMemo(() => {
    const out: { key: string; d: string; start: WorldPoint; end: WorldPoint }[] = []
    for (const { parentId, childId } of edges) {
      if (visibleNodeIds && !visibleNodeIds.has(parentId) && !visibleNodeIds.has(childId)) continue
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
  }, [edges, positions, nodeHeights, nodeW, rowH, visibleNodeIds])

  const points = useMemo(() => {
    const pts: WorldPoint[] = []
    for (const g of geoms) pts.push(g.start, g.end)
    return pts
  }, [geoms])

  if (geoms.length === 0) return null

  return (
    <WorldSpaceSvg
      points={points}
      className="pointer-events-none"
      style={{ zIndex: 12 }}
    >
      {geoms.map((g) => (
        <path key={g.key} d={g.d} className="imprenta-loading-edge" />
      ))}
    </WorldSpaceSvg>
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
  const d = `M ${fromX} ${fromY} C ${fromX + 50} ${fromY}, ${toX - 50} ${toY}, ${toX} ${toY}`
  return (
    <WorldSpaceSvg
      points={points}
      className="pointer-events-none"
      style={{ zIndex: 50 }}
      shapeRendering="optimizeSpeed"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-primary"
      />
    </WorldSpaceSvg>
  )
}
