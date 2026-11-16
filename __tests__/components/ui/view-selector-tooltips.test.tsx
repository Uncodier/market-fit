import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ViewSelector } from "@/app/components/view-selector"
import type { Editor } from "@tiptap/react"
import { ContentEditorToolbar } from "@/app/content/[id]/components/ContentEditorToolbar"
import { RecordToolbar } from "@/app/records/[id]/components/RecordToolbar"

describe("ViewSelector tooltips", () => {
  it("shows custom labels on hover without adding a focusable wrapper", async () => {
    render(<ViewSelector currentView="table" onViewChange={jest.fn()} labels={{ kanban: "Board view" }} />)
    const item = screen.getByRole("radio", { name: "Board view" })
    expect(item.tagName).toBe("BUTTON")
    expect(item).not.toHaveAttribute("title")
    fireEvent.pointerMove(item, { pointerType: "mouse" })
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Board view")
  })

  it("shows tooltips on focus and preserves radio selection and roving focus", async () => {
    const onViewChange = jest.fn()
    render(<ViewSelector currentView="table" onViewChange={onViewChange} showCalendar showGraph />)
    const table = screen.getByRole("radio", { name: "Toggle table view" })
    const kanban = screen.getByRole("radio", { name: "Toggle kanban view" })
    expect(table).toHaveAttribute("aria-checked", "true")
    expect(kanban).toHaveAttribute("aria-checked", "false")
    act(() => table.focus())
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Toggle table view")
    fireEvent.keyDown(table, { key: "ArrowRight" })
    await waitFor(() => expect(kanban).toHaveFocus())
    expect(table).toHaveAttribute("tabindex", "-1")
    expect(kanban).toHaveAttribute("tabindex", "0")
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Toggle kanban view")
    fireEvent.click(kanban)
    expect(onViewChange).toHaveBeenCalledWith("kanban")
    fireEvent.click(table)
    expect(onViewChange).toHaveBeenCalledTimes(1)
    expect(screen.getAllByRole("radio")).toHaveLength(4)
  })
})

describe("Editor heading tooltips", () => {
  const editor = {
    isActive: (name: unknown, attributes?: { level: number }) => name === "heading" && (!attributes || attributes.level === 2),
    getAttributes: () => ({ level: 2 }),
    can: () => ({ undo: () => false, redo: () => false }),
  } as unknown as Editor

  it.each(["content", "record"])("preserves the %s heading glyph and dropdown while showing its tooltip", async (kind) => {
    render(kind === "content"
      ? <ContentEditorToolbar editor={editor} instructionsEditor={editor} onSave={jest.fn()} isSaving={false}
          onDelete={jest.fn()} activeTab="copy" hasChanges={false} isEditorFocused />
      : <RecordToolbar editor={editor} activeView="document" hasChanges={false} isSaving={false}
          saveStatus="saved" isEditorFocused isRightPanelOpen onSave={jest.fn()} onReload={jest.fn()}
          onDelete={jest.fn()} onToggleRightPanel={jest.fn()} saveLabel="Save" />)
    const heading = screen.getByRole("button", { name: "Text style" })
    expect(heading).toHaveTextContent("H2")
    expect(heading).toHaveAttribute("data-toolbar-icon-action", "off")
    expect(heading).not.toHaveAttribute("title")
    fireEvent.pointerMove(heading, { pointerType: "mouse" })
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Text style")
    act(() => heading.focus())
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Text style")
    fireEvent.keyDown(heading, { key: "ArrowDown" })
    expect(await screen.findByRole("menuitem", { name: /Heading 2/ })).toBeInTheDocument()
    expect(heading).toHaveAttribute("aria-expanded", "true")
  })
})