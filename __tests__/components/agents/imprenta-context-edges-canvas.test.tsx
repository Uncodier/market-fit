import { Profiler } from "react"
import { act, fireEvent, render } from "@testing-library/react"
import { ImprentaContextEdgesCanvas } from "@/app/components/agents/imprenta-context-edges-canvas"
import { buildContextEdgeScene } from "@/app/components/agents/imprenta-context-edges-geometry"
import { createViewportStore } from "@/app/lib/imprenta-viewport-store"
import { createImprentaHoverStore } from "@/app/lib/imprenta-hover-store"
import { createImprentaDragStore } from "@/app/lib/imprenta-drag-store"
import type { InstanceNode } from "@/app/types/instance-nodes"

jest.mock("@/app/components/agents/imprenta-context-edges-geometry", () => ({
  ...jest.requireActual("@/app/components/agents/imprenta-context-edges-geometry"),
  buildContextEdgeScene: jest.fn(jest.requireActual("@/app/components/agents/imprenta-context-edges-geometry").buildContextEdgeScene),
}))

function fixture() {
  return {
    contexts: [{ id: "relation", context_node_id: "source", target_node_id: "target", type: "reference" }],
    nodes: [{ id: "source", parent_node_id: "root" }, { id: "target" }] as InstanceNode[],
    positions: { source: { x: -1480, y: 150 }, target: { x: 1800, y: 150 } },
    nodeHeights: {}, selectedContextId: null as string | null, onSelectContext: jest.fn(),
    viewportStore: createViewportStore({ canvasWidth: 800, canvasHeight: 600 }),
    hoverStore: createImprentaHoverStore(), dragStore: createImprentaDragStore(),
  }
}
const pointer = (target: Element, name: string, x = 300, y = 300) => fireEvent(target,
  new MouseEvent(name, { button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true }))
const click = (target: Element, x = 300, y = 300) => {
  pointer(target, "pointerdown", x, y)
  pointer(target, "pointerup", x, y)
  pointer(target, "click", x, y)
}

