import { useRef, useState } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import {
  RecordDiagramView,
  type RecordDiagramEditorHandle,
  type RecordDiagramEditState,
} from "@/app/records/[id]/components/record-diagram/RecordDiagramView"
import { RecordDiagramEditControls } from "@/app/records/[id]/components/record-diagram/RecordDiagramEditControls"
import type { RecordDiagramDraft } from "@/app/records/lib/record-diagram"

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock("remark-gfm", () => ({ __esModule: true, default: jest.fn() }))

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ unoptimized: _unoptimized, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & {
    unoptimized?: boolean
  }) => <img {...props} />,
}))

const mockUploadAssetFile = jest.fn()
jest.mock("@/app/assets/actions", () => ({
  uploadAssetFile: (...args: unknown[]) => mockUploadAssetFile(...args),
}))

jest.mock("@/app/records/[id]/components/record-diagram/RecordDiagramCanvas", () => ({
  RecordDiagramCanvas: ({
    children,
    extraControls,
    floatingPanel,
    initialViewport,
    onViewportChange,
    onWorldPointerMove,
  }: any) => (
    <div>
      <div>{extraControls}</div>
      <div>{floatingPanel}</div>
      <output aria-label="Initial viewport">
        {initialViewport.x},{initialViewport.y},{initialViewport.zoom}
      </output>
      <button
        type="button"
        onClick={() => onViewportChange({ x: 120, y: -40, zoom: 1.5 })}
      >
        Move viewport
      </button>
      <button
        type="button"
        onClick={() => onWorldPointerMove?.({ x: 700, y: 420 })}
      >
        Move relation cursor
      </button>
      <div>{children}</div>
    </div>
  ),
}))

jest.mock("@/app/lib/imprenta-viewport-store", () => ({
  createViewportStore: () => ({
    get: () => ({ scale: 1 }),
    set: jest.fn(),
    subscribe: jest.fn(() => () => undefined),
  }),
}))

const sourceId = "00000000-0000-4000-8000-000000000001"
const targetId = "00000000-0000-4000-8000-000000000002"

function Harness({
  initial,
  onDirty = jest.fn(),
}: {
  initial: RecordDiagramDraft
  onDirty?: jest.Mock
}) {
  const [diagram, setDiagram] = useState(initial)
  const editorRef = useRef<RecordDiagramEditorHandle>(null)
  const [editState, setEditState] = useState<RecordDiagramEditState>({
    canUndo: false,
    canRedo: false,
    hasSelection: false,
    canPaste: false,
    isEditingNodeContent: false,
  })
  return (
    <>
      <RecordDiagramEditControls
        {...editState}
        background={diagram.viewport.background || "dots"}
        onUndo={() => editorRef.current?.undo()}
        onRedo={() => editorRef.current?.redo()}
        onCopy={() => editorRef.current?.copy()}
        onPaste={() => editorRef.current?.paste()}
        onDuplicate={() => editorRef.current?.duplicate()}
        onDelete={() => editorRef.current?.deleteSelection()}
        onLayout={(layout) => editorRef.current?.applyLayout(layout)}
        onBackground={(background) => editorRef.current?.setBackground(background)}
      />
      <RecordDiagramView
        ref={editorRef}
        diagram={diagram}
        onEditStateChange={setEditState}
        onChange={(next) => {
          onDirty(next)
          setDiagram(next)
        }}
      />
    </>
  )
}

function emptyDiagram(): RecordDiagramDraft {
  return {
    revision: 0,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    edges: [],
  }
}

