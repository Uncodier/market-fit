import { fireEvent, render, screen } from "@testing-library/react"
import { RecordsPageHeader } from "@/app/records/components/RecordsPageHeader"
import { RecordsToolbar } from "@/app/records/components/RecordsToolbar"

jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: () => true }))
jest.mock("@/app/context/LayoutContext", () => ({
  useLayout: () => ({ isLayoutCollapsed: true }),
}))
jest.mock("@/app/hooks/use-command-k", () => ({ useCommandK: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: () => "" }),
}))
jest.mock("@/app/components/ui/date-range-picker", () => ({
  CalendarDateRangePicker: () => <button>Choose dates</button>,
}))

function headerProps(isMobile: boolean) {
  return {
    isMobile,
    isSidebarCollapsed: true, toggleSidebar: jest.fn(), sidebarLeft: "64px",
  }
}

describe("Records page header", () => {
  it("always renders the sticky mobile header and opens filters in one click", () => {
    const props = headerProps(true)
    const { container } = render(
      <RecordsPageHeader {...props}>
        <RecordsToolbar searchQuery="" onSearchChange={jest.fn()}
          groupBy="status" onGroupChange={jest.fn()} dateRange={null} onDateChange={jest.fn()}
          sortBy="newest" onSortChange={jest.fn()} viewType="table" onViewChange={jest.fn()} />
      </RecordsPageHeader>,
    )

    expect(container.querySelector("[data-toolbar-font]")).toHaveClass("sticky", "top-[var(--topbar-height,64px)]", "min-h-[71px]")
    expect(screen.queryByRole("button", { name: "Show record toolbar" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Hide record toolbar" })).not.toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Toggle table view" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Toggle graph view" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Search & Filters" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Search records...")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Group by" })).toBeInTheDocument()
  })

  it("always shows the desktop toolbar without show and hide controls", () => {
    const props = headerProps(false)
    const { container } = render(<RecordsPageHeader {...props}>Options</RecordsPageHeader>)
    expect(container.firstElementChild).toHaveClass("fixed", "h-[71px]")
    expect(screen.getByText("Options")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Show record toolbar" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Hide record toolbar" })).not.toBeInTheDocument()
  })
})