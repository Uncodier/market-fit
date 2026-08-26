export type WorldPoint = { x: number; y: number }

export type WorldSvgBox = {
  minX: number
  minY: number
  width: number
  height: number
}

/** Cubic handles extend 50px horizontally from each endpoint. */
export const WORLD_SVG_EDGE_PAD = 60

const MIN_SIZE = 1

/**
 * Bounding box for a world-space SVG so paths are inside the element's layout
 * box. Chrome clips SVG to that box even with overflow:visible when the SVG
 * is 0×0 (the graph parent collapses because every node is position:absolute).
 */
export function worldSvgBox(
  points: readonly WorldPoint[],
  pad = WORLD_SVG_EDGE_PAD
): WorldSvgBox | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  if (!Number.isFinite(minX)) return null
  minX -= pad
  minY -= pad
  maxX += pad
  maxY += pad
  return {
    minX,
    minY,
    width: Math.max(MIN_SIZE, maxX - minX),
    height: Math.max(MIN_SIZE, maxY - minY),
  }
}

export function worldSvgLayout(box: WorldSvgBox): {
  width: number
  height: number
  viewBox: string
  style: {
    position: "absolute"
    left: number
    top: number
    width: number
    height: number
    overflow: "visible"
    transform: "none"
    backfaceVisibility: "visible"
  }
} {
  return {
    width: box.width,
    height: box.height,
    viewBox: `${box.minX} ${box.minY} ${box.width} ${box.height}`,
    style: {
      position: "absolute",
      left: box.minX,
      top: box.minY,
      // CSS size beats Safari `svg { width: auto }` which otherwise collapses
      // world-space edges to the 0×0 graph parent and clips the stroke.
      width: box.width,
      height: box.height,
      overflow: "visible",
      transform: "none",
      backfaceVisibility: "visible",
    },
  }
}

/** Cubic used for context links and the in-progress connection rubber-band. */
export type WorldConnectionBezier = {
  x1: number
  y1: number
  cx1: number
  cy1: number
  cx2: number
  cy2: number
  x2: number
  y2: number
}

export function worldConnectionBezier(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): WorldConnectionBezier {
  return {
    x1: fromX,
    y1: fromY,
    cx1: fromX + 50,
    cy1: fromY,
    cx2: toX - 50,
    cy2: toY,
    x2: toX,
    y2: toY,
  }
}

export function worldConnectionPathD(curve: WorldConnectionBezier): string {
  return `M ${curve.x1} ${curve.y1} C ${curve.cx1} ${curve.cy1}, ${curve.cx2} ${curve.cy2}, ${curve.x2} ${curve.y2}`
}

/** First ancestor with a non-zero layout box (skips collapsed 0×0 graph layers). */
export function sizedAncestorRect(el: HTMLElement | null, minPx = 2): DOMRect | null {
  let cur: HTMLElement | null = el
  while (cur) {
    const r = cur.getBoundingClientRect()
    if (r.width >= minPx && r.height >= minPx) return r
    cur = cur.parentElement
  }
  return null
}

/** Screen pointer → graph coordinates using the zoomable canvas pan/zoom. */
export function screenToWorld(
  clientX: number,
  clientY: number,
  canvasRect: { left: number; top: number },
  position: { x: number; y: number },
  scale: number
): WorldPoint {
  const s = scale || 1
  return {
    x: (clientX - canvasRect.left - position.x) / s,
    y: (clientY - canvasRect.top - position.y) / s,
  }
}