describe("RecordDiagramView", () => {
  beforeEach(() => {
    mockUploadAssetFile.mockReset()
    let next = 100
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: jest.fn(
        () => `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`
      ),
    })
  })

  it("uploads and persists images from the node options menu", async () => {
    const onDirty = jest.fn()
    mockUploadAssetFile.mockResolvedValue({
      path: "https://example.com/customer-signal.png",
    })
    const { container } = render(<Harness
      initial={{
        ...emptyDiagram(),
        nodes: [{
          id: sourceId,
          kind: "concept",
          title: "Source",
          content: "",
          metadata: {},
          position: { x: 80, y: 80 },
        }],
      }}
      onDirty={onDirty}
    />)

    expect(screen.getByRole("button", { name: "Options for Source" })).toBeInTheDocument()
    const inputs = container.querySelectorAll<HTMLInputElement>('input[accept="image/*"]')
    const input = inputs[inputs.length - 1]
    expect(input).not.toBeNull()
    fireEvent.change(input!, {
      target: {
        files: [new File(["image"], "customer-signal.png", { type: "image/png" })],
      },
    })

    await waitFor(() => expect(mockUploadAssetFile).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onDirty).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nodes: [expect.objectContaining({
          metadata: expect.objectContaining({
            attachments: [expect.objectContaining({
              name: "customer-signal.png",
              kind: "image",
            })],
          }),
        })],
      })
    ))
  })

  it("opens node options on click and applies a direct menu selection", async () => {
    const onDirty = jest.fn()
    render(<Harness
      initial={{
        ...emptyDiagram(),
        nodes: [{
          id: sourceId,
          kind: "concept",
          title: "Source",
          content: "",
          metadata: {},
          position: { x: 80, y: 80 },
        }],
      }}
      onDirty={onDirty}
    />)

    fireEvent.click(screen.getByRole("button", { name: "Options for Source" }))
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Decision" }))

    expect(onDirty).toHaveBeenLastCalledWith(expect.objectContaining({
      nodes: [expect.objectContaining({ kind: "decision" })],
    }))
    expect(document.querySelector('[data-node-kind="decision"]')).toBeInTheDocument()
  })

  it("creates an attachment node from the canvas toolbar", async () => {
    const onDirty = jest.fn()
    mockUploadAssetFile.mockResolvedValue({
      path: "https://example.com/brief.pdf",
    })
    const { container } = render(
      <Harness initial={emptyDiagram()} onDirty={onDirty} />
    )

    expect(screen.getByRole("button", { name: "Image" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "File" })).toBeInTheDocument()
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]:not([accept])')
    fireEvent.change(fileInput!, {
      target: {
        files: [new File(["brief"], "brief.pdf", { type: "application/pdf" })],
      },
    })

    await waitFor(() => expect(onDirty).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([expect.objectContaining({
          kind: "source",
          title: "brief.pdf",
          metadata: expect.objectContaining({
            attachments: [expect.objectContaining({ kind: "file" })],
          }),
        })]),
      })
    ))
  })

  it("initializes, edits, and deletes the first node while preserving draft state", () => {
    const onDirty = jest.fn()
    render(<Harness initial={emptyDiagram()} onDirty={onDirty} />)

    const title = screen.getByRole("textbox", { name: "Node title" })
    expect(title).toHaveValue("New node")

    fireEvent.change(title, { target: { value: "Customer signal" } })
    expect(screen.getByRole("textbox", { name: "Node title" })).toHaveValue("Customer signal")
    expect(onDirty).toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Delete Customer signal" }))
    expect(screen.queryByRole("textbox", { name: "Node title" })).not.toBeInTheDocument()
  })

  it("creates and removes a directed relation", () => {
    const onDirty = jest.fn()
    render(<Harness onDirty={onDirty} initial={{
      ...emptyDiagram(),
      nodes: [
        {
          id: sourceId,
          kind: "concept",
          title: "Source",
          content: "",
          metadata: {},
          position: { x: 80, y: 80 },
        },
        {
          id: targetId,
          kind: "decision",
          title: "Target",
          content: "",
          metadata: {},
          position: { x: 520, y: 80 },
        },
      ],
    }} />)

    expect(screen.getAllByRole("button", { name: /Connector .* for Source/ })).toHaveLength(4)
    fireEvent.click(screen.getByRole("button", { name: "Connector top for Source" }))
    fireEvent.click(screen.getByRole("button", { name: "Connector bottom for Target" }))
    expect(onDirty).toHaveBeenLastCalledWith(expect.objectContaining({
      edges: [expect.objectContaining({
        metadata: { sourcePort: "top", targetPort: "bottom" },
      })],
    }))
    const relation = screen.getByRole("button", { name: "Relates To" })
    expect(relation).toBeInTheDocument()
    expect(relation).toHaveClass("h-6", "transition-colors")
    expect(relation).toHaveStyle({ transform: "translate(-50%, -50%)" })

    fireEvent.click(screen.getByRole("button", { name: "Select relation Relates To" }), {
      clientX: 280,
      clientY: 180,
    })
    expect(screen.getByLabelText("Relation editor")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Close relation editor" }))

    fireEvent.click(relation, { clientX: 300, clientY: 200 })
    const relationEditor = screen.getByLabelText("Relation editor")
    expect(relationEditor).toBeInTheDocument()
    expect(relationEditor.parentElement).toHaveStyle({ left: "310px", top: "210px" })
    const twoWay = screen.getByRole("button", { name: "Two-way relation" })
    expect(twoWay).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(twoWay)
    expect(twoWay).toHaveAttribute("aria-pressed", "true")
    expect(document.querySelector('path[marker-start]')).toHaveAttribute(
      "marker-start",
      "url(#record-diagram-arrow)",
    )
    expect(screen.getByRole("button", { name: "Select reverse relation Relates To" }))
      .toBeInTheDocument()
    expect(onDirty).toHaveBeenLastCalledWith(expect.objectContaining({
      edges: [expect.objectContaining({
        metadata: expect.objectContaining({ bidirectional: true }),
      })],
    }))
    fireEvent.change(screen.getByRole("textbox", { name: "Relation label" }), {
      target: { value: "Supports" },
    })
    expect(onDirty).toHaveBeenLastCalledWith(expect.objectContaining({
      edges: [expect.objectContaining({ label: "Supports" })],
    }))
    fireEvent.click(screen.getByRole("button", { name: "Delete relation" }))
    expect(screen.queryByRole("button", { name: "Relates To" })).not.toBeInTheDocument()
  })

  it("supports multi-select copy, paste, undo, and redo from the canvas toolbar", () => {
    const onDirty = jest.fn()
    const { container } = render(<Harness onDirty={onDirty} initial={{
      ...emptyDiagram(),
      nodes: [
        {
          id: sourceId,
          kind: "concept",
          title: "Source",
          content: "",
          metadata: {},
          position: { x: 80, y: 80 },
        },
        {
          id: targetId,
          kind: "decision",
          title: "Target",
          content: "",
          metadata: {},
          position: { x: 520, y: 80 },
        },
      ],
      edges: [{
        id: "00000000-0000-4000-8000-000000000003",
        source: sourceId,
        target: targetId,
        type: "supports",
        metadata: { sourcePort: "right", targetPort: "left" },
      }],
    }} />)

    expect(screen.queryByRole("button", { name: "Copy selected nodes" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Paste nodes" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Duplicate selected nodes" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Delete selected nodes" })).not.toBeInTheDocument()

    const cards = container.querySelectorAll<HTMLElement>("[data-node-kind]")
    fireEvent.click(cards[0])
    fireEvent.click(cards[1], { shiftKey: true })
    expect(screen.getByRole("button", { name: "Duplicate selected nodes" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Copy selected nodes" }))
    fireEvent.click(screen.getByRole("button", { name: "Paste nodes" }))

    expect(screen.getAllByRole("textbox", { name: "Node title" })).toHaveLength(4)
    expect(onDirty).toHaveBeenLastCalledWith(expect.objectContaining({
      nodes: expect.arrayContaining([
        expect.objectContaining({ title: "Source copy" }),
        expect.objectContaining({ title: "Target copy" }),
      ]),
      edges: expect.arrayContaining([
        expect.objectContaining({ type: "supports" }),
      ]),
    }))

    fireEvent.click(screen.getByRole("button", { name: "Undo" }))
    expect(screen.getAllByRole("textbox", { name: "Node title" })).toHaveLength(2)
    fireEvent.click(screen.getByRole("button", { name: "Redo" }))
    expect(screen.getAllByRole("textbox", { name: "Node title" })).toHaveLength(4)
  })

  it("moves a multi-node selection as one group", () => {
    const onDirty = jest.fn()
    const { container } = render(<Harness onDirty={onDirty} initial={{
      ...emptyDiagram(),
      nodes: [
        {
          id: sourceId,
          kind: "concept",
          title: "Source",
          content: "",
          metadata: {},
          position: { x: 80, y: 80 },
        },
        {
          id: targetId,
          kind: "decision",
          title: "Target",
          content: "",
          metadata: {},
          position: { x: 520, y: 80 },
        },
      ],
    }} />)

    const cards = container.querySelectorAll<HTMLElement>("[data-node-kind]")
    fireEvent.click(cards[0])
    fireEvent.click(cards[1], { shiftKey: true })
    fireEvent.mouseDown(cards[0], { button: 0, clientX: 100, clientY: 100 })
    fireEvent.mouseMove(window, { clientX: 180, clientY: 140 })
    fireEvent.mouseUp(window)

    expect(onDirty).toHaveBeenLastCalledWith(expect.objectContaining({
      nodes: [
        expect.objectContaining({ position: { x: 160, y: 120 } }),
        expect.objectContaining({ position: { x: 600, y: 120 } }),
      ],
    }))
  })

  it("separates parallel relations instead of drawing them on top of each other", () => {
    const { container } = render(<Harness initial={{
      ...emptyDiagram(),
      nodes: [
        {
          id: sourceId,
          kind: "concept",
          title: "Source",
          content: "",
          metadata: {},
          position: { x: 80, y: 80 },
        },
        {
          id: targetId,
          kind: "decision",
          title: "Target",
          content: "",
          metadata: {},
          position: { x: 520, y: 80 },
        },
      ],
      edges: [
        {
          id: "00000000-0000-4000-8000-000000000003",
          source: sourceId,
          target: targetId,
          type: "supports",
          metadata: { sourcePort: "right", targetPort: "left" },
        },
        {
          id: "00000000-0000-4000-8000-000000000004",
          source: sourceId,
          target: targetId,
          type: "references",
          metadata: { sourcePort: "right", targetPort: "left" },
        },
      ],
    }} />)

    const paths = Array.from(container.querySelectorAll<SVGPathElement>('path[marker-end]'))
    expect(paths).toHaveLength(2)
    expect(new Set(paths.map((path) => path.getAttribute("d"))).size).toBe(2)
    expect(paths[0].getAttribute("stroke-dasharray")).toBeNull()
    expect(paths[1].getAttribute("stroke-dasharray")).toBe("2 5")
    expect(Number(paths[0].getAttribute("stroke-width"))).toBeGreaterThan(
      Number(paths[1].getAttribute("stroke-width")),
    )
  })

  it("shows an Imprenta-style relation preview and cancels with Escape", () => {
    render(<Harness initial={{
      ...emptyDiagram(),
      nodes: [{
        id: sourceId,
        kind: "concept",
        title: "Source",
        content: "",
        metadata: {},
        position: { x: 80, y: 80 },
      }],
    }} />)

    fireEvent.click(screen.getByRole("button", { name: "Connector right for Source" }))
    const initialPath = screen.getByTestId("record-relation-preview").getAttribute("d")
    fireEvent.click(screen.getByRole("button", { name: "Move relation cursor" }))
    expect(screen.getByTestId("record-relation-preview").getAttribute("d")).not.toBe(initialPath)

    fireEvent.keyDown(window, { key: "Escape" })
    expect(screen.queryByTestId("record-relation-preview")).not.toBeInTheDocument()
  })

  it("restores and persists the viewport independently from node semantics", () => {
    jest.useFakeTimers()
    const onDirty = jest.fn()
    render(<Harness
      initial={{
        ...emptyDiagram(),
        viewport: { x: 25, y: 35, zoom: 1.25 },
      }}
      onDirty={onDirty}
    />)
    expect(screen.getByLabelText("Initial viewport")).toHaveTextContent("25,35,1.25")

    fireEvent.click(screen.getByRole("button", { name: "Move viewport" }))
    act(() => jest.advanceTimersByTime(200))
    expect(onDirty).toHaveBeenLastCalledWith(expect.objectContaining({
      viewport: { x: 120, y: -40, zoom: 1.5 },
    }))
    jest.useRealTimers()
  })
})
