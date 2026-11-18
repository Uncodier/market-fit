import type { InstanceNode } from "@/app/types/instance-nodes"
import type { ImprentaContext } from "@/app/components/agents/imprenta-panel/data-types"
import type { ViewportSnapshot } from "@/app/lib/imprenta-viewport-store"
import {
  buildContextEdgeScene, contextEdgeInViewport, contextEdgesWithDrag, contextHoverChain,
  cubicBounds, cubicPoint, type ContextEdgeGeometry, type EdgeCubic,
} from "@/app/components/agents/imprenta-context-edges-geometry"
import { cubicDistanceSquared, hitContextEdge } from "@/app/components/agents/imprenta-context-edges-hit"
import { clipLongContextCurve } from "@/app/components/agents/imprenta-context-edges-clip"

const node = (id: string, type = "prompt", parent_node_id: string | null = null) => ({ id, type, parent_node_id }) as InstanceNode
const relation = (id = "relation", type = "reference") => ({ id, context_node_id: "source", target_node_id: "target", type }) as ImprentaContext
const viewport = (scale = 1): ViewportSnapshot => ({
  scale, position: { x: 0, y: 0 }, canvasWidth: 800, canvasHeight: 600, interacting: false, hoveredNodeId: null,
})
const edge = (curve: EdgeCubic, id = "edge"): ContextEdgeGeometry => ({ ...curve, bounds: cubicBounds(curve), id, sourceId: "source", targetId: "target" })
const line = (y: number, id = "edge") => edge({ start: { x: -100, y }, control1: { x: 100, y }, control2: { x: 700, y }, end: { x: 900, y } }, id)

describe("retained context edge geometry", () => {
  it("uses measured source centers and each publish input slot, including negative world positions", () => {
    const scene = buildContextEdgeScene([relation("content", "content"), relation("audience", "audience"), relation()],
      [node("source"), node("target", "publish")], { source: { x: -1000, y: -400 }, target: { x: -100, y: -200 } }, { source: 200, target: 500 })
    expect(scene.edges.map(e => e.start)).toEqual(Array(3).fill({ x: -520, y: -300 }))
    expect(scene.edges.map(e => e.end)).toEqual([{ x: -100, y: -100 }, { x: -100, y: 200 }, { x: -100, y: 50 }])
    const ordinary = buildContextEdgeScene([relation("content", "content")], [node("target")], scene.positions, { target: 500 }, 100, 100)
    expect(ordinary.edges[0].end.y).toBe(50)
    expect(ordinary.edges[0].start).toEqual({ x: -900, y: -350 })
  })

  it("ignores missing positions/nonfinite geometry and preserves empty graph behavior", () => {
    expect(buildContextEdgeScene([relation()], [], {}, {}).edges).toEqual([])
    expect(buildContextEdgeScene([relation()], [], { source: { x: Infinity, y: 0 }, target: { x: 0, y: 0 } }, {}).edges).toEqual([])
  })

  it("computes interior extrema rather than trusting either endpoints or the control hull", () => {
    const curve = { start: { x: 0, y: 0 }, control1: { x: 100, y: 100 }, control2: { x: 100, y: -100 }, end: { x: 0, y: 0 } }
    const bounds = cubicBounds(curve)
    expect(bounds.maxX).toBe(75)
    expect(bounds.minX).toBe(0)
    expect(bounds.maxY).toBeCloseTo(28.867513459)
    expect(bounds.minY).toBeCloseTo(-28.867513459)
    for (let t = 0; t <= 1; t += .01) {
      const point = cubicPoint(curve, t)
      expect(point.x).toBeGreaterThanOrEqual(bounds.minX - 1e-8)
      expect(point.y).toBeLessThanOrEqual(bounds.maxY + 1e-8)
    }
  })

  it("keeps viewport crossings with both nodes offscreen and overshooting backwards curves", () => {
    expect(contextEdgeInViewport(line(300), viewport(), 0)).toBe(true)
    const backward = edge({ start: { x: -5, y: 0 }, control1: { x: 45, y: 0 }, control2: { x: -55, y: 600 }, end: { x: -5, y: 600 } })
    expect(contextEdgeInViewport(backward, viewport(), 0)).toBe(true)
    expect(contextEdgeInViewport(line(-20), viewport(), 0)).toBe(false)
    expect(contextEdgeInViewport(line(300), { ...viewport(), canvasWidth: 0 })).toBe(false)
    expect(contextEdgeInViewport(line(300), viewport(0))).toBe(false)
    expect(contextEdgeInViewport(line(300), { ...viewport(.01), position: { x: 300, y: 100 } })).toBe(true)
  })

  it("updates only incident geometry for drag and restores retained edges when the drag ends", () => {
    const contexts = [relation(), { ...relation("other"), context_node_id: "other" }]
    const scene = buildContextEdgeScene(contexts, [node("source"), node("target")], {
      source: { x: 0, y: 0 }, target: { x: 1000, y: 0 }, other: { x: 0, y: 600 },
    }, {})
    const moved = contextEdgesWithDrag(scene, { id: "source", x: -200, y: 50 })
    expect(moved[0].start).toEqual({ x: 280, y: 200 })
    expect(moved[1]).toBe(scene.edges[1])
    expect(scene.edges[0].start).toEqual({ x: 480, y: 150 })
    expect(contextEdgesWithDrag(scene, null)).toBe(scene.edges)
    expect(contextEdgesWithDrag(scene, { id: "missing", x: 0, y: 0 })).toBe(scene.edges)
  })

  it("terminates cyclic and missing ancestor chains", () => {
    const nodes = new Map([node("a", "prompt", "b"), node("b", "prompt", "a")].map(n => [n.id, n]))
    expect([...contextHoverChain("a", nodes)]).toEqual(["a", "b"])
    expect([...contextHoverChain("missing", nodes)]).toEqual(["missing"])
    expect(contextHoverChain(null, nodes).size).toBe(0)
  })

  it("bounds native dash work for huge projected crossings while preserving exact cubic segments", () => {
    const curve = edge({ start: { x: -1_000_000, y: 300 }, control1: { x: -999_950, y: 300 }, control2: { x: 999_950, y: 300 }, end: { x: 1_000_000, y: 300 } })
    const parts = clipLongContextCurve(curve, viewport())
    expect(parts.length).toBeGreaterThan(0)
    expect(parts.length).toBeLessThan(20)
    const bounds = parts.map(cubicBounds)
    expect(Math.min(...bounds.map(b => b.minX))).toBeGreaterThan(-300)
    expect(Math.max(...bounds.map(b => b.maxX))).toBeLessThan(1100)
    for (const x of [0, 200, 400, 600, 800]) {
      expect(Math.min(...parts.map(part => cubicDistanceSquared({ x, y: 300 }, part)))).toBe(0)
    }
    expect(clipLongContextCurve(line(-200), viewport())).toEqual([])
  })
})

