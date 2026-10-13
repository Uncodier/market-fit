import { act, renderHook, waitFor } from "@testing-library/react"
import type { KeyedMutator } from "swr"
import { useLeadsData, type LeadsData } from "@/app/leads/hooks/use-leads-data"
import { useLeadJourneyStages } from "@/app/leads/hooks/use-lead-journey-stages"
import { useLeadsKanban } from "@/app/leads/hooks/use-leads-kanban"
import type { Lead } from "@/app/leads/types"
import { getLeads, searchLeadsWithCount } from "@/app/leads/actions"
import { getSegments } from "@/app/segments/actions"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import { useUserData } from "@/app/hooks/use-user-data"

type SWRCall = { key: string[] | null; fetcher: (key: string[]) => Promise<unknown>; options: Record<string, unknown> }
const mockSWRCalls: SWRCall[] = []
const mockLeadsData: LeadsData = { leads: [], totalCount: 0, isSearch: false }
jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn((key, fetcher, options) => {
    mockSWRCalls.push({ key, fetcher, options })
    return { data: key?.[0] === "leads" ? mockLeadsData : [], isLoading: false, mutate: jest.fn() }
  }),
}))
jest.mock("@/app/leads/actions", () => ({ getLeads: jest.fn(), searchLeadsWithCount: jest.fn() }))
jest.mock("@/app/segments/actions", () => ({ getSegments: jest.fn() }))
jest.mock("@/app/campaigns/actions/campaigns/read", () => ({ getCampaigns: jest.fn() }))
jest.mock("@/app/hooks/use-user-data", () => ({ useUserData: jest.fn(() => ({ userData: {} })) }))
jest.mock("sonner", () => ({ toast: { error: jest.fn() } }))

let mockQueryResponse: { data: unknown[]; count: number; error: { message: string } | null }
const mockSelect = jest.fn()
const mockEq = jest.fn()
const mockIn = jest.fn()
const mockOrder = jest.fn()
const mockRange = jest.fn()
const mockFrom = jest.fn(() => {
  const chain = {
    select: (...args: unknown[]) => { mockSelect(...args); return chain },
    eq: (...args: unknown[]) => { mockEq(...args); return chain },
    in: (...args: unknown[]) => { mockIn(...args); return chain },
    order: (...args: unknown[]) => { mockOrder(...args); return chain },
    range: (...args: unknown[]) => { mockRange(...args); return Promise.resolve(mockQueryResponse) },
    limit: () => Promise.resolve(mockQueryResponse),
    then: (resolve: (value: typeof mockQueryResponse) => void) => resolve(mockQueryResponse),
  }
  return chain
})
jest.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from: mockFrom }) }))

const site = { id: "site-one" }
const first = { id: "one", name: "One", status: "new", origin: "lead_generation_workflow", personal_email: "" } as Lead
const primary = () => mockSWRCalls.filter(call => call.key?.[0] === "leads").at(-1)!

