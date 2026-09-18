import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import RecordDetailPage from "@/app/records/[id]/record-item-client"
import { getRecordById, updateRecord } from "@/app/records/actions"
import {
  getRecordDiagram,
  saveRecordDiagram,
} from "@/app/records/[id]/diagram-actions"

const push = jest.fn()
const router = { push }
const editor = {
  isFocused: false,
  isEmpty: true,
  commands: { setContent: jest.fn() },
}
let mockEditorUpdate: ((event: { editor: { getHTML: () => string } }) => void) | undefined

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "00000000-0000-4000-8000-000000000100" }),
  useRouter: () => router,
}))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}))
jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    promise: (promise: Promise<unknown>) => promise,
  },
}))
jest.mock("@tiptap/react", () => ({
  useEditor: (options: any) => {
    mockEditorUpdate = options.onUpdate
    return editor
  },
}))
jest.mock("@/app/content/utils", () => ({ markdownToHTML: (value: string) => value }))
jest.mock("@/app/components/ui/tabs", () => {
  const React = require("react")
  const TabContext = React.createContext(() => undefined)
  return {
    Tabs: ({ onValueChange, children }: any) => (
      <TabContext.Provider value={onValueChange}>{children}</TabContext.Provider>
    ),
    TabsList: ({ children }: any) => <div role="tablist">{children}</div>,
    TabsTrigger: ({ value, children }: any) => {
      const onValueChange = React.useContext(TabContext)
      return <button type="button" role="tab" onClick={() => onValueChange(value)}>{children}</button>
    },
  }
})
jest.mock("@/app/records/actions", () => ({
  getRecordById: jest.fn(),
  updateRecord: jest.fn(),
  deleteRecord: jest.fn(),
}))
jest.mock("@/app/records/[id]/diagram-actions", () => ({
  getRecordDiagram: jest.fn(),
  saveRecordDiagram: jest.fn(),
}))
jest.mock("@/app/records/[id]/components/RecordDetailSkeleton", () => ({
  RecordDetailSkeleton: () => <div>Loading record</div>,
}))
jest.mock("@/app/records/[id]/components/RecordToolbar", () => ({
  RecordToolbar: ({ hasChanges, isSaving, onSave, saveStatus }: any) => (
    <div>
      <button type="button" onClick={onSave} disabled={!hasChanges || isSaving}>Save changes</button>
      <span role="status">{saveStatus}</span>
    </div>
  ),
}))
jest.mock("@/app/records/[id]/components/RecordDocumentView", () => ({
  RecordDocumentView: ({ title, onTitleChange }: any) => (
    <div>
      <span>Document draft: {title}</span>
      <button
        type="button"
        onClick={() => onTitleChange(title === "Original title" ? "Edited title" : "Newer title")}
      >
        Edit document
      </button>
    </div>
  ),
}))
jest.mock("@/app/records/[id]/components/RecordRightPanel", () => ({
  RecordRightPanel: () => null,
}))
jest.mock("@/app/records/[id]/components/record-diagram/RecordDiagramView", () => ({
  RecordDiagramView: ({ diagram, onChange, onViewportChange }: any) => (
    <div>
      <span>Node count: {diagram.nodes.length}</span>
      <button
        type="button"
        onClick={() => onChange({
          ...diagram,
          nodes: [{
            id: "00000000-0000-4000-8000-000000000101",
            kind: "note",
            title: "Draft node",
            content: "",
            metadata: {},
            position: { x: 80, y: 80 },
          }],
        })}
      >
        Edit diagram
      </button>
      <button
        type="button"
        onClick={() => onViewportChange({ x: 120, y: -40, zoom: 1.5 })}
      >
        Move viewport
      </button>
    </div>
  ),
}))

