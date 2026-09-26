import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { WorkflowRelationEditor } from "@/app/components/workflows/workflow-relation-editor"

describe("WorkflowRelationEditor", () => {
  const onChange = jest.fn().mockResolvedValue(undefined)
  const onDisconnect = jest.fn().mockResolvedValue(undefined)
  const onClose = jest.fn()

  beforeEach(() => jest.clearAllMocks())

  const renderEditor = (context = "on success") => render(
    <WorkflowRelationEditor
      stepId="step-1"
      context={context}
      anchor={{ x: 310, y: 240 }}
      onChange={onChange}
      onDisconnect={onDisconnect}
      onClose={onClose}
    />,
  )

  it("uses the screen-anchored compact relation editor from the other graph views", () => {
    renderEditor()
    expect(screen.getByLabelText("Relation editor")).toHaveClass("flex", "items-center", "border-primary/30", "shadow-xl")
    expect(screen.getByLabelText("Relation editor").parentElement).toHaveClass("fixed", "pointer-events-auto")
    expect(screen.getByRole("button", { name: "on success" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Close relation editor" }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("saves a preset through the shared searchable picker", async () => {
    renderEditor()
    fireEvent.click(screen.getByRole("button", { name: "on success" }))
    fireEvent.click(screen.getByRole("button", { name: "on fail" }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("step-1", "on fail"))
  })

  it("commits a free-form condition from the shared picker", async () => {
    renderEditor()
    fireEvent.click(screen.getByRole("button", { name: "on success" }))
    const search = screen.getByPlaceholderText("Search or type custom...")
    expect(search).toHaveAttribute("maxlength", "120")
    fireEvent.change(search, { target: { value: "when customer approves" } })
    fireEvent.click(screen.getByRole("button", { name: /Use.*when customer approves/ }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("step-1", "when customer approves"))
  })

  it("disconnects through the same delete control as Records and Imprenta", async () => {
    renderEditor()
    fireEvent.click(screen.getByRole("button", { name: "Delete relation" }))
    await waitFor(() => expect(onDisconnect).toHaveBeenCalledWith("step-1"))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})