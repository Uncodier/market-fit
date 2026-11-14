import { act, fireEvent, render } from "@testing-library/react"
import { ImprentaNodesCanvas } from "@/app/components/agents/imprenta-nodes-canvas"
import { ImprentaParentEdgesCanvas } from "@/app/components/agents/imprenta-parent-edges-canvas"
import { createViewportStore } from "@/app/lib/imprenta-viewport-store"
import { createImprentaHoverStore } from "@/app/lib/imprenta-hover-store"
import { createImprentaDragStore } from "@/app/lib/imprenta-drag-store"
import type { InstanceNode } from "@/app/types/instance-nodes"
import type { ImprentaThumbCache } from "@/app/lib/imprenta-thumb-cache"

const node = (id: string, parent: string | null = null) => ({ id, parent_node_id: parent, type: "generate-image", status: "completed", result: {} } as InstanceNode)
const thumbs: ImprentaThumbCache = {
  get: () => null, getDisplayUrl: () => null, status: () => "idle",
  request: jest.fn(), requestPriority: jest.fn(), touch: jest.fn(),
  onDecoded: () => () => {}, clear: jest.fn(), size: () => 0,
}

describe("Imprenta stash canvas integration", () => {
  let frames: FrameRequestCallback[]
  const flush = () => act(() => { while (frames.length) frames.shift()!(0) })
  const ctx = {
    setTransform: jest.fn(), clearRect: jest.fn(), beginPath: jest.fn(),
    moveTo: jest.fn(), lineTo: jest.fn(), bezierCurveTo: jest.fn(), stroke: jest.fn(),
    strokeStyle: "", lineWidth: 1, lineCap: "round",
  }
  beforeEach(() => {
    frames = []
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => { frames.push(cb); return frames.length })
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
    jest.clearAllMocks()
  })
  afterEach(() => jest.restoreAllMocks())

  it("hit-tests overlapping candidates in reverse paint order and skips DOM cards", () => {
    const viewportStore = createViewportStore({ scale: 0.5 })
    const onDown = jest.fn()
    const props = {
      nodes: [node("parent"), node("child", "parent")],
      positions: { parent: { x: 0, y: 0 }, child: { x: 0, y: 0 } },
      heights: {}, nodeW: 100, rowH: 100, fullDetailScale: 0.7,
      liteMarkerMax: 0.08, liteMicroMax: 0.2, liteSimpleMax: 0.4,
      viewportStore, thumbs, isDarkMode: false,
      getImageUrls: () => [], getVideoUrls: () => [], onNodePointerDown: onDown,
    }
    const view = render(<ImprentaNodesCanvas {...props} />)
    const canvas = view.container.querySelector("canvas")!
    fireEvent(canvas, new MouseEvent("pointerdown", { button: 0, clientX: 10, clientY: 10, bubbles: true }))
    expect(onDown.mock.calls[0][0]).toBe("child")
    view.rerender(<ImprentaNodesCanvas {...props} skipIds={new Set(["child"])} />)
    fireEvent(canvas, new MouseEvent("pointerdown", { button: 0, clientX: 10, clientY: 10, bubbles: true }))
    expect(onDown.mock.calls[1][0]).toBe("parent")
  })

  it("deduplicates incoming/outgoing edges and supports cycle-safe viewport hover", () => {
    const viewportStore = createViewportStore({ scale: 1, canvasWidth: 800, canvasHeight: 600, hoveredNodeId: "b" })
    const props = {
      nodes: [node("a", "b"), node("b", "a")],
      positions: { a: { x: 0, y: 0 }, b: { x: 200, y: 0 } },
      nodeHeights: {}, nodeW: 100, rowH: 100, strokeStyle: "normal",
      hoverChainStroke: "highlight", viewportStore,
    }
    const strokes: string[] = []
    ctx.stroke.mockImplementation(() => { strokes.push(ctx.strokeStyle) })
    const view = render(<ImprentaParentEdgesCanvas {...props} />)
    flush()
    expect(strokes).toEqual(["highlight", "highlight"])
    const hoverStore = createImprentaHoverStore()
    view.rerender(<ImprentaParentEdgesCanvas {...props} hoverStore={hoverStore} />)
    strokes.length = 0
    flush()
    expect(strokes).toEqual(["normal", "normal"])
    act(() => hoverStore.set("b"))
    strokes.length = 0
    flush()
    expect(strokes).toEqual(["highlight", "highlight"])
  })

  it("draws an override's incoming edge even outside the cached candidate cells", () => {
    const viewportStore = createViewportStore({ scale: 1, canvasWidth: 800, canvasHeight: 600 })
    const dragStore = createImprentaDragStore()
    dragStore.set({ id: "b", x: 200, y: 0 })
    render(<ImprentaParentEdgesCanvas
      nodes={[node("a"), node("b", "a")]}
      positions={{ a: { x: 10000, y: 0 }, b: { x: 12000, y: 0 } }}
      nodeHeights={{}} nodeW={100} rowH={100} strokeStyle="normal"
      viewportStore={viewportStore} dragStore={dragStore}
    />)
    flush()
    expect(ctx.stroke).toHaveBeenCalledTimes(1)
    expect(ctx.bezierCurveTo).toHaveBeenCalledWith(10150, 50, 150, 50, 200, 50)
  })
})
