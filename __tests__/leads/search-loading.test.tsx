import { useState, type ReactNode } from "react"
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { useLeadsData } from "@/app/leads/hooks/use-leads-data"
import { WorkspaceSiteSWRScope } from "@/app/providers/WorkspaceSiteSWRScope"
import { LeadFilterModal } from "@/app/components/ui/lead-filter-modal"
import { getLeads, searchLeadsWithCount } from "@/app/leads/actions"
import { getSegments } from "@/app/segments/actions"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import type { Lead } from "@/app/leads/types"

const site = { id: "site-one" }
let mockSiteLoading = true
jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({ currentSite: site, isLoading: mockSiteLoading }),
}))
jest.mock("@/app/leads/actions", () => ({ getLeads: jest.fn(), searchLeadsWithCount: jest.fn() }))
jest.mock("@/app/segments/actions", () => ({ getSegments: jest.fn() }))
jest.mock("@/app/campaigns/actions/campaigns/read", () => ({ getCampaigns: jest.fn() }))
jest.mock("@/app/hooks/use-user-data", () => ({ useUserData: () => ({ userData: {} }) }))
const mockCount = jest.fn(async () => ({ count: 0, error: null }))
jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: () => ({ select: () => ({ eq: mockCount }) }) }),
}))

const lead = {
  id: "smoke-lead", name: "QA Smoke Lead", email: "smoke@example.invalid",
  status: "new", origin: null, personal_email: null, assignee_id: null,
} as Lead
const filters = { status: [], segments: [], origin: [], journeyStages: [] }

function wrapper() {
  const cache = new Map()
  return function Wrapper({ children }: { children: ReactNode }) {
    return <SWRConfig value={{ provider: () => cache, dedupingInterval: 0, shouldRetryOnError: false, keepPreviousData: true }}>
      <WorkspaceSiteSWRScope>{children}</WorkspaceSiteSWRScope>
    </SWRConfig>
  }
}

function SearchWithFilters() {
  const data = useLeadsData(site)
  const [open, setOpen] = useState(false)
  return <>
    <input aria-label="Search leads" value={data.searchQuery} onChange={event => data.setSearchQuery(event.target.value)} />
    <button onClick={() => setOpen(true)}>Filters</button>
    <LeadFilterModal isOpen={open} onClose={() => setOpen(false)} filters={filters}
      onApplyFilters={jest.fn()} segments={data.segments} />
    <div role="status">{data.loading ? "Loading leads" : "Loaded"}</div>
    {data.dbLeads.map(row => <div key={row.id}>{row.name}</div>)}
  </>
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSiteLoading = true
  jest.mocked(getLeads).mockResolvedValue({ leads: [] })
  jest.mocked(searchLeadsWithCount).mockResolvedValue({ leads: [lead], totalCount: 1 })
  jest.mocked(getSegments).mockResolvedValue({ segments: [{ id: "segment-one", name: "QA segment" }] } as Awaited<ReturnType<typeof getSegments>>)
  jest.mocked(getCampaigns).mockResolvedValue({ data: [], error: null })
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it("keeps segments iterable when workspace loading overrides SWR fallback data", async () => {
  const { result, rerender } = renderHook(() => useLeadsData(site), { wrapper: wrapper() })
  expect(result.current.loading).toBe(true)
  expect(result.current.segments).toEqual([])
  expect(getLeads).not.toHaveBeenCalled()
  expect(getSegments).not.toHaveBeenCalled()

  mockSiteLoading = false
  rerender()
  await waitFor(() => expect(result.current.segments).toEqual([{ id: "segment-one", name: "QA segment" }]))
  mockSiteLoading = true
  rerender()
  expect(result.current.loading).toBe(true)
  expect(result.current.segments).toEqual([])
})

it("keeps the closed filter modal and typed search mounted until site loading settles", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {})
  jest.useFakeTimers()
  const Wrapper = wrapper()
  const { rerender } = render(<Wrapper><SearchWithFilters /></Wrapper>)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent("Loading leads")
  fireEvent.change(screen.getByRole("textbox", { name: "Search leads" }), { target: { value: "QA Smoke Lead" } })
  await act(async () => { jest.advanceTimersByTime(350) })
  expect(searchLeadsWithCount).not.toHaveBeenCalled()
  expect(getSegments).not.toHaveBeenCalled()

  mockSiteLoading = false
  rerender(<Wrapper><SearchWithFilters /></Wrapper>)
  await waitFor(() => expect(screen.getByText("QA Smoke Lead")).toBeInTheDocument())
  expect(screen.getByRole("textbox")).toHaveValue("QA Smoke Lead")
  expect(searchLeadsWithCount).toHaveBeenCalledWith(site.id, "QA Smoke Lead", 200, 0)
  expect(getLeads).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Filters" }))
  await waitFor(() => expect(screen.getByRole("dialog", { name: "Filter leads" })).toBeInTheDocument())
  expect(screen.getByText("QA segment")).toBeInTheDocument()
  expect(console.error).not.toHaveBeenCalled()
})

it("does not let an older debounced query overwrite the current search results", async () => {
  jest.useFakeTimers()
  mockSiteLoading = false
  type SearchResult = Awaited<ReturnType<typeof searchLeadsWithCount>>
  let resolveOlder!: (value: SearchResult) => void
  let resolveCurrent!: (value: SearchResult) => void
  const older = new Promise<SearchResult>(resolve => { resolveOlder = resolve })
  const current = new Promise<SearchResult>(resolve => { resolveCurrent = resolve })
  jest.mocked(searchLeadsWithCount).mockImplementation((_siteId, query) => query === "older" ? older : current)
  const { result } = renderHook(() => useLeadsData(site), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.loading).toBe(false))

  act(() => result.current.setSearchQuery("older"))
  await act(async () => { jest.advanceTimersByTime(349) })
  expect(searchLeadsWithCount).not.toHaveBeenCalled()
  await act(async () => { jest.advanceTimersByTime(1) })
  expect(searchLeadsWithCount).toHaveBeenCalledWith(site.id, "older", 200, 0)
  act(() => result.current.setSearchQuery("QA Smoke Lead"))
  await act(async () => { jest.advanceTimersByTime(350) })
  expect(searchLeadsWithCount).toHaveBeenCalledWith(site.id, "QA Smoke Lead", 200, 0)

  await act(async () => resolveCurrent({ leads: [lead], totalCount: 1 }))
  expect(result.current.dbLeads).toEqual([lead])
  expect(result.current.searchTotalCount).toBe(1)
  await act(async () => resolveOlder({ leads: [], totalCount: 0 }))
  expect(result.current.dbLeads).toEqual([lead])
  expect(result.current.searchTotalCount).toBe(1)
})