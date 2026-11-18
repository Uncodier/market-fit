import { act, fireEvent, render } from "@testing-library/react"
import { ImprentaNodesCanvas } from "@/app/components/agents/imprenta-nodes-canvas"
import { drawLiteNode } from "@/app/lib/imprenta-canvas-draw"
import { createViewportStore } from "@/app/lib/imprenta-viewport-store"
import type { InstanceNode } from "@/app/types/instance-nodes"
import type { ImprentaThumbCache } from "@/app/lib/imprenta-thumb-cache"

jest.mock("@/app/lib/imprenta-canvas-draw", () => ({
  ...jest.requireActual("@/app/lib/imprenta-canvas-draw"),
  drawLiteNode: jest.fn(),
}))

const node = { id: "one", type: "generate-image", status: "completed", result: {} } as InstanceNode
const thumbs = { onDecoded: () => () => {}, touch: jest.fn() } as unknown as ImprentaThumbCache
const pointer = (target: Element, x: number, y: number, button = 0) =>
  fireEvent(target, new MouseEvent("pointerdown", { button, clientX: x, clientY: y, bubbles: true, cancelable: true }))

function fixture(scale = 0.05) {
  return {
    nodes: [node], positions: { one: { x: 1000, y: 1000 } }, heights: {},
    nodeW: 100, rowH: 100, fullDetailScale: 0.7,
    liteMarkerMax: 0.08, liteMicroMax: 0.2, liteSimpleMax: 0.4,
    viewportStore: createViewportStore({ scale, canvasWidth: 2000, canvasHeight: 2000 }),
    thumbs, isDarkMode: false, getImageUrls: (): string[] => [], getVideoUrls: (): string[] => [],
    onNodePointerDown: jest.fn(), onBackgroundPointerDown: jest.fn(),
  }
}

