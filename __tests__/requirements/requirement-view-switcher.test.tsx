import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import {
  RequirementViewSwitcher,
  type RequirementView,
} from "@/app/requirements/[id]/components/RequirementViewSwitcher"

function ViewSwitcherFixture() {
  const [view, setView] = useState<RequirementView>("document")
  const [text, setText] = useState("")
  const [node, setNode] = useState("")

  return (
    <RequirementViewSwitcher
      activeView={view}
      onViewChange={setView}
      documentView={<textarea aria-label="Requirement text" value={text} onChange={(event) => setText(event.target.value)} />}
    >
      <input aria-label="Diagram node" value={node} onChange={(event) => setNode(event.target.value)} />
    </RequirementViewSwitcher>
  )
}

describe("RequirementViewSwitcher", () => {
  it("starts on the document and mounts the diagram only when selected", () => {
    render(<ViewSwitcherFixture />)

    expect(screen.getByRole("tab", { name: "Document" })).toHaveAttribute("data-state", "active")
    expect(screen.queryByRole("textbox", { name: "Diagram node" })).not.toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Diagram" }), { button: 0 })

    expect(screen.getByRole("tab", { name: "Diagram" })).toHaveAttribute("data-state", "active")
    expect(screen.getByRole("textbox", { name: "Diagram node" })).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Requirement text" })).not.toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Requirement text", hidden: true })).toHaveValue("")
  })

  it("keeps both drafts mounted when switching between views", () => {
    render(<ViewSwitcherFixture />)

    fireEvent.change(screen.getByRole("textbox", { name: "Requirement text" }), {
      target: { value: "Draft instructions" },
    })
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Diagram" }), { button: 0 })
    fireEvent.change(screen.getByRole("textbox", { name: "Diagram node" }), {
      target: { value: "Draft node" },
    })
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Document" }), { button: 0 })

    expect(screen.getByRole("textbox", { name: "Requirement text" })).toHaveValue("Draft instructions")
    expect(screen.queryByRole("textbox", { name: "Diagram node" })).not.toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Diagram node", hidden: true })).toHaveValue("Draft node")

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Diagram" }), { button: 0 })
    expect(screen.getByRole("textbox", { name: "Diagram node" })).toHaveValue("Draft node")
  })
})