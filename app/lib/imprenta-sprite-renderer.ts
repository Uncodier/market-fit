import { drawLiteNode, drawTurboNode, liteNodeMarkerRect, type DrawLiteNodeInputs } from "./imprenta-canvas-draw"
import { createImprentaSpriteCache, type CardSprite } from "./imprenta-sprite-cache"

/** Half-octave resolution buckets: ordinary pan and small zoom changes reuse pixels. */
export function spriteResolutionBucket(value: number) {
  return 2 ** (Math.round(Math.log2(Math.max(1 / 128, Math.min(4, value || 1))) * 2) / 2)
}

export function spriteFootprint(p: Pick<DrawLiteNodeInputs, "x" | "y" | "w" | "h" | "scale" | "band">) {
  return p.band === "marker"
    ? liteNodeMarkerRect(p.x, p.y, p.w, p.h, p.scale, { x: 0, y: 0, w: 0, h: 0 })
    : { x: p.x, y: p.y, w: p.w, h: p.h }
}

/** Cap each axis AND area before allocating, including extremely tall measured cards. */
export function spriteRasterSize(w: number, h: number, bucket: number, maxPixels = 1024 * 1024) {
  if (![w, h, bucket].every((v) => Number.isFinite(v) && v > 0)) return null
  const density = Math.min(bucket, 2048 / w, 2048 / h, Math.sqrt(maxPixels) / Math.sqrt(w) / Math.sqrt(h))
  return { width: Math.max(1, Math.floor(w * density)), height: Math.max(1, Math.floor(h * density)) }
}

type FrameOptions = { dpr: number; interacting: boolean; visibleIds?: Set<string>; budgetMs?: number }
type Options = { maxBytes?: number; now?: () => number; createCanvas?: () => HTMLCanvasElement }

/** Retained painter, independent of React; counters report actual work, not estimates. */
export function createImprentaSpriteRenderer(options: Options = {}) {
  const cache = createImprentaSpriteCache(options.maxBytes)
  const now = options.now ?? (() => performance.now())
  const createCanvas = options.createCanvas ?? (() => document.createElement("canvas"))
  const identities = new WeakMap<object, number>()
  let nextIdentity = 0
  const identity = (value: unknown): string | number => {
    if (!value || typeof value !== "object") return String(value)
    if (!identities.has(value)) identities.set(value, ++nextIdentity)
    return identities.get(value)!
  }
  let frame: FrameOptions = { dpr: 1, interacting: false }
  let rasterMs = 0
  let maxPixels = 1024 * 1024
  let pending = false
  let retainedThisFrame = 0
  let unsupported = false
  const counters = { rasters: 0, blits: 0, placeholders: 0, fallbacks: 0 }

  const blit = (ctx: CanvasRenderingContext2D, sprite: CardSprite, p: DrawLiteNodeInputs) => {
    const rect = spriteFootprint(p)
    const px = rect.w * sprite.padX, py = rect.h * sprite.padY
    ctx.drawImage(sprite.canvas, rect.x - px, rect.y - py, rect.w + px * 2, rect.h + py * 2)
    counters.blits++
  }

  return {
    cache,
    beginFrame(next: FrameOptions) {
      frame = next
      rasterMs = 0
      pending = false
      retainedThisFrame = 0
      cache.protect(next.visibleIds ?? new Set())
      // Reserve two buckets/card. Quantizing population avoids reallocating for one edge card.
      const population = 2 ** Math.ceil(Math.log2(Math.max(1, next.visibleIds?.size ?? 1)))
      maxPixels = Math.min(1024 * 1024, Math.floor(cache.stats().maxBytes / 8 / population))
    },
    draw(ctx: CanvasRenderingContext2D, p: DrawLiteNodeInputs) {
      if (unsupported || typeof ctx.drawImage !== "function") {
        drawLiteNode(ctx, p)
        counters.fallbacks++
        return
      }
      if (![p.x, p.y, p.w, p.h, p.scale].every(Number.isFinite) || p.w <= 0 || p.h <= 0 || p.scale <= 0) return
      const zoom = spriteResolutionBucket(p.scale)
      const bucket = spriteResolutionBucket(zoom * spriteResolutionBucket(frame.dpr))
      const rect = spriteFootprint({ ...p, x: 0, y: 0, scale: zoom })
      const pad = p.band === "marker" ? 2 / zoom : 4
      const size = spriteRasterSize(rect.w + pad * 2, rect.h + pad * 2, bucket, maxPixels)
      if (!size) return
      const urls = [p.coverImageUrl || p.coverVideoUrl, ...p.extraImageUrls].filter((url): url is string => !!url)
      const group = JSON.stringify([identity(p.node), identity(p.node.result), p.node.type, p.node.status,
        p.node.updated_at, identity(p.node.prompt), identity(p.node.settings),
        p.w, p.h, identity(p.theme), p.band, p.drawLabel, urls, cache.mediaRevision(urls)])
      // Marker layout uses quantized zoom, but its destination footprint always uses exact zoom.
      const key = `${group}:${bucket}:${size.width}x${size.height}:${p.band === "marker" ? zoom : ""}`
      const hit = cache.get(key)
      if (hit) { blit(ctx, hit, p); return }
      const closest = cache.closest(group, bucket)
      if (frame.interacting || rasterMs >= (frame.budgetMs ?? 3.5)) {
        if (closest) blit(ctx, closest, p)
        else {
          const rect = spriteFootprint(p)
          drawTurboNode(ctx, rect.x, rect.y, rect.w, rect.h, p.scale, p.theme)
          counters.placeholders++
        }
        pending = true
        return
      }
      const started = now()
      let surface: HTMLCanvasElement | null = null
      try {
        surface = createCanvas()
        surface.width = size.width
        surface.height = size.height
        const raster = surface.getContext("2d")
        if (!raster || typeof raster.drawImage !== "function" || typeof raster.beginPath !== "function") {
          unsupported = true
          surface.width = surface.height = 0
          drawLiteNode(ctx, p)
          counters.fallbacks++
          return
        }
        const rx = size.width / (rect.w + pad * 2), ry = size.height / (rect.h + pad * 2)
        raster.setTransform(rx, 0, 0, ry, (pad - rect.x) * rx, (pad - rect.y) * ry)
        drawLiteNode(raster, { ...p, x: 0, y: 0, scale: zoom })
        counters.rasters++
        const sprite: CardSprite = { key, group, nodeId: p.node.id, bucket, canvas: surface,
          bytes: size.width * size.height * 4, urls, padX: pad / rect.w, padY: pad / rect.h }
        // Paint even when the visible working set cannot fit. Do not spin an endless warm-up loop.
        blit(ctx, sprite, p)
        if (cache.put(sprite)) retainedThisFrame++
      } catch {
        if (surface) surface.width = surface.height = 0
        // Unsupported/mock contexts retain the existing vector painter.
        unsupported = true
        drawLiteNode(ctx, p)
        counters.fallbacks++
      } finally {
        rasterMs += now() - started
      }
    },
    // A working set larger than the bounded cache must not keep scheduling forever.
    endFrame: () => pending && !frame.interacting && retainedThisFrame > 0,
    stats: () => ({ ...counters, ...cache.stats(), rasterMs }),
    dispose: () => cache.clear(),
  }
}