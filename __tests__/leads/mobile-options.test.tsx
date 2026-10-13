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

  it("keeps transfer actions out of the mobile toolbar and inside the options panel", () => {
    render(<LeadsPage />)

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    const desktopActions = screen.getByTitle("Import").parentElement!
    expect(desktopActions).toHaveClass("hidden", "md:flex")
    expect(desktopActions).toContainElement(screen.getByTitle("Export"))

    fireEvent.click(screen.getByRole("button", { name: "Search" }))

    const panel = screen.getByRole("dialog", { name: "Search" })
    const importAction = within(panel).getByRole("button", { name: "Import" })
    const exportAction = within(panel).getByRole("button", { name: "Export" })
    expect(importAction).toHaveClass("w-full", "h-11")
    expect(exportAction).toHaveClass("w-full", "h-11")
    expect(importAction.parentElement?.parentElement).toHaveClass("md:hidden")
    const mobileSearch = within(panel).getAllByPlaceholderText("Search leads...").find(input =>
      input.closest(".md\\:hidden"),
    )
    expect(mobileSearch).toBeInTheDocument()
    expect(within(panel).getByRole("button", { name: "Filters" })).toBeInTheDocument()

    fireEvent.click(exportAction)
    expect(mockExportLeads).toHaveBeenCalledTimes(1)
  })

  it("opens the real import dialog from the panel without starting an import", () => {
    render(<LeadsPage />)
    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    const panel = screen.getByRole("dialog", { name: "Search" })

    fireEvent.click(within(panel).getByRole("button", { name: "Import" }))

    const dialog = screen.getByRole("dialog", { name: "Import Leads" })
    expect(within(dialog).getByText(/Import leads from CSV, JSON, or Excel files/)).toBeInTheDocument()
    expect(mockImportLeads).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog", { name: "Import Leads" })).not.toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Search" })).toBeInTheDocument()
  })

  it("preserves desktop transfer actions without an options drawer", () => {
    jest.mocked(useIsMobile).mockReturnValue(false)
    render(<LeadsPage />)

    expect(screen.queryByRole("button", { name: "Search" })).not.toBeInTheDocument()
    const desktopExport = screen.getAllByTitle("Export").find(button => button.parentElement?.classList.contains("md:flex"))!
    expect(desktopExport.parentElement).toHaveClass("hidden", "md:flex")
    fireEvent.click(desktopExport)
    expect(mockExportLeads).toHaveBeenCalledTimes(1)
  })
})