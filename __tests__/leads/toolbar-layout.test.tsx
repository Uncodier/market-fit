import type { ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { LeadsToolbar } from "@/app/leads/components/LeadsToolbar"
import { LeadsTransferActions } from "@/app/leads/components/LeadsTransferActions"
import { ListToolbar } from "@/app/components/ui/list-toolbar"
import { SortDropdown } from "@/app/components/ui/sort-dropdown"

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({
    t: (key: string) => ({
      "layout.topbar.import": "Import",
      "layout.topbar.export": "Export",
      "leads.sort.newest": "Newest",
      "leads.sort.oldest": "Oldest",
    }[key] || key),
  }),
}))

jest.mock("@/app/components/leads/import-leads-dialog", () => ({
  ImportLeadsDialog: ({ trigger }: { trigger: ReactNode }) => trigger,
}))

function renderToolbar(sortBy = "newest") {
  const onSortChange = jest.fn()
  const onViewChange = jest.fn()
  const onExportLeads = jest.fn()
  const result = render(
    <ListToolbar
      actions={<LeadsTransferActions segments={[]} onImportLeads={jest.fn()} onExportLeads={onExportLeads} />}
      controls={<LeadsToolbar sortBy={sortBy} onSortChange={onSortChange} currentView="kanban" onViewChange={onViewChange} />}
    />,
  )
  return { ...result, onSortChange, onViewChange, onExportLeads }
}

describe("Leads toolbar mobile layout", () => {
  it("groups sorting and view controls on the right, after the actions", () => {
    renderToolbar()

    const sort = screen.getByRole("button", { name: "Sort by" })
    const row = sort.closest("[data-toolbar-controls]")!
    const view = screen.getByRole("radio", { name: "Toggle kanban view" })

    expect(row).toHaveClass("ml-auto", "justify-end")
    expect(row.previousElementSibling).toHaveAttribute("data-toolbar-actions")
    expect(row).toContainElement(view)
    expect(row).not.toContainElement(screen.getByRole("button", { name: "Import" }))
    expect(row).not.toContainElement(screen.getByRole("button", { name: "Export" }))
  })

  it("uses ghost icons with tooltips for import and export", async () => {
    renderToolbar()

    const importAction = screen.getByRole("button", { name: "Import" })
    const exportAction = screen.getByRole("button", { name: "Export" })
    const transferActions = importAction.closest("[data-toolbar-actions]")
    expect(importAction).not.toHaveClass("bg-secondary")
    expect(exportAction).not.toHaveClass("bg-secondary")
    expect(transferActions).toContainElement(exportAction)
    fireEvent.focus(exportAction)
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Export")
  })

  it("shows the current sort in a tooltip without widening the icon button", async () => {
    renderToolbar("nearest_due_date")

    const sort = screen.getByRole("button", { name: "Sort by" })
    expect(sort).not.toHaveTextContent("Nearest due date")
    expect(sort).toHaveClass("h-10", "w-10", "md:h-9", "md:w-9")
    fireEvent.focus(sort)
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Sort by: Nearest due date")
  })

  it("preserves sorting, view selection, and export callbacks", () => {
    const { onSortChange, onViewChange, onExportLeads } = renderToolbar()

    fireEvent.keyDown(screen.getByRole("button", { name: "Sort by" }), { key: "ArrowDown" })
    fireEvent.click(screen.getByRole("menuitem", { name: "Oldest" }))
    expect(onSortChange).toHaveBeenCalledWith("oldest")

    fireEvent.click(screen.getByRole("radio", { name: "Toggle table view" }))
    expect(onViewChange).toHaveBeenCalledWith("table")

    fireEvent.click(screen.getByRole("button", { name: "Export" }))
    expect(onExportLeads).toHaveBeenCalledTimes(1)
  })

  it("keeps the shared sort menu icon-only even without options", async () => {
    render(<SortDropdown sortBy="newest" setSortBy={jest.fn()} options={[]} />)
    const sort = screen.getByRole("button", { name: "Sort by" })
    expect(sort.querySelectorAll("svg")).toHaveLength(1)
    fireEvent.focus(sort)
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Sort by")
  })
})