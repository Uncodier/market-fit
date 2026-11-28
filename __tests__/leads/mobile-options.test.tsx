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

  it("keeps search and labeled transfer actions inside the mobile panel", () => {
    render(<LeadsPage />)
    expect(screen.queryByRole("button", { name: "Import" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    const panel = within(screen.getByRole("dialog", { name: "Search" }))
    expect(panel.getByPlaceholderText("Search leads...")).toBeVisible()
    expect(panel.getByRole("button", { name: "Import" })).toHaveClass("w-full")
    const exportAction = panel.getByRole("button", { name: "Export" })
    expect(exportAction).toHaveTextContent("Export")
    fireEvent.click(exportAction)
    expect(mockExportLeads).toHaveBeenCalledTimes(1)
  })

  it("opens the real import dialog from the mobile panel without starting an import", () => {
    render(<LeadsPage />)
    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    fireEvent.click(within(screen.getByRole("dialog", { name: "Search" })).getByRole("button", { name: "Import" }))
    const dialog = screen.getByRole("dialog", { name: "Import Leads" })
    expect(within(dialog).getByText(/Import leads from CSV, JSON, or Excel files/)).toBeInTheDocument()
    expect(mockImportLeads).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }))
    expect(screen.getByRole("dialog", { name: "Search" })).toBeInTheDocument()
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