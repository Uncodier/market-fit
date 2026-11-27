import { act, renderHook, waitFor } from "@testing-library/react"
import { useRecordsData } from "@/app/records/hooks/useRecordsData"
import { getRecordById, getRecords, getRecordCategories, updateRecord, updateRecordCategory, type RecordCategory, type RecordItem } from "@/app/records/actions"

jest.mock("@/app/records/actions", () => ({ getRecordById: jest.fn(), getRecords: jest.fn(), getRecordCategories: jest.fn(), updateRecord: jest.fn(), updateRecordCategory: jest.fn() }))
jest.mock("@/app/context/SiteContext", () => ({ useOptionalSite: () => ({ isLoading: false }) }))
jest.mock("sonner", () => ({ toast: { error: jest.fn() } }))

it("hides previously loaded site records immediately and clears data on failed refresh", async () => {
  jest.mocked(getRecords).mockResolvedValue({ records: [{ id: "old" }] as never, error: null })
  jest.mocked(getRecordCategories).mockResolvedValue({ categories: [{ id: "old-category" }] as never, error: null })
  const { result, rerender } = renderHook(({ site }) => useRecordsData(site), { initialProps: { site: "first" } })
  await waitFor(() => expect(result.current.records).toHaveLength(1))
  jest.mocked(getRecords).mockResolvedValue({ records: null, error: "denied" })
  jest.mocked(getRecordCategories).mockResolvedValue({ categories: null, error: "denied" })
  rerender({ site: "second" })
  expect(result.current.records).toEqual([])
  expect(result.current.categories).toEqual([])
  await act(async () => { await result.current.refreshData() })
  expect(result.current.records).toEqual([])
  expect(result.current.categories).toEqual([])
  expect(result.current.error).toBe("denied")
})

it("exposes load failure separately from an empty result and clears the error on retry", async () => {
  jest.mocked(getRecords).mockResolvedValue({ records: null, error: "Read failed" })
  jest.mocked(getRecordCategories).mockResolvedValue({ categories: [], error: null })
  const { result } = renderHook(() => useRecordsData("site"))
  await waitFor(() => expect(result.current.error).toBe("Read failed"))
  expect(result.current.isLoading).toBe(false)
  jest.mocked(getRecords).mockResolvedValue({ records: [], error: null })
  await act(async () => { await result.current.refreshData() })
  expect(result.current.error).toBeNull()
  expect(result.current.records).toEqual([])
})

it("saves at the editor's loaded version and applies the returned row without losing category metadata", async () => {
  const category = { id: "category" } as NonNullable<RecordItem["category"]>
  const record = { id: "record", title: "Before", site_id: "site", updated_at: "v1", category } as RecordItem
  jest.mocked(getRecords).mockResolvedValue({ records: [record], error: null })
  jest.mocked(getRecordCategories).mockResolvedValue({ categories: [category], error: null })
  jest.mocked(updateRecord).mockResolvedValue({ record: { id: "record", title: "After", updated_at: "v2" } })
  const { result } = renderHook(() => useRecordsData("site"))
  await waitFor(() => expect(result.current.records).toEqual([record]))
  await act(async () => { await result.current.saveRecordProperty(record, { title: "After" }) })
  expect(updateRecord).toHaveBeenCalledWith("record", { title: "After" }, "v1")
  expect(result.current.records).toEqual([{ ...record, title: "After", updated_at: "v2" }])
})

it("appends a property at the category's loaded version and reloads the category template", async () => {
  const existing = { id: "existing", name: "name", type: "text" }
  const added = { id: "new", name: "due", label: "Due date", type: "date" }
  const category = { id: "category", site_id: "site", updated_at: "v1", template_fields: [existing] } as RecordCategory
  const updated = { ...category, updated_at: "v2", template_fields: [existing, added] }
  jest.mocked(getRecords).mockResolvedValue({ records: [], error: null })
  jest.mocked(getRecordCategories).mockResolvedValueOnce({ categories: [category], error: null })
    .mockResolvedValue({ categories: [updated], error: null })
  jest.mocked(updateRecordCategory).mockResolvedValue({ category: updated })
  const { result } = renderHook(() => useRecordsData("site"))
  await waitFor(() => expect(result.current.categories).toEqual([category]))
  await act(async () => { await result.current.addTableProperty(category, added) })
  expect(updateRecordCategory).toHaveBeenCalledWith(category.id, { template_fields: [existing, added] }, "v1")
  expect(result.current.categories).toEqual([updated])
})

