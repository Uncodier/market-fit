import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { useSearchParams } from "next/navigation"
import DashboardPage from "@/app/dashboard/page"

let mockSite = "site-one"
let mockSiteLoading = false
let mockMaxRangeDays = 93
const mockLimits: { isLoading: boolean; isValidating: boolean; signedOut: boolean; error?: Error; mutate: jest.Mock } = {
  isLoading: false, isValidating: false, signedOut: false, error: undefined, mutate: jest.fn(),
}
const mockContent = jest.fn()
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: mockSite }, isLoading: mockSiteLoading }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("@/app/hooks/use-prevent-refresh", () => ({ usePageRefreshPrevention: () => ({ shouldPreventRefresh: false }) }))
jest.mock("@/app/segments/actions", () => ({ getSegments: async () => ({ segments: [] }) }))
jest.mock("@/app/dashboard/use-report-date-limits", () => ({ useReportDateLimits: () => ({ ...mockLimits, maxRangeDays: mockMaxRangeDays }) }))
jest.mock("swr", () => ({
  __esModule: true,
  default: () => ({ data: [], isLoading: false }),
  SWRConfig: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock("@/app/dashboard/ReportContent", () => ({ ReportContent: (props: { report: string; section: string }) => {
  mockContent(props)
  return <div data-testid="report-content">{props.report}:{props.section}</div>
} }))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="sticky-header">{children}</div> }))
jest.mock("@/app/components/ui/mobile-filters-drawer", () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  return { MobileFiltersDrawer: Wrapper, FilterContainer: Wrapper, FilterSection: Wrapper }
})
jest.mock("@/app/components/ui/date-range-picker", () => ({ CalendarDateRangePicker: () => <button>Date range</button> }))

function renderPage(search: string) {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(search) as ReturnType<typeof useSearchParams>)
  const cache = new Map()
  const ui = () => <SWRConfig value={{ provider: () => cache }}><DashboardPage /></SWRConfig>
  const result = render(ui())
  return { ...result, navigate: (next: string) => {
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(next) as ReturnType<typeof useSearchParams>)
    result.rerender(ui())
  } }
}

beforeEach(() => {
  mockContent.mockClear(); mockSite = "site-one"; mockSiteLoading = false; mockMaxRangeDays = 93
  mockLimits.isLoading = false; mockLimits.isValidating = false; mockLimits.signedOut = false; mockLimits.error = undefined
  mockLimits.mutate.mockReset()
})

