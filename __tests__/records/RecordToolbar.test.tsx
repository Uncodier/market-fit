import { render, screen } from "@testing-library/react"
import { RecordToolbar } from "@/app/records/[id]/components/RecordToolbar"

const baseProps = {
  editor: null,
  activeView: "nodes" as const,
  hasChanges: true,
  isSaving: false,
  saveStatus: "unsaved" as const,
  isEditorFocused: false,
  isRightPanelOpen: true,
  onSave: jest.fn(),
  onReload: jest.fn(),
  onDelete: jest.fn(),
  onToggleRightPanel: jest.fn(),
  saveLabel: "Save",
}

describe("RecordToolbar", () => {
  it("keeps delete on the left when no contextual tools are visible", () => {
    render(<RecordToolbar {...baseProps} />)
    expect(screen.getByRole("button", { name: "Delete record" })).toBeVisible()
    expect(screen.queryByTestId("record-toolbar-tools-spacer")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Hide right panel" })).toHaveClass("ml-auto")
  })

  it("keeps the action spacer while contextual tools are visible", () => {
    render(<RecordToolbar {...baseProps} diagramControls={<button type="button">Layout</button>} />)
    expect(screen.getByTestId("record-toolbar-tools-spacer")).toHaveClass("flex-1")
    expect(screen.getByRole("button", { name: "Delete record" })).toBeVisible()
  })

  it("keeps only save and contextual controls visible while editing node text", () => {
    render(
      <RecordToolbar
        {...baseProps}
        isNodeTextEditing
        diagramControls={<button type="button">Bold</button>}
      />
    )

    expect(screen.getByRole("button", { name: "Save" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Bold" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "Delete record" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Hide right panel" })).not.toBeInTheDocument()
  })
})
