import type { CSSProperties } from "react"

type GridStyle = CSSProperties & Record<`--shop-${string}`, number | string>

export function pendingGridLayout(loadedCount: number, pendingCount: number, columns: number) {
  const remainder = loadedCount % columns
  const partialCount = remainder ? Math.min(pendingCount, columns - remainder) : 0
  return { partialCount, rows: Math.ceil((pendingCount - partialCount) / columns) }
}

/** CSS chooses the correct values before hydration and on every breakpoint change. */
export function pendingGridStyles(loadedCount: number, pendingCount: number) {
  const rows: GridStyle = {}
  const maxPartial = Math.max(...[1, 2, 3, 4].map((columns) => pendingGridLayout(loadedCount, pendingCount, columns).partialCount))
  const partial: GridStyle[] = Array.from({ length: maxPartial }, () => ({}))
  for (const columns of [1, 2, 3, 4]) {
    const layout = pendingGridLayout(loadedCount, pendingCount, columns)
    rows[`--shop-rows-${columns}`] = layout.rows
    rows[`--shop-display-${columns}`] = layout.rows ? "block" : "none"
    partial.forEach((style, index) => {
      style[`--shop-display-${columns}`] = index < layout.partialCount ? "block" : "none"
    })
  }
  return { rows, partial }
}

/** Bound detailed skeletons to the viewport plus overscan, even inside a huge category. */
export function pendingRowWindow({
  top, height, rows, gap, viewportHeight, overscan = 400,
}: {
  top: number
  height: number
  rows: number
  gap: number
  viewportHeight: number
  overscan?: number
}) {
  if (!rows || height <= 0 || top > viewportHeight + overscan || top + height < -overscan) {
    return { start: 0, end: 0, stride: 0 }
  }
  const stride = (height + gap) / rows
  const start = Math.max(0, Math.min(rows, Math.floor((-overscan - top) / stride)))
  const end = Math.max(start, Math.min(rows, Math.ceil((viewportHeight + overscan - top) / stride)))
  return { start, end, stride }
}