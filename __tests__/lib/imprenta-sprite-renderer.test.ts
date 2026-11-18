import { createImprentaSpriteRenderer, spriteFootprint, spriteRasterSize, spriteResolutionBucket } from "@/app/lib/imprenta-sprite-renderer"
import { createImprentaSpriteCache, type CardSprite } from "@/app/lib/imprenta-sprite-cache"
import { imprentaCanvasTheme, liteNodeMarkerRect, type DrawLiteNodeInputs } from "@/app/lib/imprenta-canvas-draw"
import type { InstanceNode } from "@/app/types/instance-nodes"

function context() {
  return {
    save: jest.fn(), restore: jest.fn(), beginPath: jest.fn(), closePath: jest.fn(),
    moveTo: jest.fn(), lineTo: jest.fn(), quadraticCurveTo: jest.fn(), clip: jest.fn(),
    fill: jest.fn(), stroke: jest.fn(), fillRect: jest.fn(), strokeRect: jest.fn(),
    arc: jest.fn(), drawImage: jest.fn(), fillText: jest.fn(), setLineDash: jest.fn(),
    setTransform: jest.fn(), measureText: jest.fn(() => ({ width: 5 })),
  } as unknown as CanvasRenderingContext2D
}

const theme = imprentaCanvasTheme(false)
function input(id = "one"): DrawLiteNodeInputs {
  return { node: { id, type: "prompt", status: "pending", result: {} } as InstanceNode,
    x: 0, y: 0, w: 480, h: 320, scale: 0.2, band: "rich", theme,
    coverImageUrl: null, coverVideoUrl: null, extraImageUrls: [], thumbs: null, drawLabel: true }
}

function fixture(options: Parameters<typeof createImprentaSpriteRenderer>[0] = {}) {
  const rasters: CanvasRenderingContext2D[] = []
  const surfaces: HTMLCanvasElement[] = []
  const renderer = createImprentaSpriteRenderer({ ...options, createCanvas: () => {
    const canvas = document.createElement("canvas")
    const ctx = context()
    canvas.getContext = jest.fn(() => ctx) as unknown as typeof canvas.getContext
    rasters.push(ctx)
    surfaces.push(canvas)
    return canvas
  } })
  return { renderer, ctx: context(), rasters, surfaces }
}

