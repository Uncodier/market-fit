import type { ViewportSnapshot } from "@/app/lib/imprenta-viewport-store"
import { edgeToScreen, type ContextEdgeGeometry, type EdgeCubic, type EdgePoint } from "./imprenta-context-edges-geometry"

export const CONTEXT_EDGE_HIT_TOLERANCE = 10

function segmentDistanceSquared(p: EdgePoint, a: EdgePoint, b: EdgePoint): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const length = dx * dx + dy * dy
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0
  return (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2
}

const midpoint = (a: EdgePoint, b: EdgePoint): EdgePoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/** Adaptive screen-space subdivision, including collinear curves that double back.
 * Control-hull pruning bounds work far from the pointer; flatness error is <= .1px. */
export function cubicDistanceSquared(point: EdgePoint, curve: EdgeCubic, limit = Infinity): number {
  let best = limit
  const visit = (a: EdgePoint, b: EdgePoint, c: EdgePoint, d: EdgePoint, depth: number) => {
    const dx = Math.max(Math.min(a.x, b.x, c.x, d.x) - point.x, 0, point.x - Math.max(a.x, b.x, c.x, d.x))
    const dy = Math.max(Math.min(a.y, b.y, c.y, d.y) - point.y, 0, point.y - Math.max(a.y, b.y, c.y, d.y))
    if (dx * dx + dy * dy > best) return
    if (depth >= 22 || Math.max(segmentDistanceSquared(b, a, d), segmentDistanceSquared(c, a, d)) <= .01) {
      best = Math.min(best, segmentDistanceSquared(point, a, d))
      return
    }
    const ab = midpoint(a, b), bc = midpoint(b, c), cd = midpoint(c, d)
    const abc = midpoint(ab, bc), bcd = midpoint(bc, cd), center = midpoint(abc, bcd)
    visit(a, ab, abc, center, depth + 1)
    visit(center, bcd, cd, d, depth + 1)
  }
  visit(curve.start, curve.control1, curve.control2, curve.end, 0)
  return best
}

/** Nearest curve wins; reverse paint order resolves coincident/overlapping wires.
 * The tolerance is in CSS pixels, never world units or device pixels. */
export function hitContextEdge(
  edges: ContextEdgeGeometry[], point: EdgePoint,
  view: Pick<ViewportSnapshot, "scale" | "position">, tolerance = CONTEXT_EDGE_HIT_TOLERANCE,
): ContextEdgeGeometry | null {
  if (!(view.scale > 0) || !Number.isFinite(view.scale)) return null
  let hit: ContextEdgeGeometry | null = null
  let best = tolerance * tolerance
  for (let index = edges.length - 1; index >= 0; index--) {
    const edge = edges[index]
    const bounds = edge.bounds
    if (point.x < bounds.minX * view.scale + view.position.x - tolerance
      || point.x > bounds.maxX * view.scale + view.position.x + tolerance
      || point.y < bounds.minY * view.scale + view.position.y - tolerance
      || point.y > bounds.maxY * view.scale + view.position.y + tolerance) continue
    // A sentinel above the current best distinguishes a pruned curve from a hit.
    const distance = cubicDistanceSquared(point, edgeToScreen(edge, view), best + 1)
    if (distance <= best && (!hit || distance < best - 1e-8)) {
      best = distance
      hit = edge
    }
  }
  return hit
}