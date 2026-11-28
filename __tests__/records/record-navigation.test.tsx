import { fireEvent, render, screen, within } from "@testing-library/react"
import type { RecordItem } from "@/app/records/actions"
import { RecordBreadcrumbActions } from "@/app/records/[id]/components/RecordBreadcrumbActions"
import { RecordsCalendar } from "@/app/records/components/RecordsCalendar"
import { getRecordNeighbors, openRecordFromView } from "@/app/records/lib/record-navigation"
import { getTableRecordOrder } from "@/app/records/lib/table-record-order"

let mockViewKey: string | null
let mockSiteId: string

jest.mock("@/app/records/actions", () => ({ resolveRelationsForSidebar: jest.fn() }))
jest.mock("@/app/hooks/use-user-data", () => ({ useUserData: () => ({ userData: {} }) }))

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockViewKey ? { recordView: mockViewKey } : {}),
}))
jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({ currentSite: { id: mockSiteId } }),
  useOptionalSite: () => ({ currentSite: { id: mockSiteId }, isLoading: false }),
}))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}))

function open(recordId: string, ids: string[]) {
  const href = openRecordFromView("site-a", recordId, ids)
  return new URL(href, "https://example.test").searchParams.get("recordView")
}

function record(id: string, status: string, date = "2026-06-01"): RecordItem {
  return { id, site_id: "site-a", category_id: "category", title: id, status,
    created_at: `${date}T12:00:00Z`, updated_at: `${date}T12:00:00Z`, description: null, data: {}, relations: {} }
}

beforeEach(() => {
  mockSiteId = "site-a"
  mockViewKey = null
  sessionStorage.clear()
})

it("follows grouped table rows in page order rather than regrouping the full list", () => {
  const records = [record("published-1", "published"), record("draft-1", "draft"),
    record("archived-1", "archived"), record("draft-2", "draft")]

  expect(getTableRecordOrder(records, "status", 2)).toEqual(["draft-1", "published-1", "draft-2", "archived-1"])
})

it("keeps distinct view orders and ignores snapshots from a different workspace", () => {
  const table = open("record-b", ["record-a", "record-b", "record-c", "record-b"])
  const calendar = open("record-b", ["record-c", "record-b"])
  if (!table || !calendar) throw new Error("Expected both view snapshots")
  expect(table).not.toBe(calendar)
  expect(getRecordNeighbors("site-a", "record-b", table)).toEqual({
    previous: `/records/record-a?recordView=${table}`, next: `/records/record-c?recordView=${table}`,
  })
  expect(getRecordNeighbors("site-a", "record-b", calendar)).toEqual({
    previous: `/records/record-c?recordView=${calendar}`, next: null,
  })
  expect(getRecordNeighbors("site-b", "record-b", table)).toBeNull()
  expect(getRecordNeighbors("site-a", "record-a", calendar)).toBeNull()
})

it("uses only records rendered in the calendar period in calendar order", () => {
  const onRecordClick = jest.fn()
  jest.useFakeTimers().setSystemTime(new Date(2026, 5, 10, 12))
  try {
    render(<RecordsCalendar
      records={[record("later", "draft", "2026-06-12"), record("outside", "draft", "2026-08-01"), record("earlier", "draft", "2026-06-04")]}
      onRecordClick={onRecordClick}
    />)
    fireEvent.click(screen.getByText("later"))
    expect(onRecordClick).toHaveBeenCalledWith("later", ["earlier", "later"])
  } finally {
    jest.useRealTimers()
  }
})

it("portals accessible icon controls into the breadcrumb and disables them at boundaries or while saving", () => {
  mockViewKey = open("record-a", ["record-a", "record-b"])
  expect(mockViewKey).toBeTruthy()
  const view = render(<>
    <div id="record-breadcrumb-actions" data-testid="breadcrumb-actions" />
    <RecordBreadcrumbActions recordId="record-a" siteId="site-a" isSaving={false} />
  </>)
  const slot = within(screen.getByTestId("breadcrumb-actions"))
  expect(slot.getByRole("button", { name: "Previous record" })).toBeDisabled()
  expect(slot.getByRole("link", { name: "Next record" })).toHaveAttribute("href", `/records/record-b?recordView=${mockViewKey}`)

  view.rerender(<>
    <div id="record-breadcrumb-actions" data-testid="breadcrumb-actions" />
    <RecordBreadcrumbActions recordId="record-b" siteId="site-a" isSaving={false} />
  </>)
  expect(slot.getByRole("link", { name: "Previous record" })).toHaveAttribute("href", `/records/record-a?recordView=${mockViewKey}`)
  expect(slot.getByRole("button", { name: "Next record" })).toBeDisabled()

  view.rerender(<>
    <div id="record-breadcrumb-actions" data-testid="breadcrumb-actions" />
    <RecordBreadcrumbActions recordId="record-b" siteId="site-a" isSaving />
  </>)
  expect(slot.getByRole("button", { name: "Previous record" })).toBeDisabled()
  expect(slot.getByRole("button", { name: "Next record" })).toBeDisabled()

  mockViewKey = null
  view.rerender(<>
    <div id="record-breadcrumb-actions" data-testid="breadcrumb-actions" />
    <RecordBreadcrumbActions recordId="record-b" siteId="site-a" isSaving={false} />
  </>)
  expect(slot.queryByRole("group", { name: "Record navigation" })).not.toBeInTheDocument()
})

it.each([
  ["Previous record", "button"],
  ["Next record", "link"],
])("shows the %s tooltip on hover", async (label, role) => {
  mockViewKey = open("record-a", ["record-a", "record-b"])
  render(<>
    <div id="record-breadcrumb-actions" />
    <RecordBreadcrumbActions recordId="record-a" siteId="site-a" isSaving={false} />
  </>)

  const control = screen.getByRole(role, { name: label })
  fireEvent.pointerMove(control.closest("[data-toolbar-tooltip-trigger]")!, { pointerType: "mouse" })
  expect(await screen.findByRole("tooltip")).toHaveTextContent(label)
})