describe("retained complete card sprites", () => {
  it("runs the real painter once, then exactly one blit/card on warm pan frames", () => {
    const { renderer, ctx, rasters } = fixture()
    const p = input()
    renderer.beginFrame({ dpr: 2, interacting: false })
    renderer.draw(ctx, p)
    expect(rasters[0].fill).toHaveBeenCalled()
    expect(rasters[0].measureText).toHaveBeenCalled()
    for (let frame = 0; frame < 30; frame++) {
      renderer.beginFrame({ dpr: 2, interacting: true })
      renderer.draw(ctx, { ...p, x: frame * 10, y: frame * 2 })
    }
    expect(renderer.stats()).toMatchObject({ rasters: 1, blits: 31, placeholders: 0, fallbacks: 0 })
    expect(ctx.drawImage).toHaveBeenCalledTimes(31)
    expect(ctx.beginPath).not.toHaveBeenCalled()
    renderer.dispose()
    expect(renderer.stats()).toMatchObject({ bytes: 0, entries: 0 })
  })

  it("invalidates only changed node, theme, geometry or media; URL decode is not scene invalidation", () => {
    const { renderer, ctx } = fixture()
    const a = { ...input("a"), coverImageUrl: "/a.png" }
    const b = { ...input("b"), coverImageUrl: "/b.png" }
    const paint = (...nodes: DrawLiteNodeInputs[]) => {
      renderer.beginFrame({ dpr: 1, interacting: false, budgetMs: Infinity })
      nodes.forEach((p) => renderer.draw(ctx, p))
    }
    paint(a, b)
    renderer.cache.invalidateMedia("/a.png")
    paint(a, b)
    expect(renderer.stats().rasters).toBe(3)
    const changed = { ...a, node: { ...a.node, status: "completed" as const } }
    paint(changed, b)
    expect(renderer.stats().rasters).toBe(4)
    paint({ ...changed, h: 400 }, b)
    expect(renderer.stats().rasters).toBe(5)
    const dark = imprentaCanvasTheme(true)
    paint({ ...changed, theme: dark }, { ...b, theme: dark })
    expect(renderer.stats().rasters).toBe(7)
  })

  it("quantizes zoom/DPR, reuses closest resolution during gestures, then refines on settle", () => {
    const { renderer, ctx } = fixture()
    const p = input()
    renderer.beginFrame({ dpr: 1, interacting: false })
    renderer.draw(ctx, p)
    renderer.beginFrame({ dpr: 1.01, interacting: false })
    renderer.draw(ctx, { ...p, scale: 0.201 })
    expect(renderer.stats().rasters).toBe(1)
    renderer.beginFrame({ dpr: 2, interacting: true })
    renderer.draw(ctx, { ...p, scale: 1 })
    expect(renderer.stats()).toMatchObject({ rasters: 1, blits: 3, placeholders: 0 })
    expect(renderer.endFrame()).toBe(false)
    renderer.beginFrame({ dpr: 2, interacting: false })
    renderer.draw(ctx, { ...p, scale: 1 })
    expect(renderer.stats().rasters).toBe(2)
    expect(spriteResolutionBucket(0.2)).toBe(spriteResolutionBucket(0.201))
  })

  it("defers all cold gesture rasters and spreads settled work over the time budget", () => {
    let clock = 0
    const { renderer, ctx } = fixture({ now: () => (clock += 4) })
    const nodes = [input("a"), input("b"), input("c")]
    renderer.beginFrame({ dpr: 1, interacting: true })
    nodes.forEach((p) => renderer.draw(ctx, p))
    expect(renderer.stats()).toMatchObject({ rasters: 0, placeholders: 3 })
    expect(renderer.endFrame()).toBe(false)
    for (let i = 1; i <= 3; i++) {
      renderer.beginFrame({ dpr: 1, interacting: false })
      nodes.forEach((p) => renderer.draw(ctx, p))
      expect(renderer.stats().rasters).toBe(i)
      expect(renderer.endFrame()).toBe(i < 3)
    }
  })

  it("draws marker pixels into the exact unquantized hit footprint", () => {
    const { renderer, ctx } = fixture()
    const p = { ...input(), scale: 0.051, band: "marker" as const, x: 150, y: 250, w: 100, h: 100 }
    renderer.beginFrame({ dpr: 2, interacting: false })
    renderer.draw(ctx, p)
    const expected = liteNodeMarkerRect(p.x, p.y, p.w, p.h, p.scale, { x: 0, y: 0, w: 0, h: 0 })
    expect(spriteFootprint(p)).toEqual(expected)
    const [, x, y, w, h] = jest.mocked(ctx.drawImage).mock.calls[0] as unknown as [unknown, number, number, number, number]
    expect(x + w / 2).toBeCloseTo(expected.x + expected.w / 2)
    expect(y + h / 2).toBeCloseTo(expected.y + expected.h / 2)
    expect(w).toBeGreaterThan(expected.w) // transparent border padding, not enlarged hit area
  })

  it("caps huge/asymmetric dimensions before allocation and keeps a large visible set warm", () => {
    for (const [w, h] of [[1e12, 1e12], [500, 1e30], [1e300, 1e300]]) {
      const size = spriteRasterSize(w, h, 4)!
      expect(size.width).toBeLessThanOrEqual(2048)
      expect(size.height).toBeLessThanOrEqual(2048)
      expect(size.width * size.height * 4).toBeLessThanOrEqual(4 * 1024 * 1024)
    }
    expect(spriteRasterSize(Infinity, 50, 1)).toBeNull()
    const { renderer, ctx } = fixture({ maxBytes: 128 * 1024 })
    const nodes = Array.from({ length: 16 }, (_,i) => ({ ...input(String(i)), scale: 1 }))
    const visibleIds = new Set(nodes.map((p) => p.node.id))
    for (let i = 0; i < 2; i++) {
      renderer.beginFrame({ dpr: 2, interacting: false, budgetMs: Infinity, visibleIds })
      nodes.forEach((p) => renderer.draw(ctx, p))
    }
    expect(renderer.stats().rasters).toBe(16)
    expect(renderer.stats().bytes).toBeLessThanOrEqual(128 * 1024)
  })
})

describe("sprite byte LRU", () => {
  const sprite = (key: string): CardSprite => {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 10
    return { key, group: key, nodeId: key, bucket: 1, canvas, bytes: 400, urls: [key], padX: 0, padY: 0 }
  }
  it("evicts least recently used bytes, invalidates just one URL, and releases backing stores", () => {
    const cache = createImprentaSpriteCache(800)
    const a = sprite("a"), b = sprite("b"), c = sprite("c")
    cache.put(a); cache.put(b); cache.get("a"); cache.put(c)
    expect(cache.get("b")).toBeNull()
    expect(b.canvas.width).toBe(0)
    expect(cache.stats()).toMatchObject({ bytes: 800, entries: 2, evictions: 1 })
    cache.invalidateMedia("a")
    expect(a.canvas.width).toBe(0)
    expect(cache.get("c")).toBe(c)
    cache.clear()
    expect(c.canvas.width).toBe(0)
    expect(cache.stats().bytes).toBe(0)
  })
  it("rejects oversize allocations and removes deleted-node resources", () => {
    const cache = createImprentaSpriteCache(200)
    const a = sprite("a")
    expect(cache.put(a)).toBe(false)
    expect(a.canvas.width).toBe(0)
    const other = createImprentaSpriteCache(800)
    const b = sprite("b")
    other.put(b)
    other.retainNodes(new Set())
    expect(b.canvas.width).toBe(0)
  })
})