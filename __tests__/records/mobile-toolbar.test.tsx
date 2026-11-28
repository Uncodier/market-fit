import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { RecordsToolbar } from "@/app/records/components/RecordsToolbar"
import { RecordsBulkToolbar } from "@/app/records/components/RecordsBulkToolbar"
import { useIsMobile } from "@/app/hooks/use-mobile-view"

jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => ({
    "common.search": "Search",
    "records.search": "Search records...",
    "records.groupBy": "Group by",
    "records.groupBy.status": "Status",
    "records.groupBy.category": "Category",
    "records.groupBy.teamMember": "Team Member",
    "records.groupBy.date": "Date (Month)",
    "records.sort.newest": "Newest",
    "records.sort.oldest": "Oldest",
    "records.sort.titleAsc": "Title (A-Z)",
    "records.sort.titleDesc": "Title (Z-A)",
    "records.bulk.chooseAction": "Choose bulk action",
    "records.bulk.cancel": "Cancel",
    "records.bulk.changeStatus": "Change Status",
    "records.bulk.changeCategory": "Change Category",
    "records.bulk.delete": "Delete",
  }[key] || key) }),
}))
jest.mock("@/app/components/ui/date-range-picker", () => ({
  CalendarDateRangePicker: ({ onRangeChange }: { onRangeChange: (start: Date, end: Date) => void }) =>
    <button onClick={() => onRangeChange(new Date(2026, 9, 1), new Date(2026, 9, 31))}>Choose dates</button>,
}))

function toolbarProps() {
  return {
    searchQuery: "", onSearchChange: jest.fn(),
    groupBy: "status" as const, onGroupChange: jest.fn(),
    dateRange: null, onDateChange: jest.fn(),
    sortBy: "newest" as const, onSortChange: jest.fn(),
    viewType: "table" as const, onViewChange: jest.fn(),
  }
}

