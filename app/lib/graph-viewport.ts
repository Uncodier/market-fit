/** World-space axis-aligned box (graph coordinates). */
export type GraphBBox = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const DEFAULT_CELL = 320

/** Visible world rectangle from canvas pan/zoom (transform origin 0,0 on content). */
export function worldViewportFromCanvas(
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  position: { x: number; y: number },
  padWorld: number
): GraphBBox {
  const s = Math.max(scale, 0.001)
  return {
    minX: -position.x / s - padWorld,
    minY: -position.y / s - padWorld,
    maxX: (-position.x + canvasWidth) / s + padWorld,
    maxY: (-position.y + canvasHeight) / s + padWorld,
  }
}

export function bboxIntersects(a: GraphBBox, b: GraphBBox): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}

/** Uniform grid: cell key "cx,cy" -> node ids touching that cell. */
export function buildNodeCellGrid(
  nodeIds: string[],
  positions: Record<string, { x: number; y: number }>,
  heights: Record<string, number>,
  nodeW: number,
  defaultH: number,
  cellSize = DEFAULT_CELL
): Map<string, Set<string>> {
  const grid = new Map<string, Set<string>>()
  const add = (cx: number, cy: number, id: string) => {
    const k = `${cx},${cy}`
    let s = grid.get(k)
    if (!s) {
      s = new Set()
      grid.set(k, s)
    }
    s.add(id)
  }

  for (const id of nodeIds) {
    const p = positions[id]
    if (!p) continue
    const h = heights[id] ?? defaultH
    const minX = p.x
    const minY = p.y
    const maxX = p.x + nodeW
    const maxY = p.y + h
    const x0 = Math.floor(minX / cellSize)
    const x1 = Math.floor(maxX / cellSize)
    const y0 = Math.floor(minY / cellSize)
    const y1 = Math.floor(maxY / cellSize)
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        add(cx, cy, id)
      }
    }
  }
  return grid
}

/** Collect candidate ids from cells overlapping the viewport (may include false positives). */
export function collectIdsFromGrid(
  grid: Map<string, Set<string>>,
  viewport: GraphBBox,
  cellSize = DEFAULT_CELL
): Set<string> {
  const x0 = Math.floor(viewport.minX / cellSize)
  const x1 = Math.floor(viewport.maxX / cellSize)
  const y0 = Math.floor(viewport.minY / cellSize)
  const y1 = Math.floor(viewport.maxY / cellSize)
  const out = new Set<string>()
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      const s = grid.get(`${cx},${cy}`)
      if (s) {
        s.forEach((id) => out.add(id))
      }
    }
  }
  return out
}

/**
 * Stable key for a viewport rectangle quantized to grid cells. Subscribers can compare
 * the key across pan frames and skip expensive recomputes (visible set, DOM full-card mount)
 * when the viewport still covers the same cells.
 */
export function quantizeViewport(viewport: GraphBBox, cellSize = DEFAULT_CELL): string {
  const x0 = Math.floor(viewport.minX / cellSize)
  const x1 = Math.floor(viewport.maxX / cellSize)
  const y0 = Math.floor(viewport.minY / cellSize)
  const y1 = Math.floor(viewport.maxY / cellSize)
  return `${x0},${y0},${x1},${y1}`
}

export { DEFAULT_CELL }
