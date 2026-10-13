import type { ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { LeadsToolbar } from "@/app/leads/components/LeadsToolbar"
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
    <LeadsToolbar
      segments={[]}
      onImportLeads={jest.fn()}
      onExportLeads={onExportLeads}
      sortBy={sortBy}
      onSortChange={onSortChange}
      currentView="kanban"
      onViewChange={onViewChange}
    />,
  )
  return { ...result, onSortChange, onViewChange, onExportLeads }
}

describe("Leads toolbar mobile layout", () => {
  it("keeps sorting and view controls in one non-wrapping row", () => {
    renderToolbar()

    const sort = screen.getByTitle("Sort by")
    const sortContainer = sort.parentElement!
    const row = sortContainer.parentElement!
    const view = screen.getByRole("radio", { name: "Toggle kanban view" })

    expect(row).toHaveClass("flex", "min-w-0", "flex-1", "items-center", "gap-2", "md:flex-none")
    expect(row).not.toHaveClass("flex-wrap", "flex-col", "basis-full")
    expect(row.parentElement).not.toHaveClass("flex-wrap", "flex-col")
    expect(sortContainer).toHaveClass("min-w-0", "flex-1", "md:flex-none")
    expect(view.parentElement?.parentElement).toHaveClass("shrink-0")
    expect(row).toContainElement(view)
    expect(row).not.toContainElement(screen.getByTitle("Import"))
    expect(row).not.toContainElement(screen.getByTitle("Export"))
  })

  it("only displays toolbar import and export actions on desktop", () => {
    renderToolbar()

    const importAction = screen.getByTitle("Import")
    const exportAction = screen.getByTitle("Export")
    expect(importAction.parentElement).toHaveClass("hidden", "md:flex", "shrink-0")
    expect(importAction.parentElement).toContainElement(exportAction)
  })

  it("allows long sort labels to shrink without shrinking the icons or view buttons", () => {
    renderToolbar("nearest_due_date")

    const label = screen.getByText("Nearest due date")
    expect(label).toHaveClass("truncate")
    expect(label.parentElement).toHaveClass("min-w-0")
    expect(screen.getByTitle("Sort by")).toHaveClass("min-w-0", "px-3", "md:px-4")
    for (const icon of screen.getByTitle("Sort by").querySelectorAll("svg")) {
      expect(icon.parentElement).toHaveClass("shrink-0")
    }
  })

  it("preserves sorting, view selection, and export callbacks", () => {
    const { onSortChange, onViewChange, onExportLeads } = renderToolbar()

    fireEvent.keyDown(screen.getByTitle("Sort by"), { key: "ArrowDown" })
    fireEvent.click(screen.getByRole("menuitem", { name: "Oldest" }))
    expect(onSortChange).toHaveBeenCalledWith("oldest")

    fireEvent.click(screen.getByRole("radio", { name: "Toggle table view" }))
    expect(onViewChange).toHaveBeenCalledWith("table")

    fireEvent.click(screen.getByTitle("Export"))
    expect(onExportLeads).toHaveBeenCalledTimes(1)
  })

  it("preserves the shared dropdown's default width and accepts scoped overrides", () => {
    const { rerender } = render(<SortDropdown sortBy="newest" setSortBy={jest.fn()} />)
    expect(screen.getByTitle("Sort by")).toHaveClass("w-full", "md:w-auto", "px-4")

    rerender(<SortDropdown sortBy="newest" setSortBy={jest.fn()} className="w-auto px-3" />)
    expect(screen.getByTitle("Sort by")).toHaveClass("w-auto", "md:w-auto", "px-3")
    expect(screen.getByTitle("Sort by")).not.toHaveClass("w-full", "px-4")
  })
})