import { fireEvent, render, screen, within } from "@testing-library/react"
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
    "datePicker.allTime": "All time",
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
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useIsMobile).mockReturnValue(true)
  })

  it("keeps filters in the shared panel and the view selector in the header", async () => {
    const props = toolbarProps()
    render(<RecordsToolbar {...props} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(screen.queryByText("Choose dates")).not.toBeInTheDocument()
    expect(screen.queryByTitle("Sort by")).not.toBeInTheDocument()

    for (const view of ["table", "kanban", "calendar", "graph"]) {
      fireEvent.click(screen.getByRole("radio", { name: `Toggle ${view} view` }))
      if (view !== "table") expect(props.onViewChange).toHaveBeenLastCalledWith(view)
    }
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    const panel = screen.getByRole("dialog", { name: "Search" })
    const search = within(panel).getByPlaceholderText("Search records...")
    fireEvent.change(search, { target: { value: "Proposal" } })
    expect(props.onSearchChange).toHaveBeenCalledWith("Proposal")
    expect(within(panel).getByRole("combobox", { name: "Group by" })).toBeInTheDocument()

    fireEvent.click(within(panel).getByText("Choose dates"))
    expect(props.onDateChange).toHaveBeenLastCalledWith({ startDate: new Date(2026, 9, 1), endDate: new Date(2026, 9, 31) })
    fireEvent.click(within(panel).getByRole("button", { name: "All time" }))
    expect(props.onDateChange).toHaveBeenLastCalledWith(null)

    fireEvent.keyDown(within(panel).getByTitle("Sort by"), { key: "Enter" })
    fireEvent.click(await screen.findByRole("menuitem", { name: "Oldest" }))
    expect(props.onSortChange).toHaveBeenCalledWith("oldest")
    expect(screen.getByRole("dialog", { name: "Search" })).toBeInTheDocument()

    expect(within(panel).queryByRole("radio", { name: "Toggle graph view" })).not.toBeInTheDocument()
  })

  it("keeps the options in the modal even above the mobile breakpoint", () => {
    jest.mocked(useIsMobile).mockReturnValue(false)
    const props = toolbarProps()
    render(<RecordsToolbar {...props} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(screen.queryByTitle("Sort by")).not.toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Toggle graph view" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    const panel = screen.getByRole("dialog", { name: "Search" })
    expect(within(panel).getByPlaceholderText("Search records...")).toBeInTheDocument()
    expect(within(panel).getByRole("combobox", { name: "Group by" })).toBeInTheDocument()
    expect(within(panel).getByText("Choose dates")).toBeInTheDocument()
    expect(within(panel).getByTitle("Sort by")).toBeInTheDocument()
    expect(within(panel).queryByRole("radio", { name: "Toggle graph view" })).not.toBeInTheDocument()
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