describe("inline recovery", () => {
  const record: RecordItem = {
    id: "new-record", site_id: "site", category_id: "category", title: "Untitled Record",
    status: "draft", data: {}, relations: {}, description: null,
    created_at: "2026-01-01T00:00:00.000001Z", updated_at: "2026-01-01T00:00:00.000001Z",
  }
  const indexed = { ...record, updated_at: "2026-01-01T00:00:00.000002Z" }
  const versionRejection = { error: "Stale record", conflict: true }

  beforeEach(() => {
    jest.resetAllMocks()
    jest.mocked(getRecordCategories).mockResolvedValue({ categories: [], error: null })
    jest.mocked(getRecords).mockResolvedValue({ records: [record], error: null })
  })

  it("saves a new row's first inline status edit after indexing changed only its version", async () => {
    jest.mocked(getRecordById).mockResolvedValue({ record: indexed, error: null })
    jest.mocked(updateRecord).mockResolvedValueOnce(versionRejection)
      .mockResolvedValueOnce({ record: { ...indexed, status: "active", updated_at: "2026-01-01T00:00:00.000003Z" } })
    const { result } = renderHook(() => useRecordsData("site"))
    await waitFor(() => expect(result.current.records).toEqual([record]))

    await act(async () => {
      expect(await result.current.saveRecordProperty(record, { status: "active" })).toEqual({})
    })

    expect(updateRecord).toHaveBeenLastCalledWith(record.id, { status: "active" }, indexed.updated_at)
    expect(result.current.records[0].status).toBe("active")
    expect(getRecords).toHaveBeenCalledTimes(1)
  })

  it("combines a second cell edit based on the row before the first edit finished", async () => {
    const first = { ...indexed, data: { calls: 4 } }
    const second = { ...first, data: { calls: 4, demos: 2 }, updated_at: "2026-01-01T00:00:00.000003Z" }
    jest.mocked(updateRecord).mockResolvedValueOnce({ record: first }).mockResolvedValueOnce(versionRejection)
      .mockResolvedValueOnce({ record: second })
    jest.mocked(getRecordById).mockResolvedValue({ record: first, error: null })
    const { result } = renderHook(() => useRecordsData("site"))
    await waitFor(() => expect(result.current.records).toEqual([record]))
    await act(async () => { await result.current.saveRecordProperty(record, { data: { calls: 4 } }) })
    await act(async () => { await result.current.saveRecordProperty(record, { data: { demos: 2 } }) })
    expect(updateRecord).toHaveBeenLastCalledWith(record.id, { data: second.data }, first.updated_at)
    expect(result.current.records).toEqual([second])
  })

  it("refreshes the row without overwriting a different concurrent edit to the same status", async () => {
    const latest = { ...indexed, status: "archived" }
    jest.mocked(getRecords).mockResolvedValueOnce({ records: [record], error: null })
      .mockResolvedValue({ records: [latest], error: null })
    jest.mocked(getRecordById).mockResolvedValue({ record: latest, error: null })
    jest.mocked(updateRecord).mockResolvedValueOnce(versionRejection)
    const { result } = renderHook(() => useRecordsData("site"))
    await waitFor(() => expect(result.current.records).toEqual([record]))
    await act(async () => {
      expect(await result.current.saveRecordProperty(record, { status: "active" })).toMatchObject({ conflict: true })
    })
    expect(updateRecord).toHaveBeenCalledTimes(1)
    expect(result.current.records).toEqual([latest])
  })
})