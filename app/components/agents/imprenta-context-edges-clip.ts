import type { ViewportSnapshot } from "@/app/lib/imprenta-viewport-store"
import type { EdgeCubic, EdgePoint } from "./imprenta-context-edges-geometry"

const middle = (a: EdgePoint, b: EdgePoint): EdgePoint => ({ x: a.x / 2 + b.x / 2, y: a.y / 2 + b.y / 2 })

/** Bound native dash generation for extremely long curves. Canvas bitmap clipping
 * alone does not prevent WebKit from tessellating miles of offscreen dashes.
 * De Casteljau subdivision preserves the cubic exactly, rejecting only disjoint
 * control hulls; retained ordinary paths do not need this viewport-specific work. */
export function clipLongContextCurve(curve: EdgeCubic, view: ViewportSnapshot): EdgeCubic[] {
  const padding = 8 / view.scale
  const minX = -view.position.x / view.scale - padding
  const minY = -view.position.y / view.scale - padding
  const maxX = (view.canvasWidth - view.position.x) / view.scale + padding
  const maxY = (view.canvasHeight - view.position.y) / view.scale + padding
  const out: EdgeCubic[] = []
  const visit = (part: EdgeCubic, depth: number) => {
    const { start: a, control1: b, control2: c, end: d } = part
    const left = Math.min(a.x, b.x, c.x, d.x), right = Math.max(a.x, b.x, c.x, d.x)
    const top = Math.min(a.y, b.y, c.y, d.y), bottom = Math.max(a.y, b.y, c.y, d.y)
    if (right < minX || left > maxX || bottom < minY || top > maxY) return
    if ((left >= minX && right <= maxX && top >= minY && bottom <= maxY)
      || (Math.max(right - left, bottom - top) * view.scale <= 256) || depth >= 32) {
      out.push(part)
      return
    }
    const ab = middle(a, b), bc = middle(b, c), cd = middle(c, d)
    const abc = middle(ab, bc), bcd = middle(bc, cd), center = middle(abc, bcd)
    visit({ start: a, control1: ab, control2: abc, end: center }, depth + 1)
    visit({ start: center, control1: bcd, control2: cd, end: d }, depth + 1)
  }
  visit(curve, 0)
  return out
}