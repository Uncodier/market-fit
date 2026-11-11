import { act, renderHook, waitFor } from "@testing-library/react"
import { useRecordsData } from "@/app/records/hooks/useRecordsData"
import { getRecords, getRecordCategories } from "@/app/records/actions"

jest.mock("@/app/records/actions", () => ({ getRecords: jest.fn(), getRecordCategories: jest.fn() }))
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