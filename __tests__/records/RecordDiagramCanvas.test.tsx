import { fireEvent, render, screen } from "@testing-library/react"
import { RecordDiagramCanvas } from "@/app/records/[id]/components/record-diagram/RecordDiagramCanvas"

describe("RecordDiagramCanvas", () => {
  beforeEach(() => {
    jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 1000,
      height: 800,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("provides Imprenta-style zoom, fit, and arrange controls", () => {
    const onViewportChange = jest.fn()
    const onSort = jest.fn()
    render(
      <RecordDiagramCanvas
        bounds={{ width: 500, height: 400 }}
        initialViewport={{ x: 0, y: 0, zoom: 1 }}
        onSort={onSort}
        onViewportChange={onViewportChange}
      >
        <div>Diagram</div>
      </RecordDiagramCanvas>
    )

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }))
    expect(onViewportChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ zoom: 1.15 })
    )

    fireEvent.keyDown(window, { key: "-" })
    expect(onViewportChange).toHaveBeenCalledTimes(2)

    fireEvent.keyDown(window, { key: "1" })
    expect(onViewportChange).toHaveBeenLastCalledWith({ x: 250, y: 200, zoom: 1 })

    fireEvent.keyDown(window, { key: "L", shiftKey: true })
    expect(onSort).toHaveBeenCalledTimes(1)
  })

  it("does not apply diagram shortcuts while typing", () => {
    const onViewportChange = jest.fn()
    render(
      <RecordDiagramCanvas
        bounds={{ width: 500, height: 400 }}
        initialViewport={{ x: 0, y: 0, zoom: 1 }}
        onSort={jest.fn()}
        onViewportChange={onViewportChange}
      >
        <input aria-label="Node content" />
      </RecordDiagramCanvas>
    )

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Node content" }), { key: "+" })
    expect(onViewportChange).not.toHaveBeenCalled()
  })

  it("zooms at the trackpad pointer on a pinch gesture", () => {
    const onViewportChange = jest.fn()
    render(
      <RecordDiagramCanvas
        bounds={{ width: 500, height: 400 }}
        initialViewport={{ x: 0, y: 0, zoom: 1 }}
        onSort={jest.fn()}
        onViewportChange={onViewportChange}
      >
        <div>Diagram</div>
      </RecordDiagramCanvas>
    )

    fireEvent.wheel(screen.getByTestId("record-diagram-canvas"), {
      ctrlKey: true,
      deltaY: -20,
      clientX: 400,
      clientY: 300,
    })

    expect(onViewportChange).toHaveBeenCalledWith({
      zoom: expect.any(Number),
      x: expect.any(Number),
      y: expect.any(Number),
    })
    expect(onViewportChange.mock.calls[0][0].zoom).toBeGreaterThan(1)
  })

  it("centers and fits the current node selection", () => {
    const onViewportChange = jest.fn()
    render(
      <RecordDiagramCanvas
        bounds={{ width: 1800, height: 1200 }}
        selectionBounds={{ x: 600, y: 300, width: 400, height: 240 }}
        initialViewport={{ x: 0, y: 0, zoom: 1 }}
        onSort={jest.fn()}
        onViewportChange={onViewportChange}
      >
        <div>Diagram</div>
      </RecordDiagramCanvas>
    )

    fireEvent.click(screen.getByRole("button", { name: "Fit selection" }))
    expect(onViewportChange).toHaveBeenCalledWith({
      zoom: 2,
      x: -1100,
      y: -440,
    })
  })

  it("renders the selected canvas background without moving content", () => {
    const props = {
      bounds: { width: 500, height: 400 },
      initialViewport: { x: 20, y: 30, zoom: 1 },
      onSort: jest.fn(),
      onViewportChange: jest.fn(),
    }
    const { rerender } = render(
      <RecordDiagramCanvas {...props} background="columns">
        <div>Diagram</div>
      </RecordDiagramCanvas>
    )
    const canvas = screen.getByTestId("record-diagram-canvas")
    expect(canvas.style.backgroundSize).toBe("320px 100%")

    rerender(
      <RecordDiagramCanvas {...props} background="plain">
        <div>Diagram</div>
      </RecordDiagramCanvas>
    )
    expect(canvas.style.backgroundSize).toBe("")
  })

  it("preserves a changed background when zooming", () => {
    const onViewportChange = jest.fn()
    const props = {
      bounds: { width: 500, height: 400 },
      initialViewport: { x: 20, y: 30, zoom: 1 },
      onSort: jest.fn(),
      onViewportChange,
    }
    const { rerender } = render(
      <RecordDiagramCanvas {...props} background="dots">
        <div>Diagram</div>
      </RecordDiagramCanvas>
    )

    rerender(
      <RecordDiagramCanvas {...props} background="columns">
        <div>Diagram</div>
      </RecordDiagramCanvas>
    )
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }))

    expect(onViewportChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ background: "columns", zoom: 1.15 })
    )
  })
})