describe("screen-pixel curve hit testing", () => {
  it.each([.001, .01, .05, .2, .4, .7, 1, 2, 8])("keeps a ten-pixel tolerance at scale %s", scale => {
    const view = { ...viewport(scale), position: { x: 220, y: 160 } }
    const edges = [line(300)]
    const center = { x: 300 * scale + 220, y: 300 * scale + 160 }
    expect(hitContextEdge(edges, { ...center, y: center.y + 9 }, view)?.id).toBe("edge")
    expect(hitContextEdge(edges, { ...center, y: center.y + 11 }, view)).toBeNull()
  })

  it("finds the nearest curve across 151 wires, resolving ties in reverse paint order", () => {
    const edges = Array.from({ length: 151 }, (_, i) => line(i * 3, `edge-${i}`))
    expect(hitContextEdge(edges, { x: 300, y: 302.8 }, viewport())?.id).toBe("edge-101")
    edges.push(line(303, "last"))
    expect(hitContextEdge(edges, { x: 300, y: 303 }, viewport())?.id).toBe("last")
    expect(hitContextEdge(edges, { x: 300, y: 1000 }, viewport())).toBeNull()
  })

  it("hits curved interiors but rejects points merely within the bounding box", () => {
    const curve = edge({ start: { x: -100, y: 0 }, control1: { x: 600, y: 0 }, control2: { x: -200, y: 600 }, end: { x: 900, y: 600 } })
    expect(hitContextEdge([curve], cubicPoint(curve, .37), viewport())).toBe(curve)
    expect(hitContextEdge([curve], { x: 800, y: 50 }, viewport())).toBeNull()
  })

  it("handles collinear double-backs and degenerate points without false linearization", () => {
    const curve = { start: { x: 0, y: 0 }, control1: { x: 100, y: 0 }, control2: { x: 100, y: 0 }, end: { x: 0, y: 0 } }
    expect(cubicDistanceSquared({ x: 75, y: 0 }, curve)).toBe(0)
    expect(cubicDistanceSquared({ x: 50, y: 7 }, curve)).toBe(49)
    const point = { start: { x: -20, y: -30 }, control1: { x: -20, y: -30 }, control2: { x: -20, y: -30 }, end: { x: -20, y: -30 } }
    expect(cubicDistanceSquared({ x: -17, y: -26 }, point)).toBe(25)
  })
})