describe("record detail view switch", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getRecordById as jest.Mock).mockResolvedValue({
      record: {
        id: "00000000-0000-4000-8000-000000000100",
        site_id: "00000000-0000-4000-8000-000000000200",
        category_id: "00000000-0000-4000-8000-000000000300",
        title: "Original title",
        description: "",
        data: {},
        relations: {},
        status: "draft",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        category: { template_fields: [] },
      },
      error: null,
    })
    ;(getRecordDiagram as jest.Mock).mockResolvedValue({
      diagram: {
        revision: 0,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        edges: [],
      },
      error: null,
    })
    ;(updateRecord as jest.Mock).mockResolvedValue({ record: {}, error: null })
    ;(saveRecordDiagram as jest.Mock).mockResolvedValue({
      success: true,
      revision: 1,
      changedNodeIds: [],
    })
  })

  it("preserves both drafts across switches and saves dirty resources together", async () => {
    render(<RecordDetailPage />)
    await screen.findByText("Document draft: Original title")
    expect(screen.getByRole("status")).toHaveTextContent("saved")

    fireEvent.click(screen.getByRole("button", { name: "Edit document" }))
    expect(screen.getByRole("status")).toHaveTextContent("unsaved")
    fireEvent.click(screen.getByRole("tab", { name: "Canvas" }))
    fireEvent.click(screen.getByRole("button", { name: "Edit diagram" }))
    expect(screen.getByText("Node count: 1")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "Document" }))
    expect(screen.getByText("Document draft: Edited title")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: "Canvas" }))
    expect(screen.getByText("Node count: 1")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() => {
      expect(updateRecord).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ title: "Edited title" })
      )
      expect(saveRecordDiagram).toHaveBeenCalledWith(
        expect.objectContaining({
          diagram: expect.objectContaining({ nodes: expect.arrayContaining([
            expect.objectContaining({ title: "Draft node" }),
          ]) }),
        })
      )
    })
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("saved"))
  })

  it("keeps edits made while a save is in flight dirty", async () => {
    let resolveUpdate: ((value: unknown) => void) | undefined
    ;(updateRecord as jest.Mock).mockReturnValue(new Promise((resolve) => {
      resolveUpdate = resolve
    }))
    render(<RecordDetailPage />)
    await screen.findByText("Document draft: Original title")

    fireEvent.click(screen.getByRole("button", { name: "Edit document" }))
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(updateRecord).toHaveBeenCalled())
    fireEvent.click(screen.getByRole("button", { name: "Edit document" }))

    await act(async () => {
      resolveUpdate?.({ record: {}, error: null })
      await Promise.resolve()
    })
    await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled())
    expect(screen.getByText("Document draft: Newer title")).toBeInTheDocument()
  })

  it("captures the latest editor content without a debounce window", async () => {
    render(<RecordDetailPage />)
    await screen.findByText("Document draft: Original title")

    act(() => {
      mockEditorUpdate?.({ editor: { getHTML: () => "<p>Latest body</p>" } })
    })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(updateRecord).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ description: "Latest body" })
    ))
  })

  it("saves the latest viewport even before its visual debounce commits", async () => {
    render(<RecordDetailPage />)
    await screen.findByText("Document draft: Original title")
    fireEvent.click(screen.getByRole("tab", { name: "Canvas" }))
    fireEvent.click(screen.getByRole("button", { name: "Move viewport" }))
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(saveRecordDiagram).toHaveBeenCalledWith(
      expect.objectContaining({
        diagram: expect.objectContaining({
          viewport: { x: 120, y: -40, zoom: 1.5 },
        }),
      })
    ))
  })

  it("surfaces diagram revision conflicts in the toolbar", async () => {
    ;(saveRecordDiagram as jest.Mock).mockResolvedValue({
      success: false,
      conflict: true,
      error: "Revision conflict",
    })
    render(<RecordDetailPage />)
    await screen.findByText("Document draft: Original title")
    fireEvent.click(screen.getByRole("tab", { name: "Canvas" }))
    fireEvent.click(screen.getByRole("button", { name: "Edit diagram" }))
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("conflict"))
  })
})
