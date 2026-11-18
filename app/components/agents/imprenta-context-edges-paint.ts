import type { ViewportSnapshot } from "@/app/lib/imprenta-viewport-store"
import { contextEdgeInViewport, type ContextEdgeGeometry, type EdgeCubic } from "./imprenta-context-edges-geometry"
import { clipLongContextCurve } from "./imprenta-context-edges-clip"

export type ContextEdgePaths = WeakMap<ContextEdgeGeometry, { key: string; path: Path2D }>

function appendCurves(target: Path2D | CanvasRenderingContext2D, curves: EdgeCubic[]) {
  let previous: EdgeCubic | undefined
  for (const curve of curves) {
    if (!previous || previous.end.x !== curve.start.x || previous.end.y !== curve.start.y) target.moveTo(curve.start.x, curve.start.y)
    target.bezierCurveTo(curve.control1.x, curve.control1.y, curve.control2.x, curve.control2.y, curve.end.x, curve.end.y)
    previous = curve
  }
}

/** Retain world-space paths across viewport/hover changes; immediate mode works in
 * environments without Path2D (including the offline component test canvas). */
function strokeEdge(ctx: CanvasRenderingContext2D, edge: ContextEdgeGeometry, paths: ContextEdgePaths, view: ViewportSnapshot) {
  const bounds = edge.bounds
  const long = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * view.scale > 8192
  const key = long ? `${view.scale}:${view.position.x}:${view.position.y}:${view.canvasWidth}:${view.canvasHeight}` : "world"
  if (typeof Path2D !== "undefined") {
    let cached = paths.get(edge)
    if (!cached || cached.key !== key) {
      const path = new Path2D()
      appendCurves(path, long ? clipLongContextCurve(edge, view) : [edge])
      cached = { key, path }
      paths.set(edge, cached)
    }
    ctx.stroke(cached.path)
  } else {
    ctx.beginPath()
    appendCurves(ctx, long ? clipLongContextCurve(edge, view) : [edge])
    ctx.stroke()
  }
}

export function paintContextEdgeLayer(
  canvas: HTMLCanvasElement, view: ViewportSnapshot, edges: ContextEdgeGeometry[], paths: ContextEdgePaths,
  color: string, overlay?: { selectedId: string | null; hoverChain: Set<string> },
) {
  const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
  const width = Math.max(0, Math.round(view.canvasWidth * dpr))
  const height = Math.max(0, Math.round(view.canvasHeight * dpr))
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)
  if (!(view.scale > 0) || !Number.isFinite(view.scale) || !width || !height) return
  const scale = view.scale
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * view.position.x, dpr * view.position.y)
  ctx.strokeStyle = color
  ctx.globalAlpha = overlay ? 1 : .3
  ctx.lineCap = "round"
  ctx.setLineDash([4 / scale, 4 / scale])
  for (const edge of edges) {
    const selected = overlay?.selectedId === edge.id
    if (overlay && !selected && !overlay.hoverChain.has(edge.sourceId) && !overlay.hoverChain.has(edge.targetId)) continue
    if (!contextEdgeInViewport(edge, view)) continue
    ctx.lineWidth = (selected ? 4 : overlay ? 3 : 2) / scale
    strokeEdge(ctx, edge, paths, view)
  }
}