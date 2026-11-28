import { fireEvent, render, screen, within } from "@testing-library/react"
import { resolveRelationsForSidebar, type RecordItem } from "@/app/records/actions"
import { RecordsKanban } from "@/app/records/components/RecordsKanban"
import { groupTableRecords } from "@/app/records/lib/table-record-order"

jest.mock("@/app/records/actions", () => ({ resolveRelationsForSidebar: jest.fn() }))
jest.mock("@/app/hooks/use-user-data", () => ({ useUserData: () => ({ userData: {} }) }))
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

it("groups member avatars on the card and avoids repeating its Kanban column owner", async () => {
  jest.mocked(resolveRelationsForSidebar).mockResolvedValue({ "team_member:alex": "Alex", "team_member:pat": "Pat" })
  const item = record("assigned", "draft")
  item.category = { id: "reports", site_id: "site", name: "Reports", description: null, icon: null,
    created_at: item.created_at, updated_at: item.updated_at, template_fields: ["owner", "reviewer", "backup"].map(name => ({
      id: name, name, type: "relation", relationTarget: "team_member",
    })) }
  item.relations = { owner: "alex", reviewer: "pat", backup: "pat" }
  const props = { records: [item], sortBy: "newest" as const, onRecordClick: jest.fn(), onUpdateRecordStatus: jest.fn(),
    kanbanPagination: {}, totalCounts: {}, onLoadMore: jest.fn(), selectedRecords: new Set<string>(), onToggleRecordSelection: jest.fn() }
  const view = render(<RecordsKanban {...props} />)
  expect(screen.getByRole("heading", { name: "Activo" })).toBeInTheDocument()
  const stack = screen.getByRole("group", { name: "Assigned team members" })
  expect(await within(stack).findByRole("img", { name: "Alex" })).toBeInTheDocument()
  expect(within(stack).getAllByRole("img", { name: "Pat" })).toHaveLength(1)
  expect(resolveRelationsForSidebar).toHaveBeenLastCalledWith([{ target: "team_member", ids: ["alex", "pat"] }], "site")
  view.rerender(<RecordsKanban {...props} groupBy="team_member" />)
  expect(screen.getByRole("heading", { name: "Alex" })).toBeInTheDocument()
  const groupedStack = screen.getByRole("group", { name: "Assigned team members" })
  expect(within(groupedStack).queryByRole("img", { name: "Alex" })).not.toBeInTheDocument()
  expect(within(groupedStack).getByRole("img", { name: "Pat" })).toBeInTheDocument()
})