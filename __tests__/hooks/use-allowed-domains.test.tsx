import { act, renderHook, waitFor } from "@testing-library/react"
import { useAllowedDomains } from "@/app/hooks/use-allowed-domains"

let mockSite: { id: string } | null = { id: "site" }
const mockInsert = jest.fn()
const mockOrder = jest.fn()
const mockSingle = jest.fn()
const mockEq = jest.fn(() => ({ order: mockOrder }))
const mockSelect = jest.fn(() => ({ eq: mockEq }))
const mockFrom = jest.fn(() => ({ select: mockSelect, insert: mockInsert }))
const mockToastError = jest.fn()

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: mockSite }) }))
jest.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from: mockFrom }) }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: (...args: unknown[]) => mockToastError(...args) } }))

beforeEach(() => {
  jest.clearAllMocks()
  mockSite = { id: "site" }
  mockOrder.mockResolvedValue({ data: [], error: null })
  mockInsert.mockReturnValue({ select: () => ({ single: mockSingle }) })
  mockSingle.mockResolvedValue({ data: {
    id: "new", site_id: "site", domain: "manual.example.com", source: "user", created_at: "2026-10-16",
  }, error: null })
})

it("marks manual domain inserts as user-created and uses the persisted receipt", async () => {
  const { result } = renderHook(() => useAllowedDomains())
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  await act(async () => { expect(await result.current.addDomain(" Manual.Example.COM ")).toBe(true) })
  expect(mockInsert).toHaveBeenCalledWith([{ site_id: "site", domain: "manual.example.com", source: "user" }])
  expect(mockEq).toHaveBeenCalledWith("site_id", "site")
  expect(result.current.domains[0].source).toBe("user")
})

it("does not silently retry an insert without provenance when the migration is missing", async () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {})
  mockSingle.mockResolvedValue({ data: null, error: { code: "PGRST204" } })
  try {
    const { result } = renderHook(() => useAllowedDomains())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { expect(await result.current.addDomain("manual.example.com")).toBe(false) })
    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(result.current.domains).toEqual([])
    expect(mockToastError).toHaveBeenCalledWith("Failed to add domain")
  } finally { consoleError.mockRestore() }
})

it("requires a selected site before writing", async () => {
  mockSite = null
  const { result } = renderHook(() => useAllowedDomains())
  await act(async () => { expect(await result.current.addDomain("manual.example.com")).toBe(false) })
  expect(mockInsert).not.toHaveBeenCalled()
})