describe("sticky report navigation", () => {
  it("opens an analytics deep link without first mounting performance", () => {
    renderPage("tab=analytics&section=leads")
    expect(screen.getByRole("tablist", { name: "Analytics sections" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Lead cohorts" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tabpanel")).toHaveTextContent("analytics:leads")
    expect(mockContent.mock.calls.every(([props]) => props.report === "analytics")).toBe(true)
    expect(screen.queryByRole("tab", { name: "Performance" })).not.toBeInTheDocument()
  })

  it("changes only the section and responds to history navigation", () => {
    const push = jest.spyOn(window.history, "pushState").mockImplementation(() => {})
    const { navigate } = renderPage("tab=sales&section=summary&artifact=false")
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Categories" }), { button: 0, ctrlKey: false })
    expect(push).toHaveBeenCalledWith(null, "", "/dashboard?tab=sales&section=categories&artifact=false")
    navigate("tab=sales&section=categories")
    expect(screen.getByRole("tabpanel")).toHaveTextContent("sales:categories")
    navigate("tab=sales&section=summary")
    expect(screen.getByRole("tab", { name: "Summary" })).toHaveAttribute("aria-selected", "true")
    push.mockRestore()
  })

  it("connects the selected tab to its panel and supports keyboard focus", async () => {
    renderPage("tab=performance")
    const active = screen.getByRole("tab", { name: "Outcomes" })
    expect(screen.getByRole("tabpanel").id).toBe(active.getAttribute("aria-controls"))
    act(() => active.focus())
    fireEvent.keyDown(active, { key: "ArrowRight" })
    await waitFor(() => expect(screen.getByRole("tab", { name: "Operations" })).toHaveFocus())
  })

  it("resets an unsupported section on report change and keeps the date filter", () => {
    const { navigate } = renderPage("tab=performance&section=usage")
    navigate("tab=analytics&section=usage")
    expect(screen.getByRole("tab", { name: "Distribution" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("button", { name: "Date range" })).toBeInTheDocument()
  })

  it("does not offer a misleading segment filter for social data", () => {
    renderPage("tab=social")
    expect(screen.queryByRole("combobox", { name: "Segment" })).not.toBeInTheDocument()
    expect(screen.getByText(/All segments are included/)).toBeInTheDocument()
  })

  it("does not offer unsupported segment attribution for traffic", () => {
    renderPage("tab=traffic")
    expect(screen.queryByRole("combobox", { name: "Segment" })).not.toBeInTheDocument()
    expect(screen.getByText(/Session data covers all segments/)).toBeInTheDocument()
    expect(mockContent.mock.calls.at(-1)?.[0].segmentId).toBe("all")
  })

  it("does not mount data reports for a placeholder site", () => {
    mockSite = "default"
    renderPage("tab=traffic")
    expect(screen.getByText("Select a site to view reports.")).toBeInTheDocument()
    expect(mockContent).not.toHaveBeenCalled()
  })

  it("shows the report skeleton during site hydration instead of a premature empty/error state", () => {
    mockSite = "default"
    mockSiteLoading = true
    renderPage("tab=overview&section=economics")
    expect(screen.getByRole("status", { name: "Loading report" })).toBeInTheDocument()
    expect(screen.queryByText("Select a site to view reports.")).not.toBeInTheDocument()
    expect(mockContent).not.toHaveBeenCalled()
  })

  it("shows a single report title without repeating the section title or a second date badge", () => {
    renderPage("tab=overview&section=economics")
    expect(screen.getByRole("heading", { level: 1, name: "Business overview" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Unit economics" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Date range" })).toBeInTheDocument()
    expect(screen.getByRole("tabpanel").querySelector("header")).not.toHaveTextContent(/\d{4}/)
    expect(screen.getByRole("tabpanel").firstElementChild).toHaveClass("max-w-[1600px]", "mx-auto")
  })

  it("retains the standard segmented tab appearance instead of underline navigation", () => {
    renderPage("tab=sales")
    expect(screen.getByRole("tablist")).toHaveClass("bg-muted/50")
    expect(screen.getByRole("tab", { name: "Summary" })).not.toHaveClass("border-b-2", "rounded-none")
    expect(screen.getByRole("tab", { name: "Summary" })).toHaveClass("data-[state=active]:bg-background")
  })

  it("explains an unsupported range before mounting reports and only changes it on request", () => {
    mockMaxRangeDays = 7
    renderPage("tab=sales")
    expect(screen.getByRole("alert")).toHaveTextContent("up to 7 days")
    expect(mockContent).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Use last 7 days of this range" }))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(mockContent).toHaveBeenCalled()
  })

  it("keeps a date-options retry pending-first with the selected section skeleton, then shows a settled failure", () => {
    mockLimits.error = new Error("Date options unavailable")
    const { navigate } = renderPage("tab=sales&section=categories")
    expect(screen.getByRole("alert")).toHaveTextContent("Date options unavailable")
    fireEvent.click(screen.getByRole("button", { name: "Retry date options" }))
    expect(mockLimits.mutate).toHaveBeenCalledTimes(1)
    mockLimits.isValidating = true
    navigate("tab=sales&section=categories")
    const pending = screen.getByRole("status", { name: "Loading report" })
    expect(pending).toHaveAttribute("data-loading-section", "categories")
    expect(pending.querySelectorAll('[data-report-kpi]')).toHaveLength(0)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(mockContent).not.toHaveBeenCalled()
    mockLimits.isValidating = false
    navigate("tab=sales&section=categories")
    expect(screen.getByRole("alert")).toHaveTextContent("Date options unavailable")
    expect(screen.queryByRole("status", { name: "Loading report" })).not.toBeInTheDocument()
  })

  it("uses economics shape during site readiness and preserves signed-out handling after it settles", () => {
    mockSiteLoading = true
    const { navigate } = renderPage("tab=overview&section=economics")
    expect(screen.getByRole("status").querySelectorAll('[data-loading-panel="chart"]')).toHaveLength(2)
    mockSiteLoading = false
    mockLimits.signedOut = true
    navigate("tab=overview&section=economics")
    expect(screen.getByRole("status")).toHaveTextContent("Sign in to view reports.")
    expect(mockContent).not.toHaveBeenCalled()
  })
})