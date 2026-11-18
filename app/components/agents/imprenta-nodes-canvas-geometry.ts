import type { GraphBBox } from "@/app/lib/graph-viewport"
import { liteNodeMarkerRect, type ImprentaLiteBand } from "@/app/lib/imprenta-canvas-draw"

/** The grid indexes original footprints, not the minimum screen-sized markers. */
export function expandMarkerQuery(box: GraphBBox, band: ImprentaLiteBand, scale: number): GraphBBox {
  if (band !== "marker") return box
  // A zero-size footprint gives the maximum extension on each side. Reuse the
  // painter's geometry so hit testing and viewport culling cannot drift from it.
  const marker = liteNodeMarkerRect(0, 0, 0, 0, scale, { x: 0, y: 0, w: 0, h: 0 })
  return {
    minX: box.minX - marker.w / 2,
    minY: box.minY - marker.h / 2,
    maxX: box.maxX + marker.w / 2,
    maxY: box.maxY + marker.h / 2,
  }
}