describe("Records mobile toolbar", () => {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView

  beforeAll(() => {
    HTMLElement.prototype.scrollIntoView = jest.fn()
  })

  afterAll(() => {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView
  })

  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useIsMobile).mockReturnValue(true)
  })

  it.each([false, true])("does not forward unsupported search props to the DOM (mobile: %s)", mobile => {
    jest.mocked(useIsMobile).mockReturnValue(mobile)
    const consoleError = jest.spyOn(console, "error")
    try {
      render(<RecordsToolbar {...toolbarProps()} />)

      const input = screen.getByPlaceholderText("Search records...")
      expect(input).not.toHaveAttribute("collapsedSizeClassName")
      expect(consoleError).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
  })

  it("keeps filters in the shared panel and the view selector in the header", async () => {
    const props = toolbarProps()
    const { rerender } = render(<RecordsToolbar {...props} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(screen.queryByText("Choose dates")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Sort by" })).not.toBeInTheDocument()

    for (const view of ["table", "kanban", "calendar", "graph"]) {
      fireEvent.click(screen.getByRole("radio", { name: `Toggle ${view} view` }))
      if (view !== "table") expect(props.onViewChange).toHaveBeenLastCalledWith(view)
    }
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    const searchButton = screen.getByRole("button", { name: "Search records..." })
    expect(searchButton.closest("[data-toolbar-search]")).toBeInTheDocument()
    fireEvent.click(searchButton)
    const search = screen.getByPlaceholderText("Search records...")
    fireEvent.change(search, { target: { value: "Proposal" } })
    expect(props.onSearchChange).toHaveBeenCalledWith("Proposal")
    fireEvent.click(screen.getByRole("button", { name: "Filters" }))
    const panel = screen.getByRole("dialog", { name: "Filters" })
    expect(within(panel).queryByPlaceholderText("Search records...")).not.toBeInTheDocument()
    expect(within(panel).getByRole("combobox", { name: "Group by" })).toBeInTheDocument()

    fireEvent.click(within(panel).getByText("Choose dates"))
    expect(props.onDateChange).toHaveBeenLastCalledWith({ startDate: new Date(2026, 9, 1), endDate: new Date(2026, 9, 31) })
    rerender(<RecordsToolbar {...props} dateRange={props.onDateChange.mock.lastCall?.[0]} />)
    fireEvent.click(within(panel).getByRole("button", { name: "Clear date range" }))
    expect(props.onDateChange).toHaveBeenLastCalledWith(null)

    fireEvent.keyDown(within(panel).getByRole("button", { name: "Sort by" }), { key: "Enter" })
    fireEvent.click(await screen.findByRole("menuitem", { name: "Oldest" }))
    expect(props.onSortChange).toHaveBeenCalledWith("oldest")
    expect(screen.getByRole("dialog", { name: "Filters" })).toBeInTheDocument()

    expect(within(panel).queryByRole("radio", { name: "Toggle graph view" })).not.toBeInTheDocument()
  })

  it("starts the right-hand controls with search on desktop", async () => {
    jest.mocked(useIsMobile).mockReturnValue(false)
    const props = toolbarProps()
    const { rerender } = render(<RecordsToolbar {...props} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    const searchButton = screen.getByRole("button", { name: "Search records..." })
    const group = screen.getByRole("combobox", { name: "Group by" })
    const sort = screen.getByRole("button", { name: "Sort by" })
    const searchSlot = searchButton.closest("[data-toolbar-search]")!
    const right = sort.closest("[data-toolbar-controls]") as HTMLElement
    expect(right).toContainElement(group)
    expect(group).not.toHaveTextContent("Status")
    fireEvent.focus(group)
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Group by: Status")
    expect(right.firstElementChild).toBe(searchSlot)
    expect(right).toHaveClass("ml-auto", "flex-wrap", "justify-end")
    expect(within(right).getByRole("button", { name: "Choose dates" })).toBeInTheDocument()
    expect(within(right).queryByRole("button", { name: "Clear date range" })).not.toBeInTheDocument()
    expect(within(right).getByRole("radio", { name: "Toggle graph view" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Search" })).not.toBeInTheDocument()

    fireEvent.click(searchButton)
    const search = screen.getByPlaceholderText("Search records...")
    await waitFor(() => expect(search).toHaveFocus())
    fireEvent.change(search, { target: { value: "Proposal" } })
    expect(props.onSearchChange).toHaveBeenCalledWith("Proposal")
    fireEvent.keyDown(group, { key: "Enter" })
    fireEvent.click(await screen.findByRole("option", { name: "Category" }))
    expect(props.onGroupChange).toHaveBeenCalledWith("category")
    fireEvent.click(screen.getByText("Choose dates"))
    expect(props.onDateChange).toHaveBeenLastCalledWith({ startDate: new Date(2026, 9, 1), endDate: new Date(2026, 9, 31) })
    rerender(<RecordsToolbar {...props} dateRange={props.onDateChange.mock.lastCall?.[0]} />)
    fireEvent.click(screen.getByRole("button", { name: "Clear date range" }))
    expect(props.onDateChange).toHaveBeenLastCalledWith(null)
    fireEvent.keyDown(sort, { key: "Enter" })
    fireEvent.click(await screen.findByRole("menuitem", { name: "Oldest" }))
    expect(props.onSortChange).toHaveBeenCalledWith("oldest")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it.each([true, false])("keeps selected-record actions in the modal (mobile: %s)", mobile => {
    jest.mocked(useIsMobile).mockReturnValue(mobile)
    const clearSelection = jest.fn()
    const deleteRecords = jest.fn()
    render(<RecordsBulkToolbar selectedRecords={new Set(["record-1"])} setSelectedRecords={clearSelection}
      isBulkActionLoading={false} categories={[]} handleBulkStatusChange={jest.fn()}
      handleBulkCategoryChange={jest.fn()} handleBulkDelete={deleteRecords} />)
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Change Status" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Choose bulk action" }))
    const panel = screen.getByRole("dialog", { name: "Choose bulk action" })
    expect(within(panel).getByRole("button", { name: "Change Status" })).toBeInTheDocument()
    expect(within(panel).getByRole("button", { name: "Change Category" })).toBeInTheDocument()
    fireEvent.click(within(panel).getByRole("button", { name: "Delete" }))
    expect(deleteRecords).toHaveBeenCalledTimes(1)
    fireEvent.click(within(panel).getByRole("button", { name: "Cancel" }))
    expect(clearSelection).toHaveBeenCalledWith(new Set())
  })
})