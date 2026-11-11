import { matchesRecordListFilter, recordListPage, type RecordListFilter } from "@/app/records/lib/list-filter"

const record = { category_id: "implementations", title: "Existing implementation", created_at: "2026-09-01T12:00:00Z", relations: { Client: "client-one" } }
const filter: RecordListFilter = { categoryId: "implementations", relation: { fieldName: "Client", targetId: "client-one" }, search: "", dateRange: null }

describe("Records list visibility", () => {
  it("shows older records when selecting a client without an explicit date filter", () => {
    expect(matchesRecordListFilter(record, filter)).toBe(true)
  })
  it("only excludes older records when a date range is explicitly selected", () => {
    const dateRange = { startDate: new Date(2026, 9, 11), endDate: new Date(2026, 10, 10) }
    expect(matchesRecordListFilter(record, { ...filter, dateRange })).toBe(false)
    expect(matchesRecordListFilter(record, { ...filter, dateRange: null })).toBe(true)
  })
  it("keeps category and exact relation filtering independent of the date range", () => {
    expect(matchesRecordListFilter({ ...record, category_id: "other" }, filter)).toBe(false)
    expect(matchesRecordListFilter({ ...record, relations: { Client: "another" } }, filter)).toBe(false)
    expect(matchesRecordListFilter({ ...record, relations: null }, filter)).toBe(false)
    expect(matchesRecordListFilter(record, { ...filter, search: " IMPLEMENTATION " })).toBe(true)
  })
  it("includes the full last selected calendar day", () => {
    expect(matchesRecordListFilter({ ...record, created_at: new Date(2026, 10, 10, 23, 59, 59).toISOString() }, {
      ...filter, dateRange: { startDate: new Date(2026, 10, 10), endDate: new Date(2026, 10, 10) },
    })).toBe(true)
  })
  it("does not keep an out-of-range page after narrowing the list", () => {
    expect(recordListPage(6, 2, 10)).toBe(1)
    expect(recordListPage(2, 30, 10)).toBe(2)
    expect(recordListPage(6, 0, 10)).toBe(1)
  })
})