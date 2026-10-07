import React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import useSWR from "swr"
import ContentPage from "@/app/content/page"
import { useSite } from "@/app/context/SiteContext"
import { ContentTypeViews } from "@/app/content/components/ContentTypeViews"
import type { ContentItem } from "@/app/content/actions"

jest.mock("swr", () => ({ __esModule: true, default: jest.fn() }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("@/app/context/LayoutContext", () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: () => false }))
jest.mock("@/app/hooks/use-command-k", () => ({ useCommandK: jest.fn() }))
jest.mock("@/app/content/actions", () => ({ getContent: jest.fn(), updateContentStatus: jest.fn() }))
jest.mock("@/app/content/open-content-item", () => ({ openContentItem: jest.fn() }))
jest.mock("@/app/assets/actions", () => ({ getContentAssetsByContentIds: jest.fn() }))
jest.mock("@/app/components/dashboard/social-actions", () => ({ getSocialPerformanceSnapshots: jest.fn() }))
jest.mock("@/app/segments/actions", () => ({ getSegments: jest.fn() }))
jest.mock("@/app/campaigns/actions/campaigns/read", () => ({ getCampaigns: jest.fn() }))
jest.mock("@/app/components/trends", () => ({ TrendsSection: () => null, TrendsColumn: () => null }))
jest.mock("@/app/content/components", () => ({ CreateContentDialog: () => null }))
jest.mock("@/app/content/components/ContentDetail", () => ({ ContentDetail: () => null }))
jest.mock("@/app/content/components/ContentFiltersDialog", () => ({ ContentFiltersDialog: () => null }))
jest.mock("@/app/content/components/ContentPublishDialog", () => ({ ContentPublishDialog: () => null }))
jest.mock("@/app/components/view-selector", () => ({
  ViewSelector: ({ onViewChange }: { onViewChange: (value: string) => void }) => (
    <button onClick={() => onViewChange("table")}>Table view</button>
  ),
}))

// Keep the real view's loading branch and both original skeletons. Only the
// populated/empty renderers are simplified to avoid editors, DnD, and actions.
jest.mock("@/app/content/components/ContentTypeViews", () => {
  const actual = jest.requireActual("@/app/content/components/ContentTypeViews")
  return { ContentTypeViews: jest.fn((props: React.ComponentProps<typeof ContentTypeViews>) => (
    <div data-testid="content-views"><actual.ContentTypeViews {...props} /></div>
  )) }
})
jest.mock("@/app/content/components/ContentKanban", () => ({
  ContentKanban: ({ contentItems }: { contentItems: ContentItem[] }) => (
    <div>{["draft", "review", "approved", "published", "archived"].map(status => (
      <section key={status} aria-label={status}>
        {contentItems.filter(item => item.status === status).length
          ? contentItems.filter(item => item.status === status).map(item => <p key={item.id}>{item.title}</p>)
          : <p>No content</p>}
      </section>
    ))}</div>
  ),
}))
jest.mock("@/app/content/components/ContentTable", () => ({
  ...jest.requireActual("@/app/content/components/ContentTable"),
  ContentTable: ({ contentItems }: { contentItems: ContentItem[] }) => (
    <div>{contentItems.length ? contentItems.map(item => <p key={item.id}>{item.title}</p>) : <p>No content</p>}</div>
  ),
}))

interface RequestState {
  data?: { content: ContentItem[]; count: number; assetsByContentId: Record<string, never> }
  isLoading: boolean
  isValidating?: boolean
  error?: Error
}

const requests = new Map<string, RequestState>()
const mutate = jest.fn()
const getSettings = jest.fn().mockResolvedValue(null)
const views = jest.mocked(ContentTypeViews)
const swr = jest.mocked(useSWR)
const site = jest.mocked(useSite)
const content = (title: string, siteId: string): ContentItem => ({
  id: title, title, description: null, type: "blog_post", content: "Copy", text: "Copy",
  instructions: null, status: "draft", segment_id: null, campaign_id: null, site_id: siteId,
  author_id: null, user_id: null, created_at: "2026-10-05", updated_at: "2026-10-05",
  published_at: null, tags: null, word_count: 1, estimated_reading_time: null,
  seo_score: null, performance_rating: null,
})

function setSite(id: string | null, isLoading = false, error: Error | null = null) {
  const currentSite = id ? {
    id, name: "Test site", url: null, description: null, logo_url: null,
    user_id: "test-user", created_at: "2026-10-05", updated_at: "2026-10-05", resource_urls: null,
  } : null
  site.mockReturnValue({
    currentSite, sites: currentSite ? [currentSite] : [], isLoading, error, getSettings,
    setCurrentSite: jest.fn(), updateSite: jest.fn(), createSite: jest.fn(), deleteSite: jest.fn(),
    refreshSites: jest.fn(), refreshSiteBilling: jest.fn(), updateSettings: jest.fn(), updateBilling: jest.fn(),
    getBillingInfo: jest.fn(), purchaseCredits: jest.fn(),
  })
}

function settled(items: ContentItem[] = [], extra: Partial<RequestState> = {}): RequestState {
  return { data: { content: items, count: items.length, assetsByContentId: {} }, isLoading: false, ...extra }
}

