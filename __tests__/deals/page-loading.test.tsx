import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SWRConfig, useSWRConfig } from "swr"
import DealsPage from "@/app/deals/page"
import { getDeals } from "@/app/deals/actions"
import { useSite } from "@/app/context/SiteContext"
import { Deal } from "@/app/deals/types"

jest.mock("@/app/deals/actions", () => ({ getDeals: jest.fn(), updateDeal: jest.fn() }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: () => "" }),
}))
jest.mock("@/app/hooks/use-mobile-view", () => ({
  useMobileView: () => React.useState("kanban"),
}))
jest.mock("@/lib/navigation/navigation-helpers", () => ({ navigateToDeal: jest.fn() }))
jest.mock("@/app/deals/components/DealsKanban", () => ({
  DealsKanban: ({ deals }: { deals: Deal[] }) => <div>{deals.map(deal => <p key={deal.id}>{deal.name}</p>)}</div>,
  DealsKanbanSkeleton: () => <div data-testid="kanban-skeleton" />,
}))
jest.mock("@/app/deals/components/DealsTable", () => ({
  DealsTable: ({ deals }: { deals: Deal[] }) => <div>{deals.map(deal => <p key={deal.id}>{deal.name}</p>)}</div>,
}))
jest.mock("@/app/components/ui/sticky-header", () => ({
  StickyHeader: ({ children }: React.PropsWithChildren) => <header>{children}</header>,
}))
jest.mock("@/app/components/ui/mobile-filters-drawer", () => ({
  MobileFiltersDrawer: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  FilterContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  FilterSection: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  FilterSeparator: () => null,
}))
jest.mock("@/app/components/ui/sort-dropdown", () => ({ SortDropdown: () => null }))
jest.mock("@/app/components/view-selector", () => ({
  ViewSelector: ({ onViewChange }: { onViewChange: (view: string) => void }) => (
    <button onClick={() => onViewChange("table")}>Table view</button>
  ),
}))

const siteA = { id: "site-a" } as NonNullable<ReturnType<typeof useSite>["currentSite"]>
const siteB = { id: "site-b" } as typeof siteA
const deal = { id: "deal-a", name: "Existing deal", status: "open" } as Deal
type Result = Awaited<ReturnType<typeof getDeals>>

function deferred() {
  let resolve!: (value: Result) => void
  const promise = new Promise<Result>(done => { resolve = done })
  return { promise, resolve }
}

let siteState: ReturnType<typeof useSite>
let revalidate: () => Promise<unknown>

function RefreshControl() {
  const { mutate } = useSWRConfig()
  React.useEffect(() => {
    revalidate = () => mutate(["deals", siteState.currentSite?.id])
  }, [mutate])
  return null
}

function setup() {
  const config = { provider: () => new Map(), shouldRetryOnError: false, dedupingInterval: 0 }
  const Page = () => (
    <SWRConfig value={config}>
      <RefreshControl />
      <DealsPage />
    </SWRConfig>
  )
  const view = render(<Page />)
  return { ...view, refresh: () => view.rerender(<Page />) }
}

