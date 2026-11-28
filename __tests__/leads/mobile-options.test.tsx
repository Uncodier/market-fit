import type { ReactNode } from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import LeadsPage from "@/app/leads/page"
import { useIsMobile } from "@/app/hooks/use-mobile-view"

const mockImportLeads = jest.fn()
const mockExportLeads = jest.fn()

jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({
    t: (key: string) => ({
      "common.search": "Search",
      "layout.topbar.import": "Import",
      "layout.topbar.export": "Export",
    }[key] || key),
  }),
}))
jest.mock("@/app/leads/hooks/use-leads-page", () => ({
  useLeadsPage: () => ({
    segments: [{ id: "segment-1", name: "Customers" }],
    loading: true,
    activeTab: "all",
    viewType: "kanban",
    searchQuery: "",
    selectedLeads: new Set(),
    filters: { status: [], segments: [], origin: [], journeyStages: [] },
    sortBy: "newest",
    handleImportLeads: mockImportLeads,
    handleExportLeads: mockExportLeads,
  }),
}))
jest.mock("@/app/components/ui/sticky-header", () => ({
  StickyHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
}))
jest.mock("@/app/components/ui/lead-filter-modal", () => ({ LeadFilterModal: () => null }))
jest.mock("@/app/components/kanban-view", () => ({ KanbanView: () => null }))
jest.mock("@/app/leads/components/AttributionModal", () => ({ AttributionModal: () => null }))
jest.mock("@/app/leads/components/grouped-leads-table", () => ({ GroupedLeadsTable: () => null }))
jest.mock("@/app/leads/components/LeadsTableSkeleton", () => ({ LeadsTableSkeleton: () => null }))

describe("Leads mobile options", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useIsMobile).mockReturnValue(true)
  })

  it("keeps search and transfer actions in the mobile toolbar, separate from filters", () => {
    render(<LeadsPage />)
    const importAction = screen.getByRole("button", { name: "Import" })
    const exportAction = screen.getByRole("button", { name: "Export" })
    expect(importAction.closest("[data-toolbar-actions]")).toContainElement(exportAction)
    expect(screen.getByRole("button", { name: "Search leads..." }).closest("[data-toolbar-search]")).toBeInTheDocument()
    fireEvent.click(exportAction)
    expect(mockExportLeads).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "Filters" }))
    const panel = screen.getByRole("dialog", { name: "Filters" })
    expect(within(panel).queryByRole("button", { name: "Import" })).not.toBeInTheDocument()
    expect(within(panel).queryByPlaceholderText("Search leads...")).not.toBeInTheDocument()
  })

  it("opens the real import dialog from the toolbar without starting an import", () => {
    render(<LeadsPage />)
    fireEvent.click(screen.getByRole("button", { name: "Import" }))
    const dialog = screen.getByRole("dialog", { name: "Import Leads" })
    expect(within(dialog).getByText(/Import leads from CSV, JSON, or Excel files/)).toBeInTheDocument()
    expect(mockImportLeads).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("preserves desktop transfer actions without an options drawer", () => {
    jest.mocked(useIsMobile).mockReturnValue(false)
    render(<LeadsPage />)

    expect(screen.queryByRole("button", { name: "Search" })).not.toBeInTheDocument()
    const desktopExport = screen.getByRole("button", { name: "Export" })
    expect(desktopExport.closest("[data-toolbar-actions]")).toBeInTheDocument()
    fireEvent.click(desktopExport)
    expect(mockExportLeads).toHaveBeenCalledTimes(1)
  })
})