beforeEach(() => {
  jest.clearAllMocks()
  mockSWRCalls.length = 0
  mockLeadsData.leads = []
  mockLeadsData.totalCount = 0
  mockLeadsData.isSearch = false
  mockQueryResponse = { data: [], count: 151, error: null }
  jest.spyOn(console, "error").mockImplementation(() => {})
  jest.spyOn(console, "warn").mockImplementation(() => {})
})
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe("extracted lead data", () => {
  it("preserves SWR keys, debounce, normalization, search limit and count semantics", async () => {
    jest.useFakeTimers()
    jest.mocked(getLeads).mockResolvedValue({ leads: [{ ...first, site_id: site.id, user_id: "user" }] })
    jest.mocked(searchLeadsWithCount).mockResolvedValue({ leads: [{ ...first, site_id: site.id, user_id: "user" }], totalCount: 87 })
    const { result } = renderHook(() => useLeadsData(site))
    expect(primary().key).toEqual(["leads", site.id, ""])
    expect(primary().options).toEqual({ revalidateOnFocus: false })
    expect(await primary().fetcher(primary().key!)).toEqual({ leads: [{ ...first, site_id: site.id, user_id: "user", origin: "Makinari", personal_email: null }], totalCount: 151, isSearch: false })
    expect(getLeads).toHaveBeenCalledWith(site.id)
    expect(mockSelect).toHaveBeenCalledWith("*", { count: "exact", head: true })
    expect(mockEq).toHaveBeenCalledWith("site_id", site.id)
    act(() => result.current.setSearchQuery("query"))
    act(() => jest.advanceTimersByTime(349))
    expect(primary().key).toEqual(["leads", site.id, ""])
    act(() => jest.advanceTimersByTime(1))
    expect(primary().key).toEqual(["leads", site.id, "query"])
    mockFrom.mockClear()
    expect(await primary().fetcher(primary().key!)).toMatchObject({ totalCount: 87, isSearch: true })
    expect(searchLeadsWithCount).toHaveBeenCalledWith(site.id, "query", 200, 0)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("preserves missing-site request gating, segments/campaigns and unique assignees", async () => {
    const { rerender } = renderHook(({ currentSite }) => useLeadsData(currentSite), { initialProps: { currentSite: null as typeof site | null } })
    expect(mockSWRCalls.every(call => call.key === null)).toBe(true)
    mockLeadsData.leads = [first, { ...first, id: "two", assignee_id: "user" }, { ...first, id: "three", assignee_id: "user" }]
    rerender({ currentSite: site })
    expect(useUserData).toHaveBeenLastCalledWith(["user"])
    jest.mocked(getSegments).mockResolvedValue({ segments: [{ id: "segment", name: "Segment" }] } as Awaited<ReturnType<typeof getSegments>>)
    jest.mocked(getCampaigns).mockResolvedValue({ data: [], error: null })
    const segments = mockSWRCalls.find(call => call.key?.[0] === "segments")!
    const campaigns = mockSWRCalls.find(call => call.key?.[0] === "campaigns")!
    expect(segments.options).toEqual({ fallbackData: [] })
    expect(await segments.fetcher(segments.key!)).toEqual([{ id: "segment", name: "Segment" }])
    expect(await campaigns.fetcher(campaigns.key!)).toEqual([])
    expect(getSegments).toHaveBeenCalledWith(site.id)
    expect(getCampaigns).toHaveBeenCalledWith(site.id)
  })
})

describe("extracted journey stages", () => {
  it("preserves highest-stage selection, cached reuse and explicit invalidation", async () => {
    mockQueryResponse.data = [
      { lead_id: "journey-one", stage: "awareness" },
      { lead_id: "journey-one", stage: "purchase" },
    ]
    const leads = [{ ...first, id: "journey-one" }]
    const { result, rerender } = renderHook(({ currentLeads }) => useLeadJourneyStages(currentLeads, site), { initialProps: { currentLeads: leads } })
    await waitFor(() => expect(result.current.leadJourneyStages["journey-one"]).toBe("purchase"))
    expect(mockIn).toHaveBeenCalledWith("status", ["completed", "in_progress"])
    expect(mockIn).toHaveBeenCalledWith("lead_id", ["journey-one"])
    mockFrom.mockClear()
    rerender({ currentLeads: [...leads] })
    await waitFor(() => expect(result.current.isLoadingJourneyStages).toBe(false))
    expect(mockFrom).not.toHaveBeenCalled()
    mockQueryResponse.data = [{ lead_id: "journey-one", stage: "referral" }]
    act(() => result.current.invalidateJourneyStageCache("journey-one"))
    await waitFor(() => expect(result.current.leadJourneyStages["journey-one"]).toBe("referral"))
  })

  it("keeps denied-task fallback cached as unaware", async () => {
    mockQueryResponse.error = { message: "Denied" }
    const leads = [{ ...first, id: "journey-denied" }]
    const { result } = renderHook(() => useLeadJourneyStages(leads, site))
    await waitFor(() => expect(result.current.leadJourneyStages["journey-denied"]).toBe("not_contacted"))
    expect(result.current.isLoadingJourneyStages).toBe(false)
    expect(result.current.reloadingLeads.size).toBe(0)
  })
})

describe("extracted kanban pagination", () => {
  it("preserves count thresholds, 50-row ranges, deduplication and normalization", async () => {
    let data: LeadsData = { leads: [first], totalCount: 151, isSearch: false }
    const mutate = jest.fn((updater: (current: LeadsData) => LeadsData) => { data = updater(data); return Promise.resolve(data) })
    const { result } = renderHook(() => useLeadsKanban(site, "kanban", false, mutate as unknown as KeyedMutator<LeadsData>))
    await waitFor(() => expect(result.current.totalCounts.new).toBe(151))
    expect(result.current.kanbanPagination.new.hasMore).toBe(true)
    expect(mockEq).toHaveBeenCalledWith("status", "not_qualified")
    mockQueryResponse.data = [first, { ...first, id: "two" }]
    await act(() => result.current.handleLoadMoreKanban("new"))
    expect(mockRange).toHaveBeenCalledWith(50, 99)
    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false })
    expect(data.leads.map(l => l.id)).toEqual(["one", "two"])
    expect(data.leads[1]).toMatchObject({ origin: "Makinari", personal_email: null })
    expect(data.totalCount).toBe(151)
    expect(mutate).toHaveBeenCalledWith(expect.any(Function), { revalidate: false })
    expect(result.current.kanbanPagination.new).toEqual({ page: 2, hasMore: false, isLoading: false })
    mockRange.mockClear()
    await act(() => result.current.handleLoadMoreKanban("new"))
    expect(mockRange).not.toHaveBeenCalled()
  })

  it("does not load total counts for table view", () => {
    renderHook(() => useLeadsKanban(site, "table", false, jest.fn() as KeyedMutator<LeadsData>))
    expect(mockFrom).not.toHaveBeenCalled()
  })
})