describe("Imprenta canvas rendering and delegated interaction", () => {
  let frames: Map<number, FrameRequestCallback>
  let frameId: number
  const flush = () => act(() => {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(0))
  })
  beforeEach(() => {
    frames = new Map()
    frameId = 0
    jest.clearAllMocks()
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.set(++frameId, callback)
      return frameId
    })
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => { frames.delete(id) })
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      setTransform: jest.fn(), clearRect: jest.fn(),
    } as unknown as CanvasRenderingContext2D)
  })
  afterEach(() => jest.restoreAllMocks())

  it("paints missing full-detail shells at rest until skipIds reports mounted DOM", () => {
    const props = fixture(1)
    const view = render(<ImprentaNodesCanvas {...props} />)
    flush()
    expect(drawLiteNode).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ node, band: "turbo" }))
    jest.mocked(drawLiteNode).mockClear()
    view.rerender(<ImprentaNodesCanvas {...props} skipIds={new Set([node.id])} />)
    flush()
    expect(drawLiteNode).not.toHaveBeenCalled()
    view.rerender(<ImprentaNodesCanvas {...props} skipIds={new Set()} />)
    flush()
    expect(drawLiteNode).toHaveBeenCalledTimes(1)
    pointer(view.container.querySelector("canvas")!, 1050, 1050)
    expect(props.onNodePointerDown).not.toHaveBeenCalled()
    expect(props.onBackgroundPointerDown).not.toHaveBeenCalled()
  })

  it.each([0.05, 1, 2])("keeps previews and clicks at scale %s in all-scales mode", (scale) => {
    const props = fixture(scale)
    props.positions.one = { x: 100, y: 100 }
    const view = render(<ImprentaNodesCanvas {...props} renderAtAllScales />)
    flush()
    expect(drawLiteNode).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ node, band: scale < 0.08 ? "marker" : "rich" }))
    const canvas = view.container.querySelector("canvas")!
    expect(pointer(canvas, 150 * scale, 150 * scale)).toBe(false)
    expect(props.onNodePointerDown).toHaveBeenCalledTimes(1)
    view.rerender(<ImprentaNodesCanvas {...props} renderAtAllScales skipIds={new Set([node.id])} />)
    pointer(canvas, 150 * scale, 150 * scale)
    expect(props.onNodePointerDown).toHaveBeenCalledTimes(1)
    view.rerender(<ImprentaNodesCanvas {...props} renderAtAllScales pointerEventsEnabled={false} />)
    pointer(canvas, 150 * scale, 150 * scale)
    expect(props.onNodePointerDown).toHaveBeenCalledTimes(1)
  })

  it("coalesces affected visible media, ignores offscreen decode and repeated DOM-blob notifications", () => {
    const props = fixture(0.5)
    let decode: (url: string) => void = () => {}
    const image = document.createElement("canvas")
    props.getImageUrls = () => ["/visible.png"]
    props.thumbs = { ...thumbs, get: () => image, status: () => "ready",
      onDecoded: (listener) => { decode = listener; return () => {} } } as ImprentaThumbCache
    render(<ImprentaNodesCanvas {...props} renderAtAllScales />)
    flush()
    decode("/offscreen.png")
    expect(frames.size).toBe(0)
    decode("/visible.png")
    expect(frames.size).toBe(1)
    flush()
    decode("/visible.png")
    expect(frames.size).toBe(0)
  })

  it("does not rerasterize on selection-only updates or warm viewport pan", () => {
    const ctx = { setTransform: jest.fn(), clearRect: jest.fn(), drawImage: jest.fn(),
      beginPath: jest.fn(), save: jest.fn(), restore: jest.fn(), moveTo: jest.fn(), lineTo: jest.fn(),
      quadraticCurveTo: jest.fn(), closePath: jest.fn(), stroke: jest.fn() }
    jest.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
    const props = fixture(1)
    const view = render(<ImprentaNodesCanvas {...props} renderAtAllScales />)
    flush()
    expect(drawLiteNode).toHaveBeenCalledTimes(1)
    view.rerender(<ImprentaNodesCanvas {...props} renderAtAllScales selectedId={node.id} />)
    flush()
    act(() => props.viewportStore.set({ position: { x: 10, y: 20 }, interacting: true }))
    flush()
    flush()
    expect(drawLiteNode).toHaveBeenCalledTimes(1)
    expect(ctx.drawImage).toHaveBeenCalledTimes(3)
    act(() => props.viewportStore.set({ hoveredNodeId: node.id }))
    flush()
    expect(frames.size).toBe(0)
    expect(ctx.drawImage).toHaveBeenCalledTimes(3)
  })

  it.each([[31, 52.5], [74, 52.5], [52.5, 37], [52.5, 68]])(
    "hits expanded marker edges outside the original footprint grid at .05: %s,%s",
    (x, y) => {
      const props = fixture()
      const view = render(<ImprentaNodesCanvas {...props} />)
      const canvas = view.container.querySelector("canvas")!
      pointer(canvas, x, y)
      expect(props.onNodePointerDown).toHaveBeenCalledWith(node.id, expect.anything())
      expect(props.onNodePointerDown).toHaveBeenCalledTimes(1)
      expect(props.onBackgroundPointerDown).not.toHaveBeenCalled()
      expect(canvas.style.pointerEvents).toBe("none")
    }
  )

  it("rejects broad-phase false positives and disables all callbacks during connection/drag", () => {
    const props = fixture()
    const view = render(<ImprentaNodesCanvas {...props} />)
    const canvas = view.container.querySelector("canvas")!
    pointer(canvas, 30, 52.5)
    expect(props.onNodePointerDown).not.toHaveBeenCalled()
    expect(props.onBackgroundPointerDown).toHaveBeenCalledTimes(1)
    view.rerender(<ImprentaNodesCanvas {...props} pointerEventsEnabled={false} />)
    pointer(canvas, 52.5, 52.5)
    pointer(canvas, 0, 0)
    expect(props.onNodePointerDown).not.toHaveBeenCalled()
    expect(props.onBackgroundPointerDown).toHaveBeenCalledTimes(1)
  })

  it("culls with expanded marker bounds when the original footprint is outside viewport cells", () => {
    const props = fixture()
    // Visible world x: 0..640; original footprint starts at 1000 (cell 3).
    props.viewportStore.set({ canvasWidth: 32 })
    render(<ImprentaNodesCanvas {...props} padWorld={0} />)
    flush()
    expect(drawLiteNode).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ node, band: "marker" }))
  })

  it("delegates to the shared viewport, leaving DOM cards/controls and background propagation intact", () => {
    const props = fixture()
    const domDown = jest.fn()
    const bubble = jest.fn()
    const view = render(
      <div style={{ isolation: "isolate" }} data-testid="viewport" onPointerDown={bubble}>
        <div>
          <div data-node-id="one" onPointerDown={domDown}><span data-testid="card">Card</span></div>
          <button onPointerDown={domDown}><svg data-testid="button-icon" /></button>
          <input data-testid="input" onPointerDown={domDown} />
          <div role="slider" aria-valuenow={0} data-testid="slider" onPointerDown={domDown} />
        </div>
        <div style={{ pointerEvents: "none" }}><ImprentaNodesCanvas {...props} skipIds={new Set([node.id])} /></div>
      </div>
    )
    for (const id of ["card", "button-icon", "input", "slider"]) pointer(view.getByTestId(id), 52.5, 52.5)
    expect(domDown).toHaveBeenCalledTimes(4)
    expect(props.onNodePointerDown).not.toHaveBeenCalled()
    expect(props.onBackgroundPointerDown).not.toHaveBeenCalled()
    const viewport = view.getByTestId("viewport")
    expect(pointer(viewport, 0, 0)).toBe(true)
    expect(props.onBackgroundPointerDown).toHaveBeenCalledTimes(1)
    expect(bubble).toHaveBeenCalledTimes(5)
    view.unmount()
    pointer(viewport, 0, 0)
    expect(props.onBackgroundPointerDown).toHaveBeenCalledTimes(1)
  })
})