beforeEach(() => {
  jest.clearAllMocks()
  siteState = {
    currentSite: siteA, isLoading: false, error: null, refreshSites: jest.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof useSite>
  jest.mocked(useSite).mockImplementation(() => siteState)
})

it("waits for the site and the first fetch before showing a successful empty result", async () => {
  const request = deferred()
  jest.mocked(getDeals).mockReturnValue(request.promise)
  siteState.currentSite = null
  siteState.isLoading = true
  const view = setup()
  expect(screen.getByRole("status")).toBeInTheDocument()
  expect(screen.queryByText("No deals found")).not.toBeInTheDocument()
  expect(getDeals).not.toHaveBeenCalled()

  siteState.currentSite = siteA
  siteState.isLoading = false
  view.refresh()
  await waitFor(() => expect(getDeals).toHaveBeenCalledWith("site-a"))
  expect(screen.getByTestId("kanban-skeleton")).toBeInTheDocument()
  expect(screen.queryByText("No deals found")).not.toBeInTheDocument()

  await act(async () => request.resolve({ deals: [], error: null }))
  expect(await screen.findByText("No deals found")).toBeInTheDocument()
})

it.each([false, true])("does not claim an empty collection without a site (site error: %s)", async failed => {
  siteState.currentSite = null
  siteState.error = failed ? new Error("Private site details") : null
  setup()
  expect(screen.getByText(failed ? "Unable to load your site. Please try again." : "Select a site to view deals.")).toBeInTheDocument()
  expect(screen.queryByText("No deals found")).not.toBeInTheDocument()
  expect(getDeals).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  await waitFor(() => expect(siteState.refreshSites).toHaveBeenCalledTimes(1))
})

it.each([401, 403, 500])("shows a safe error and retries a failed first request (%s)", async status => {
  jest.mocked(getDeals).mockResolvedValueOnce({ deals: null, error: "Private database details", status, code: "42501" })
  const retry = deferred()
  jest.mocked(getDeals).mockReturnValueOnce(retry.promise)
  setup()
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load deals")
  expect(screen.queryByText("No deals found")).not.toBeInTheDocument()
  expect(screen.queryByText("Private database details")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  await waitFor(() => expect(getDeals).toHaveBeenCalledTimes(2))
  expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled()
  expect(screen.queryByText("No deals found")).not.toBeInTheDocument()
  await act(async () => retry.resolve({ deals: [deal], error: null }))
  expect(await screen.findByText("Existing deal")).toBeInTheDocument()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

it.each(["kanban", "table"])("keeps %s data visible during background refresh and failure", async viewType => {
  jest.mocked(getDeals).mockResolvedValueOnce({ deals: [deal], error: null })
  setup()
  if (viewType === "table") fireEvent.click(screen.getByRole("button", { name: "Table view" }))
  expect(await screen.findByText("Existing deal")).toBeInTheDocument()
  const request = deferred()
  jest.mocked(getDeals).mockReturnValueOnce(request.promise)
  let refresh!: Promise<unknown>
  act(() => { refresh = revalidate() })
  expect(screen.getByText("Existing deal")).toBeInTheDocument()
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
  await act(async () => {
    request.resolve({ deals: null, error: "Network failed" })
    await refresh
  })
  expect(screen.getByText("Existing deal")).toBeInTheDocument()
  expect(screen.getByRole("alert")).toBeInTheDocument()
  expect(screen.queryByText("No deals found")).not.toBeInTheDocument()
})

it("does not retain another site's deals while switching sites", async () => {
  jest.mocked(getDeals).mockResolvedValueOnce({ deals: [deal], error: null })
  const view = setup()
  expect(await screen.findByText("Existing deal")).toBeInTheDocument()
  const request = deferred()
  jest.mocked(getDeals).mockReturnValueOnce(request.promise)
  siteState.currentSite = siteB
  view.refresh()
  expect(screen.queryByText("Existing deal")).not.toBeInTheDocument()
  expect(screen.queryByText("No deals found")).not.toBeInTheDocument()
  expect(screen.getByRole("status")).toBeInTheDocument()
  await act(async () => request.resolve({ deals: [], error: null }))
  expect(await screen.findByText("No deals found")).toBeInTheDocument()
})

it("rejects an absent payload instead of treating it as a successful empty result", async () => {
  jest.mocked(getDeals).mockResolvedValue({ deals: null, error: null })
  setup()
  expect(await screen.findByRole("alert")).toBeInTheDocument()
  expect(screen.queryByText("No deals found")).not.toBeInTheDocument()
})

it("retains deals while the current site's context refreshes", async () => {
  jest.mocked(getDeals).mockResolvedValue({ deals: [deal], error: null })
  const view = setup()
  expect(await screen.findByText("Existing deal")).toBeInTheDocument()
  siteState.isLoading = true
  view.refresh()
  expect(screen.getByText("Existing deal")).toBeInTheDocument()
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
})

it("handles thrown network errors without showing empty", async () => {
  jest.mocked(getDeals).mockRejectedValueOnce(new Error("Network failed"))
  setup()
  expect(await screen.findByRole("alert")).toBeInTheDocument()
  expect(screen.queryByText("No deals found")).not.toBeInTheDocument()
})

it("does not show cached empty results after a failed refresh", async () => {
  jest.mocked(getDeals).mockResolvedValueOnce({ deals: [], error: null })
  setup()
  expect(await screen.findByText("No deals found")).toBeInTheDocument()
  jest.mocked(getDeals).mockResolvedValueOnce({ deals: null, error: "Network failed" })
  await act(async () => { await revalidate() })
  expect(screen.getByRole("alert")).toBeInTheDocument()
  expect(screen.queryByText("No deals found")).not.toBeInTheDocument()
})