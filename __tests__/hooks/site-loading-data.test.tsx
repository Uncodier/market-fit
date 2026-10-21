import { act, renderHook, waitFor } from "@testing-library/react"
import { useRecordsData } from "@/app/records/hooks/useRecordsData"
import { useRequirementsList } from "@/app/requirements/use-requirements-list"
import { getRecordCategories, getRecords } from "@/app/records/actions"
import { toast } from "sonner"

let mockLoading = true
let mockSiteId = "site"
const mockFrom = jest.fn()
const mockClient = { from: mockFrom }
jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({ currentSite: { id: mockSiteId }, isLoading: mockLoading }),
  useOptionalSite: () => ({ isLoading: mockLoading }),
}))
jest.mock("@/lib/supabase/client", () => ({ createClient: () => mockClient }))
jest.mock("@/app/records/actions", () => ({ getRecordCategories: jest.fn(), getRecords: jest.fn() }))
jest.mock("@/app/requirements/actions", () => ({ updateRequirementPriority: jest.fn(), updateRequirementStatus: jest.fn() }))
jest.mock("@/app/components/ui/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("sonner", () => ({ toast: { error: jest.fn() } }))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  mockLoading = true
  mockSiteId = "site"
  jest.clearAllMocks()
  jest.mocked(getRecordCategories).mockResolvedValue({ categories: [], error: null })
  jest.mocked(getRecords).mockResolvedValue({ records: [], error: null })
  const query = {
    select: jest.fn(), eq: jest.fn(), order: jest.fn(),
    single: jest.fn(async () => ({ data: { id: mockSiteId }, error: null })),
    then: (resolve: (value: { data: never[]; error: null }) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
  }
  for (const method of [query.select, query.eq, query.order]) method.mockReturnValue(query)
  mockFrom.mockReturnValue(query)
})

it("Records waits for initialization and resumes automatically", async () => {
  const { result, rerender } = renderHook(() => useRecordsData(mockSiteId))
  expect(getRecords).not.toHaveBeenCalled()
  expect(result.current.isLoading).toBe(true)
  mockLoading = false
  rerender()
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(getRecords).toHaveBeenCalledWith("site")
})

it("ignores stale Records errors when site loading restarts", async () => {
  mockLoading = false
  const pending = deferred<Awaited<ReturnType<typeof getRecords>>>()
  jest.mocked(getRecords).mockReturnValueOnce(pending.promise)
  const { result, rerender } = renderHook(() => useRecordsData(mockSiteId))
  mockLoading = true
  rerender()
  await act(async () => { pending.resolve({ records: null, error: "Forbidden" }) })
  expect(toast.error).not.toHaveBeenCalled()
  expect(result.current.isLoading).toBe(true)
  mockLoading = false
  rerender()
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(getRecords).toHaveBeenCalledTimes(2)
})

it("does not publish an old site's successful Records response after switching", async () => {
  mockLoading = false
  const pending = deferred<Awaited<ReturnType<typeof getRecords>>>()
  jest.mocked(getRecords).mockReturnValueOnce(pending.promise)
  const { result, rerender } = renderHook(() => useRecordsData(mockSiteId))
  mockSiteId = "another-site"
  rerender()
  await waitFor(() => expect(getRecords).toHaveBeenCalledWith("another-site"))
  await act(async () => { pending.resolve({ records: [{ id: "old-record", site_id: "site", category_id: "category",
    title: "Old record", description: null, data: {}, relations: {}, status: "active",
    created_at: "2026-10-21", updated_at: "2026-10-21" }], error: null }) })
  expect(result.current.records).toEqual([])
})

it("Requirements waits for initialization and resumes without a filter change", async () => {
  const { result, rerender } = renderHook(() => useRequirementsList())
  expect(mockFrom).not.toHaveBeenCalled()
  expect(result.current.isLoading).toBe(true)
  mockLoading = false
  rerender()
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(mockFrom).toHaveBeenCalledWith("requirements")
  expect(result.current.visibleError).toBeNull()
})

it("ignores a Requirements site response arriving after context loading restarts", async () => {
  mockLoading = false
  const pending = deferred<{ data: null; error: { message: string } }>()
  const query = mockFrom()
  query.single.mockReturnValueOnce(pending.promise)
  const { result, rerender } = renderHook(() => useRequirementsList())
  mockLoading = true
  rerender()
  await act(async () => { pending.resolve({ data: null, error: { message: "Forbidden" } }) })
  expect(result.current.visibleError).toBeNull()
  expect(result.current.isLoading).toBe(true)
})