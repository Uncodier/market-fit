"use client"



export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

export function fillRounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string
) {
  roundedRect(ctx, x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
}

export function strokeRounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  stroke: string,
  lineWidth: number
) {
  roundedRect(ctx, x, y, w, h, r)
  ctx.strokeStyle = stroke
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

/**
 * Trace the path once and both fill & stroke it. Saves one full path tracing
 * (4 arcs + 4 lines) per node vs. calling fillRounded + strokeRounded. Adds up
 * on the micro band where hundreds of nodes are drawn every frame.
 */
export function fillAndStrokeRounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke: string,
  lineWidth: number
) {
  roundedRect(ctx, x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

export function drawLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string
) {
  fillRounded(ctx, x, y, w, h, h / 2, fill)
}

export function clipRounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  roundedRect(ctx, x, y, w, h, r)
  ctx.clip()
}

// (font, text) → width, to dodge Safari's expensive measureText on the hot draw path.
const measureCache = new Map<string, number>()

export const MEASURE_CACHE_MAX = 2048

export function measureCached(ctx: CanvasRenderingContext2D, text: string): number {
  const key = `${ctx.font}\u0001${text}`
  const cached = measureCache.get(key)
  if (cached !== undefined) return cached
  const w = ctx.measureText(text).width
  if (measureCache.size >= MEASURE_CACHE_MAX) {
    // Cheap FIFO eviction: clear oldest ~¼ of the cache on overflow.
    let i = 0
    for (const k of measureCache.keys()) {
      measureCache.delete(k)
      if (++i >= MEASURE_CACHE_MAX / 4) break
    }
  }
  measureCache.set(key, w)
  return w
}

export function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (measureCached(ctx, text) <= maxW) return text
  let out = text
  while (out.length > 1 && measureCached(ctx, out + "…") > maxW) {
    out = out.slice(0, -1)
  }
  return out + "…"
}
