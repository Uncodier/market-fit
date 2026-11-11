import { useState } from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { TaskPageHeader } from "@/app/control-center/components/TaskPageHeader"
import { TaskStatusFilter } from "@/app/control-center/components/TaskStatusFilter"
import { MobileFiltersDrawer } from "@/app/components/ui/mobile-filters-drawer"
import { SearchInput } from "@/app/components/ui/search-input"

jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: () => true }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: () => "" }),
}))
jest.mock("@/app/components/ui/sticky-header", () => ({
  StickyHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
}))
jest.mock("@/app/control-center/components/ControlCenterHeader", () => ({
  ControlCenterHeader: () => null,
}))

function TaskToolbar() {
  const [status, setStatus] = useState<"all" | "new" | "completed">("all")
  const [search, setSearch] = useState("")
  return (
    <TaskPageHeader
      isMobile
      isSidebarCollapsed
      toggleSidebar={jest.fn()}
      sidebarLeft="0px"
      leftContent={
        <div>
          <TaskStatusFilter selectedFilter={status} onFilterChange={setStatus} />
          <SearchInput placeholder="Search tasks" value={search} onChange={(event) => setSearch(event.target.value)} alwaysExpanded />
          <button type="button">Advanced filters</button>
        </div>
      }
      rightContent={<button type="button">Priority</button>}
      viewContent={<button type="button">View</button>}
    />
  )
}

describe("task mobile filters", () => {
  beforeEach(() => {
    // Simulate a narrow drawer: only one measured tab plus the overflow button fits.
    jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 90, height: 28, top: 0, left: 0, right: 90, bottom: 28, x: 0, y: 0,
      toJSON: () => ({}),
    })
    jest.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200)
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(), disconnect: jest.fn(), unobserve: jest.fn(),
    }))
  })

  afterEach(() => jest.restoreAllMocks())

  it("isolates Tasks from legacy wrapping overrides and preserves search and sort controls", () => {
    render(<TaskToolbar />)
    fireEvent.click(screen.getByRole("button", { name: "Search & Filters" }))
    const dialog = screen.getByRole("dialog")
    expect(dialog.querySelector(".mobile-filters-drawer-content")).toBeNull()
    expect(within(dialog).getByRole("tablist")).toHaveClass("flex-nowrap")
    expect(within(dialog).queryByRole("tooltip")).not.toBeInTheDocument()
    const input = within(dialog).getByPlaceholderText("Search tasks")
    fireEvent.change(input, { target: { value: "Follow up" } })
    expect(input).toHaveValue("Follow up")
    expect(within(dialog).getByRole("button", { name: "Advanced filters" })).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Priority" })).toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: "View" })).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("uses the lead-detail overflow pattern and keeps the selected status visible", async () => {
    render(<TaskToolbar />)
    fireEvent.click(screen.getByRole("button", { name: "Search & Filters" }))
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("data-state", "active")
    expect(screen.queryByRole("tab", { name: "Completed" })).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByTitle("More options"), { key: "Enter" })
    const completed = await screen.findByRole("menuitem", { name: "Completed" })
    fireEvent.click(completed)
    expect(screen.getByRole("tab", { name: "Completed" })).toHaveAttribute("data-state", "active")
    expect(screen.queryByRole("tab", { name: "All" })).not.toBeInTheDocument()
  })

  it("retains the existing drawer layout for other screens", () => {
    render(<MobileFiltersDrawer triggerText="Other filters"><button>Filter</button></MobileFiltersDrawer>)
    fireEvent.click(screen.getByRole("button", { name: "Other filters" }))
    expect(screen.getByRole("dialog").querySelector(".mobile-filters-drawer-content")).not.toBeNull()
  })
})