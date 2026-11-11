import { fireEvent, render, screen, within } from "@testing-library/react"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { TaskPageHeader } from "@/app/control-center/components/TaskPageHeader"
import { ViewSelector } from "@/app/components/view-selector"

jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: jest.fn() }))
jest.mock("@/app/hooks/use-command-k", () => ({ useCommandK: jest.fn() }))
jest.mock("@/app/context/LayoutContext", () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}))

const mockIsMobile = jest.mocked(useIsMobile)

function renderHeader(isMobile = true, bulk = false) {
  mockIsMobile.mockReturnValue(isMobile)
  const onSearch = jest.fn()
  const onFilter = jest.fn()
  const onSort = jest.fn()
  const onViewChange = jest.fn()
  const result = render(
    <TaskPageHeader
      isMobile={isMobile}
      isSidebarCollapsed={false}
      toggleSidebar={jest.fn()}
      sidebarLeft="256px"
      leftContent={bulk ? <button>Bulk actions</button> : <>
        <button>All tasks</button>
        <input aria-label="Search tasks" onChange={event => onSearch(event.target.value)} />
        <button onClick={onFilter}>Filters</button>
      </>}
      rightContent={<button onClick={onSort}>Sort tasks</button>}
      viewContent={<ViewSelector currentView="kanban" onViewChange={onViewChange} showCalendar />}
    />,
  )
  return { ...result, onSearch, onFilter, onSort, onViewChange }
}

it("keeps only the options trigger and view selector in the mobile sticky header", () => {
  const { container, onViewChange } = renderHeader()
  expect(container.querySelector("[data-toolbar-font]")).toHaveClass("sticky")
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "All tasks" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Filters" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Sort tasks" })).not.toBeInTheDocument()
  expect(screen.getAllByRole("button")).toHaveLength(1)
  expect(screen.getAllByRole("radio")).toHaveLength(3)
  fireEvent.click(screen.getByRole("radio", { name: "Toggle calendar view" }))
  expect(onViewChange).toHaveBeenCalledWith("calendar")
})

it("opens working search, status, filter and sorting controls in the shared drawer", () => {
  const { onSearch, onFilter, onSort } = renderHeader()
  fireEvent.click(screen.getByRole("button", { name: "common.search" }))
  const drawer = within(screen.getByRole("dialog"))
  expect(drawer.getByRole("button", { name: "All tasks" })).toBeInTheDocument()
  fireEvent.change(drawer.getByRole("textbox", { name: "Search tasks" }), { target: { value: "Follow up" } })
  expect(onSearch).toHaveBeenCalledWith("Follow up")
  fireEvent.click(drawer.getByRole("button", { name: "Filters" }))
  expect(onFilter).toHaveBeenCalledTimes(1)
  fireEvent.click(drawer.getByRole("button", { name: "Sort tasks" }))
  expect(onSort).toHaveBeenCalledTimes(1)
})

it("keeps bulk actions accessible through mobile options without crowding the header", () => {
  renderHeader(true, true)
  expect(screen.queryByRole("button", { name: "Bulk actions" })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "common.search" }))
  expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Bulk actions" })).toBeInTheDocument()
})

it("preserves inline desktop controls and the fixed desktop header", () => {
  const { container } = renderHeader(false)
  expect(container.querySelector("[data-toolbar-font]")).not.toBeInTheDocument()
  expect(container.firstChild).toHaveClass("fixed")
  expect(screen.getByRole("textbox", { name: "Search tasks" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Sort tasks" })).toBeInTheDocument()
  expect(screen.getByRole("radio", { name: "Toggle table view" })).toBeInTheDocument()
})