function expectSkeleton(view: "kanban" | "table") {
  const root = screen.getByTestId("content-views")
  expect(views.mock.calls.at(-1)?.[0].isLoading).toBe(true)
  expect(within(root).queryByText("No content")).not.toBeInTheDocument()
  if (view === "kanban") {
    const columns = root.querySelectorAll(".w-80")
    expect(columns).toHaveLength(5)
    columns.forEach(column => expect(column.querySelectorAll(".animate-pulse")).toHaveLength(20))
  } else {
    expect(within(root).getByRole("table").querySelectorAll("tbody tr")).toHaveLength(6)
    expect(root.querySelectorAll(".animate-pulse")).toHaveLength(40)
  }
}

function expectSettled() {
  expect(views.mock.calls.at(-1)?.[0].isLoading).toBe(false)
  expect(screen.getByTestId("content-views").querySelector(".animate-pulse")).toBeNull()
}

beforeEach(() => {
  jest.clearAllMocks()
  requests.clear()
  setSite(null, true)
  // Match SWR's disabled-key behavior: no data and isLoading=false, even while
  // SiteContext is resolving. Active content keys have separate per-site state.
  swr.mockImplementation(((key: [string, string] | null) => {
    if (!key) return { isLoading: false, isValidating: false, mutate }
    if (key[0] === "content") return { mutate, ...requests.get(key[1]) }
    return { data: [], isLoading: false, mutate }
  }) as typeof useSWR)
})

describe.each(["kanban", "table"] as const)("Content page %s loading", view => {
  function mount() {
    const rendered = render(<ContentPage />)
    if (view === "table") fireEvent.click(screen.getByRole("button", { name: "Table view" }))
    return rendered
  }

  it("keeps the original skeleton from unresolved site through request pending in every type tab", () => {
    const { rerender } = mount()
    expect(views.mock.calls[0][0].isLoading).toBe(true)
    expectSkeleton(view)
    expect(swr.mock.calls.every(([key]) => key === null)).toBe(true)

    // The site list can settle before a selection/redirect is ready.
    setSite(null)
    rerender(<ContentPage />)
    expectSkeleton(view)

    requests.set("site-one", { isLoading: true })
    setSite("site-one")
    rerender(<ContentPage />)
    expect(swr).toHaveBeenCalledWith(["content", "site-one"], expect.any(Function), {})
    for (const label of ["all", "blog", "video", "social", "ads"]) {
      fireEvent.click(screen.getByRole("tab", { name: `content.tabs.${label}` }))
      expectSkeleton(view)
    }

    requests.set("site-one", settled([content("Loaded article", "site-one")]))
    rerender(<ContentPage />)
    fireEvent.click(screen.getByRole("tab", { name: "content.tabs.all" }))
    expectSettled()
    expect(screen.getByText("Loaded article")).toBeInTheDocument()
  })

  it("shows confirmed empty content after the request settles instead of an endless skeleton", () => {
    requests.set("site-one", { isLoading: true })
    setSite("site-one")
    const { rerender } = mount()
    expectSkeleton(view)
    requests.set("site-one", settled())
    rerender(<ContentPage />)
    expectSettled()
    expect(screen.getAllByText("No content")).toHaveLength(view === "kanban" ? 5 : 1)
  })

  it("uses site loading even when SWR already has cached content", () => {
    requests.set("site-one", settled([content("Cached article", "site-one")]))
    setSite("site-one", true)
    const { rerender } = mount()
    expectSkeleton(view)
    setSite("site-one")
    rerender(<ContentPage />)
    expectSettled()
    expect(screen.getByText("Cached article")).toBeInTheDocument()
  })

  it("preserves cached revalidation and site-switch behavior", () => {
    requests.set("site-one", settled([content("Site one article", "site-one")]))
    setSite("site-one")
    const { rerender } = mount()
    expectSettled()

    requests.set("site-two", { isLoading: true })
    setSite("site-two")
    rerender(<ContentPage />)
    expectSkeleton(view)
    expect(screen.queryByText("Site one article")).not.toBeInTheDocument()

    requests.set("site-two", settled([content("Site two article", "site-two")]))
    rerender(<ContentPage />)
    expectSettled()
    expect(screen.getByText("Site two article")).toBeInTheDocument()

    requests.set("site-one", settled([content("Site one article", "site-one")], { isValidating: true }))
    setSite("site-one")
    rerender(<ContentPage />)
    expectSettled()
    expect(screen.getByText("Site one article")).toBeInTheDocument()
    expect(screen.queryByText("Site two article")).not.toBeInTheDocument()

    requests.set("site-two", settled([], { isValidating: true }))
    setSite("site-two")
    rerender(<ContentPage />)
    expectSettled()
    expect(screen.getAllByText("No content")).toHaveLength(view === "kanban" ? 5 : 1)
  })

  it("does not turn a settled request error into perpetual loading", () => {
    setSite("site-one")
    requests.set("site-one", { isLoading: false, error: new Error("Request failed") })
    mount()
    expectSettled()
  })
})