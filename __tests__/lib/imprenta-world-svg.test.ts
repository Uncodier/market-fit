import {
  WORLD_SVG_EDGE_PAD,
  screenToWorld,
  sizedAncestorRect,
  worldConnectionBezier,
  worldConnectionPathD,
  worldSvgBox,
  worldSvgLayout,
} from "@/app/lib/imprenta-world-svg"

describe("worldSvgBox", () => {
  it("returns null for empty or non-finite points", () => {
    expect(worldSvgBox([])).toBeNull()
    expect(worldSvgBox([{ x: NaN, y: 1 }])).toBeNull()
  })

  it("sizes the SVG so path geometry sits inside the layout box", () => {
    const box = worldSvgBox(
      [
        { x: 100, y: 50 },
        { x: 500, y: 200 },
      ],
      60
    )
    expect(box).not.toBeNull()
    expect(box.minX).toBe(40)
    expect(box.minY).toBe(-10)
    expect(box.width).toBe(520)
    expect(box.height).toBe(270)
  })

  it("includes negative coordinates so Chrome does not clip left/up edges", () => {
    const box = worldSvgBox([{ x: -80, y: -20 }, { x: 10, y: 30 }], 10)
    expect(box.minX).toBe(-90)
    expect(box.minY).toBe(-30)
    expect(box.width).toBe(110)
    expect(box.height).toBe(70)
  })

  it("uses the default pad that covers bezier handles", () => {
    const box = worldSvgBox([{ x: 0, y: 0 }, { x: 0, y: 0 }])
    expect(box.width).toBe(WORLD_SVG_EDGE_PAD * 2)
    expect(box.height).toBe(WORLD_SVG_EDGE_PAD * 2)
  })
})

describe("worldSvgLayout", () => {
  it("maps viewBox to the same origin as left/top so world path coords stay valid", () => {
    const layout = worldSvgLayout({ minX: 40, minY: -10, width: 520, height: 270 })
    expect(layout.viewBox).toBe("40 -10 520 270")
    expect(layout.style.left).toBe(40)
    expect(layout.style.top).toBe(-10)
    expect(layout.width).toBe(520)
    expect(layout.height).toBe(270)
    expect(layout.style.width).toBe(520)
    expect(layout.style.height).toBe(270)
    expect(layout.style.transform).toBe("none")
  })
})

describe("screenToWorld", () => {
  it("converts a pointer through pan and zoom into graph coordinates", () => {
    const p = screenToWorld(
      250,
      180,
      { left: 50, top: 20 },
      { x: 40, y: 10 },
      2
    )
    expect(p).toEqual({ x: 80, y: 75 })
  })

  it("does not divide by zero when scale is 0", () => {
    const p = screenToWorld(100, 100, { left: 0, top: 0 }, { x: 0, y: 0 }, 0)
    expect(p).toEqual({ x: 100, y: 100 })
  })
})

describe("sizedAncestorRect", () => {
  it("skips collapsed 0×0 layers and returns the first sized ancestor", () => {
    const outer = document.createElement("div")
    Object.defineProperty(outer, "getBoundingClientRect", {
      value: () => ({ width: 800, height: 600, left: 10, top: 20 }),
    })
    const inner = document.createElement("div")
    Object.defineProperty(inner, "getBoundingClientRect", {
      value: () => ({ width: 0, height: 0, left: 10, top: 20 }),
    })
    outer.appendChild(inner)
    document.body.appendChild(outer)
    const rect = sizedAncestorRect(inner)
    expect(rect?.width).toBe(800)
    expect(rect?.height).toBe(600)
    outer.remove()
  })
})

describe("worldConnectionBezier", () => {
  it("builds the same cubic the canvas rubber-band and SVG edges share", () => {
    const curve = worldConnectionBezier(480, 150, 720, 200)
    expect(curve).toEqual({
      x1: 480,
      y1: 150,
      cx1: 530,
      cy1: 150,
      cx2: 670,
      cy2: 200,
      x2: 720,
      y2: 200,
    })
    expect(worldConnectionPathD(curve)).toBe("M 480 150 C 530 150, 670 200, 720 200")
  })
})
