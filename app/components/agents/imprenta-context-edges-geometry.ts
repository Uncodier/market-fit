import type { InstanceNode } from "@/app/types/instance-nodes"
import type { ImprentaDragPreview } from "@/app/lib/imprenta-drag-store"
import type { ViewportSnapshot } from "@/app/lib/imprenta-viewport-store"
import type { ImprentaContext } from "./imprenta-panel/data-types"
import { getPublishContextAnchorY } from "./imprenta-publish-relations"

export type EdgePoint = { x: number; y: number }
export type EdgeBounds = { minX: number; minY: number; maxX: number; maxY: number }
export type EdgeCubic = { start: EdgePoint; control1: EdgePoint; control2: EdgePoint; end: EdgePoint }
export type ContextEdgeGeometry = EdgeCubic & {
  id: string
  sourceId: string
  targetId: string
  bounds: EdgeBounds
}
export type ContextEdgeScene = {
  edges: ContextEdgeGeometry[]
  nodesById: Map<string, InstanceNode>
  positions: Record<string, EdgePoint>
}

function coordinateAt(a: number, b: number, c: number, d: number, t: number) {
  const u = 1 - t
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d
}

export function cubicPoint(curve: EdgeCubic, t: number): EdgePoint {
  const { start: a, control1: b, control2: c, end: d } = curve
  return { x: coordinateAt(a.x, b.x, c.x, d.x, t), y: coordinateAt(a.y, b.y, c.y, d.y, t) }
}

function coordinateBounds(a: number, b: number, c: number, d: number): [number, number] {
  const values = [a, d]
  const qa = -a + 3 * b - 3 * c + d
  const qb = 2 * (a - 2 * b + c)
  const qc = b - a
  const roots: number[] = []
  if (Math.abs(qa) < 1e-12) {
    if (Math.abs(qb) > 1e-12) roots.push(-qc / qb)
  } else {
    const discriminant = qb * qb - 4 * qa * qc
    if (discriminant >= 0) {
      const sqrt = Math.sqrt(discriminant)
      roots.push((-qb + sqrt) / (2 * qa), (-qb - sqrt) / (2 * qa))
    }
  }
  for (const t of roots) if (t > 0 && t < 1) values.push(coordinateAt(a, b, c, d, t))
  return [Math.min(...values), Math.max(...values)]
}

/** Exact cubic extrema, not endpoint bounds: backwards wires can overshoot. */
export function cubicBounds(curve: EdgeCubic): EdgeBounds {
  const { start: a, control1: b, control2: c, end: d } = curve
  const [minX, maxX] = coordinateBounds(a.x, b.x, c.x, d.x)
  const [minY, maxY] = coordinateBounds(a.y, b.y, c.y, d.y)
  return { minX, minY, maxX, maxY }
}

function makeEdge(id: string, sourceId: string, targetId: string, start: EdgePoint, end: EdgePoint): ContextEdgeGeometry {
  const curve = { start, control1: { x: start.x + 50, y: start.y }, control2: { x: end.x - 50, y: end.y }, end }
  return { id, sourceId, targetId, ...curve, bounds: cubicBounds(curve) }
}

/** Call only when graph references change; hover/selection never belong in this cache. */
export function buildContextEdgeScene(
  contexts: ImprentaContext[], nodes: InstanceNode[], positions: Record<string, EdgePoint>,
  heights: Record<string, number>, nodeW = 480, rowH = 300,
): ContextEdgeScene {
  const nodesById = new Map(nodes.map(node => [node.id, node]))
  const edges: ContextEdgeGeometry[] = []
  for (const context of contexts) {
    const source = positions[context.context_node_id]
    const target = positions[context.target_node_id]
    if (!source || !target) continue
    const start = { x: source.x + nodeW, y: source.y + (heights[context.context_node_id] || rowH) / 2 }
    const end = {
      x: target.x,
      y: target.y + getPublishContextAnchorY(nodesById.get(context.target_node_id)?.type, context.type, heights[context.target_node_id] || rowH),
    }
    if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) continue
    edges.push(makeEdge(context.id, context.context_node_id, context.target_node_id, start, end))
  }
  return { edges, nodesById, positions }
}

/** Reuse every unaffected geometry/path while a node moves in the external store. */
export function contextEdgesWithDrag(scene: ContextEdgeScene, drag: ImprentaDragPreview): ContextEdgeGeometry[] {
  if (!drag || !scene.positions[drag.id] || !Number.isFinite(drag.x) || !Number.isFinite(drag.y)) return scene.edges
  const origin = scene.positions[drag.id]
  const shift = (point: EdgePoint) => ({ x: point.x + drag.x - origin.x, y: point.y + drag.y - origin.y })
  return scene.edges.map(edge => {
    if (edge.sourceId !== drag.id && edge.targetId !== drag.id) return edge
    return makeEdge(edge.id, edge.sourceId, edge.targetId,
      edge.sourceId === drag.id ? shift(edge.start) : edge.start,
      edge.targetId === drag.id ? shift(edge.end) : edge.end)
  })
}

export function contextHoverChain(id: string | null, nodesById: Map<string, InstanceNode>): Set<string> {
  const chain = new Set<string>()
  while (id && !chain.has(id)) {
    chain.add(id)
    id = nodesById.get(id)?.parent_node_id || null
  }
  return chain
}

/** Conservative culling with tight curve bounds; crossing edges need no visible node. */
export function contextEdgeInViewport(edge: ContextEdgeGeometry, view: ViewportSnapshot, paddingPx = 4): boolean {
  if (!(view.scale > 0) || !Number.isFinite(view.scale) || view.canvasWidth <= 0 || view.canvasHeight <= 0) return false
  const { minX, minY, maxX, maxY } = edge.bounds
  const { x, y } = view.position
  return maxX * view.scale + x >= -paddingPx && minX * view.scale + x <= view.canvasWidth + paddingPx
    && maxY * view.scale + y >= -paddingPx && minY * view.scale + y <= view.canvasHeight + paddingPx
}

export function edgeToScreen(curve: EdgeCubic, view: Pick<ViewportSnapshot, "scale" | "position">): EdgeCubic {
  const project = (p: EdgePoint) => ({ x: p.x * view.scale + view.position.x, y: p.y * view.scale + view.position.y })
  return { start: project(curve.start), control1: project(curve.control1), control2: project(curve.control2), end: project(curve.end) }
}