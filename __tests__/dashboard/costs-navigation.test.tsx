import { fireEvent, render, screen, within } from "@testing-library/react"
import { usePathname, useSearchParams } from "next/navigation"
import CostsPage from "@/app/costs/page"
import { NAVIGATION_AREAS, buildNavItemHref, isNavItemActive } from "@/app/config/navigation-areas"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-a" } }) }))
jest.mock("@/app/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "user-one" }, isLoading: false }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("@/app/segments/actions", () => ({ getSegments: jest.fn() }))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("swr", () => ({
  __esModule: true,
  default: () => ({ data: [], isLoading: false }),
  SWRConfig: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="sticky-header">{children}</div> }))
jest.mock("@/app/components/ui/mobile-filters-drawer", () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  return { MobileFiltersDrawer: Wrapper, FilterContainer: Wrapper, FilterSection: Wrapper }
})
jest.mock("@/app/components/ui/date-range-picker", () => ({ CalendarDateRangePicker: () => <button>Date range</button> }))
jest.mock("@/app/components/dashboard/cost-reports", () => ({
  CostReports: ({ section, embedded, campaignId }: { section: string; embedded: boolean; campaignId: string }) => (
    <div data-testid="cost-report" data-section={section} data-embedded={embedded} data-campaign={campaignId} />
  ),
}))

function select(search = "") {
  jest.mocked(usePathname).mockReturnValue("/costs")
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(search) as ReturnType<typeof useSearchParams>)
}

afterEach(() => jest.restoreAllMocks())

it.each([undefined, "summary", "categories", "audience"])("opens Costs/%s in exactly one matching section", section => {
  select(section ? `section=${section}` : "")
  const { container } = render(<CostsPage />)
  const expected = section === "categories" ? "categories" : "summary"
  expect(screen.getByRole("tablist", { name: "Costs sections" })).toBeInTheDocument()
  expect(screen.getByRole("tab", { name: expected === "categories" ? "Categories" : "Summary" })).toHaveAttribute("aria-selected", "true")
  expect(screen.getAllByTestId("cost-report")).toHaveLength(1)
  expect(screen.getByTestId("cost-report")).toHaveAttribute("data-section", expected)
  expect(screen.getByTestId("cost-report")).toHaveAttribute("data-embedded", "true")
  expect(screen.getAllByRole("heading")).toHaveLength(1)
  expect(screen.getByRole("heading", { level: 1, name: "Costs" })).toBeInTheDocument()
  expect(container.querySelector("[data-report-viewport]")).toHaveClass("max-w-[1600px]", "mx-auto")
  const exportButton = within(screen.getByTestId("sticky-header")).getByRole("button", { name: "Export current section (CSV)" })
  expect(screen.getAllByRole("button", { name: "Export current section (CSV)" })).toHaveLength(1)
  expect(exportButton.parentElement).toHaveClass("flex", "md:flex-row", "md:items-center")
  expect(exportButton.nextElementSibling).toBe(screen.getByRole("button", { name: "Date range" }))
})

it("preserves cost filter parameters when switching sections and responds to history changes", () => {
  select("campaignId=campaign-a&segmentId=segment-a&artifact=true")
  const push = jest.spyOn(window.history, "pushState").mockImplementation(() => {})
  const { rerender } = render(<CostsPage />)
  expect(screen.getByTestId("cost-report")).toHaveAttribute("data-campaign", "campaign-a")
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Categories" }), { button: 0, ctrlKey: false })
  expect(push).toHaveBeenCalledWith(null, "", "/costs?campaignId=campaign-a&segmentId=segment-a&artifact=true&section=categories")
  select("section=categories")
  rerender(<CostsPage />)
  expect(screen.getByTestId("cost-report")).toHaveAttribute("data-section", "categories")
  expect(screen.getByTestId("cost-report")).toHaveAttribute("data-campaign", "campaign-a")
  select("section=summary")
  rerender(<CostsPage />)
  expect(screen.getByTestId("cost-report")).toHaveAttribute("data-section", "summary")
  expect(screen.getByRole("button", { name: "Date range" })).toBeInTheDocument()
})

it("keeps the dedicated Costs entry and recognizes dashboard cost deep links", () => {
  const item = NAVIGATION_AREAS.reports.items.find(item => item.key === "reportCosts")!
  expect(buildNavItemHref(item)).toBe("/costs")
  expect(isNavItemActive(item, "/costs", new URLSearchParams("section=categories"))).toBe(true)
  expect(isNavItemActive(item, "/dashboard", new URLSearchParams("tab=costs&section=categories"))).toBe(true)
  expect(isNavItemActive(item, "/dashboard", new URLSearchParams("tab=traffic"))).toBe(false)
})