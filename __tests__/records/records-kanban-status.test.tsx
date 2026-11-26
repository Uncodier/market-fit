import { fireEvent, render, screen } from "@testing-library/react"
import type { RecordItem } from "@/app/records/actions"
import { RecordsKanban } from "@/app/records/components/RecordsKanban"
import { groupTableRecords } from "@/app/records/lib/table-record-order"

jest.mock("@/app/records/actions", () => ({ resolveRelationsForSidebar: jest.fn() }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site" } }) }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => key === "status.active" ? "Activo" : key }),
}))

function record(id: string, status: string): RecordItem {
  return { id, status, title: `Record ${id}`, site_id: "site", category_id: "reports", description: null,
    created_at: "2026-06-01T12:00:00Z", updated_at: "2026-06-01T12:00:00Z", data: {}, relations: {} }
}

it("renders records with active and other stored statuses, preserving column order in navigation", () => {
  const records = [record("a", "active"), record("b", "in review"), record("c", "published"), record("d", ""), record("e", "constructor")]
  const category = "A very long category name for quarterly investor reports"
  records[0].category = { id: "reports", site_id: "site", name: ` ${category} `, template_fields: [],
    description: null, icon: null, created_at: records[0].created_at, updated_at: records[0].updated_at }
  const onOpen = jest.fn()
  render(<RecordsKanban records={records} sortBy="newest" onRecordClick={onOpen} onUpdateRecordStatus={jest.fn()}
    kanbanPagination={{}} totalCounts={{}} onLoadMore={jest.fn()} selectedRecords={new Set()} onToggleRecordSelection={jest.fn()} />)
  expect(screen.getByRole("heading", { name: "Activo" })).toBeInTheDocument()
  expect(screen.getByRole("heading", { name: "In review" })).toBeInTheDocument()
  for (const item of records) expect(screen.getByText(item.title)).toBeInTheDocument()
  expect(screen.getByTitle(category)).toContainElement(screen.getByText(category))
  expect(screen.getByText(category)).toHaveClass("truncate")
  fireEvent.click(screen.getByRole("button", { name: "Open record: Record a" }))
  expect(onOpen).toHaveBeenCalledWith("a", ["d", "c", "a", "e", "b"])
  const { groupedRecords, groupKeys } = groupTableRecords(records, "status")
  expect(groupKeys).toEqual(["draft", "published", "active", "constructor", "in review"])
  expect(groupedRecords.active).toEqual([records[0]])
})