describe("viewport context edge canvas", () => {
  let frames: Map<number, FrameRequestCallback>
  let frameId: number
  let contexts: Map<HTMLCanvasElement, ReturnType<typeof drawingContext>>
  const drawingContext = () => ({
    clearRect: jest.fn(), setTransform: jest.fn(), setLineDash: jest.fn(), beginPath: jest.fn(),
    moveTo: jest.fn(), bezierCurveTo: jest.fn(), stroke: jest.fn(), globalAlpha: 1, lineWidth: 1,
  })
  const flush = () => act(() => {
    for (let i = 0; i < 5 && frames.size; i++) {
      const pending = [...frames.values()]
      frames.clear()
      pending.forEach(callback => callback(0))
    }
  })
  beforeEach(() => {
    jest.clearAllMocks()
    frames = new Map()
    contexts = new Map()
    frameId = 0
    jest.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { frames.set(++frameId, callback); return frameId })
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation(id => { frames.delete(id) })
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      if (!contexts.has(this)) contexts.set(this, drawingContext())
      return contexts.get(this) as unknown as CanvasRenderingContext2D
    })
  })
  afterEach(() => jest.restoreAllMocks())

  it("uses only viewport-sized canvases, fallback cubic drawing, and retained graph geometry", () => {
    const props = fixture()
    const commits = jest.fn()
    const view = render(<Profiler id="edge" onRender={commits}><ImprentaContextEdgesCanvas {...props} /></Profiler>)
    flush()
    const [base, highlight] = Array.from(view.container.querySelectorAll("canvas"))
    expect(view.container.querySelector("svg")).toBeNull()
    expect(base.width).toBe(800)
    expect(base.height).toBe(600)
    expect(base.style.pointerEvents).toBe("none")
    expect(contexts.get(base)!.bezierCurveTo).toHaveBeenCalledWith(-950, 300, 1750, 300, 1800, 300)
    const initialCommits = commits.mock.calls.length
    act(() => { props.hoverStore.set("source") })
    flush()
    expect(contexts.get(base)!.clearRect).toHaveBeenCalledTimes(1)
    expect(contexts.get(highlight)!.stroke).toHaveBeenCalledTimes(1)
    act(() => {
      props.viewportStore.set({ position: { x: 20, y: 30 }, scale: .5 })
      props.viewportStore.set({ position: { x: 40, y: 50 }, scale: .2 })
    })
    flush()
    expect(contexts.get(base)!.clearRect).toHaveBeenCalledTimes(2)
    expect(contexts.get(base)!.setTransform).toHaveBeenLastCalledWith(.2, 0, 0, .2, 40, 50)
    expect(buildContextEdgeScene).toHaveBeenCalledTimes(1)
    expect(commits).toHaveBeenCalledTimes(initialCommits)
  })

  it("redraws only the overlay for selection and hover; unrelated viewport metadata does not repaint", () => {
    const props = fixture()
    const view = render(<ImprentaContextEdgesCanvas {...props} />)
    flush()
    const [base, highlight] = Array.from(view.container.querySelectorAll("canvas"))
    view.rerender(<ImprentaContextEdgesCanvas {...props} selectedContextId="relation" />)
    flush()
    expect(contexts.get(base)!.clearRect).toHaveBeenCalledTimes(1)
    expect(contexts.get(highlight)!.lineWidth).toBe(4)
    act(() => { props.hoverStore.set("source"); props.hoverStore.set("target"); props.viewportStore.setInteracting(true) })
    flush()
    expect(contexts.get(base)!.clearRect).toHaveBeenCalledTimes(1)
    expect(buildContextEdgeScene).toHaveBeenCalledTimes(1)
    view.rerender(<ImprentaContextEdgesCanvas {...props} nodeHeights={{ target: 600 }} />)
    flush()
    expect(buildContextEdgeScene).toHaveBeenCalledTimes(2)
    expect(contexts.get(base)!.bezierCurveTo).toHaveBeenLastCalledWith(-950, 300, 1750, 450, 1800, 450)
    view.rerender(<ImprentaContextEdgesCanvas {...props} nodes={[...props.nodes]} />)
    flush()
    expect(buildContextEdgeScene).toHaveBeenCalledTimes(3)
  })

  it("retains Path2D through pan, selection and hover, replacing only dragged geometry", () => {
    const makePath = jest.fn()
    const oldPath = globalThis.Path2D
    class FakePath {
      constructor() { makePath() }
      moveTo = jest.fn()
      bezierCurveTo = jest.fn()
    }
    globalThis.Path2D = FakePath as unknown as typeof Path2D
    try {
      const props = fixture()
      const view = render(<ImprentaContextEdgesCanvas {...props} />)
      flush()
      act(() => { props.viewportStore.set({ scale: .5 }); props.hoverStore.set("source") })
      flush()
      view.rerender(<ImprentaContextEdgesCanvas {...props} selectedContextId="relation" />)
      flush()
      expect(makePath).toHaveBeenCalledTimes(1)
      act(() => { props.dragStore.set({ id: "source", x: -1380, y: 250 }) })
      flush()
      expect(makePath).toHaveBeenCalledTimes(2)
      act(() => { props.dragStore.set(null) })
      flush()
      expect(makePath).toHaveBeenCalledTimes(2)
      expect(buildContextEdgeScene).toHaveBeenCalledTimes(1)
    } finally { globalThis.Path2D = oldPath }
  })

  it("delegates select/deselect through the existing callback, rejects deleted edges and cancels on unmount", () => {
    const props = fixture()
    const view = render(<ImprentaContextEdgesCanvas {...props} />)
    const canvas = view.container.querySelector("canvas")!
    click(canvas, 300, 309)
    expect(props.onSelectContext).toHaveBeenLastCalledWith("relation", { x: 300, y: 309 })
    view.rerender(<ImprentaContextEdgesCanvas {...props} selectedContextId="relation" />)
    click(canvas)
    expect(props.onSelectContext).toHaveBeenLastCalledWith(null, undefined)
    view.rerender(<ImprentaContextEdgesCanvas {...props} contexts={[]} />)
    click(canvas)
    expect(props.onSelectContext).toHaveBeenCalledTimes(2)
    view.unmount()
    flush()
    expect(frames.size).toBe(0)
  })

  it("rejects DOM ownership, late node preventDefault, prevented clicks and pan excursions >5px", () => {
    const props = fixture()
    const view = render(<div data-testid="viewport" style={{ isolation: "isolate" }}>
      <div data-node-id="card"><span data-testid="card">Card</span></div>
      <button data-testid="control">Control</button><div data-imprenta-context-control data-testid="relation-control" />
      <div><ImprentaContextEdgesCanvas {...props} /></div>
    </div>)
    const viewport = view.getByTestId("viewport")
    for (const id of ["card", "control", "relation-control"]) click(view.getByTestId(id))
    const nodeOwner = (event: Event) => event.preventDefault()
    viewport.addEventListener("pointerdown", nodeOwner)
    click(viewport)
    viewport.removeEventListener("pointerdown", nodeOwner)
    pointer(viewport, "pointerdown")
    pointer(viewport, "pointermove", 306)
    pointer(viewport, "pointermove", 300)
    pointer(viewport, "pointerup")
    pointer(viewport, "click")
    pointer(viewport, "pointerdown")
    pointer(viewport, "pointerup")
    const prevented = new MouseEvent("click", { bubbles: true, cancelable: true, clientX: 300, clientY: 300 })
    prevented.preventDefault()
    fireEvent(viewport, prevented)
    expect(props.onSelectContext).not.toHaveBeenCalled()
    click(viewport)
    expect(props.onSelectContext).toHaveBeenCalledTimes(1)
  })
})