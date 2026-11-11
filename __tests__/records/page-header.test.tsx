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
    isMobile, isToolbarVisible: false, onToolbarVisibilityChange: jest.fn(),
    isSidebarCollapsed: true, toggleSidebar: jest.fn(), sidebarLeft: "64px",
  }
}

describe("Records page header", () => {
  it.each([false, true])("always renders the sticky mobile header and opens filters in one click (desktop visibility: %s)", visible => {
    const props = { ...headerProps(true), isToolbarVisible: visible }
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
    expect(props.onToolbarVisibilityChange).not.toHaveBeenCalled()
  })

  it("preserves desktop show and hide controls", () => {
    const props = headerProps(false)
    const { rerender } = render(<RecordsPageHeader {...props}>Options</RecordsPageHeader>)
    expect(screen.queryByText("Options")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Show record toolbar" }))
    expect(props.onToolbarVisibilityChange).toHaveBeenLastCalledWith(true)

    rerender(<RecordsPageHeader {...props} isToolbarVisible>Options</RecordsPageHeader>)
    expect(screen.getByText("Options")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Hide record toolbar" }))
    expect(props.onToolbarVisibilityChange).toHaveBeenLastCalledWith(false)
  })
})