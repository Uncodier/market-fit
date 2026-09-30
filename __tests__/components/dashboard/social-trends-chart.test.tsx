import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SocialTrendsChart } from "@/app/components/dashboard/social-trends-chart"
import { SocialReports } from "@/app/components/dashboard/social-reports"
import { buildSocialTrends } from "@/app/components/dashboard/social-trends"
import { getSocialPerformanceData, getTopCommentersData } from "@/app/components/dashboard/social-actions"
import { performancePost, startDate, endDate } from "./social-fixtures"
import { endOfDay } from "date-fns"
import { socialReportFixture } from "./social-report-fixture"

jest.mock("@/app/context/ThemeContext", () => ({ useTheme: () => ({ isDarkMode: false }) }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-1" } }) }))
jest.mock("@/app/content/content-shared", () => ({ getNetworkIcon: () => null }))
jest.mock("@/app/components/dashboard/social-actions", () => ({
  getSocialPerformanceData: jest.fn(), getTopCommentersData: jest.fn(),
}))

// jsdom has no layout; keep the real Recharts rendering with a fixed viewport.
jest.mock("recharts", () => ({
  ...jest.requireActual("recharts"),
  ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
    React.cloneElement(children as React.ReactElement<{ width: number; height: number }>, { width: 900, height: 300 }),
}))

const trends = () => buildSocialTrends([
  performancePost({ views: 300 }),
  performancePost({ views: 100, engagement_rate: 0.04, content: { published_at: "2026-08-15T12:00:00" } }),
], startDate, endDate)

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn()
  Element.prototype.hasPointerCapture = jest.fn(() => false)
  Element.prototype.releasePointerCapture = jest.fn()
})

describe("SocialTrendsChart", () => {
  it("renders real current and previous-period chart paths, counts, and the data basis", () => {
    const { container } = render(<SocialTrendsChart data={trends()} />)
    expect(screen.getByRole("combobox", { name: "Trend metric" })).toHaveTextContent("Views")
    expect(screen.getByText("+200.0% vs. previous period")).toBeInTheDocument()
    expect(screen.getByText(/Latest accumulated metrics grouped by publication date/)).toBeInTheDocument()
    expect(screen.getByText(/Selected: Sep 1, 2026 – Sep 30, 2026 · 1 posts/)).toBeInTheDocument()
    expect(screen.getByText(/Previous: Aug 2, 2026 – Aug 31, 2026 · 1 posts/)).toBeInTheDocument()
    expect(container.querySelector(".recharts-area-curve")).toBeInTheDocument()
    expect(container.querySelector(".recharts-line-curve")).toHaveAttribute("stroke-dasharray", "5 5")
  })

  it("switches between engagement percentages and comment counts", async () => {
    render(<SocialTrendsChart data={trends()} />)
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Trend metric" }), { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("option", { name: "Engagement Rate" }))
    expect(screen.getByText("5.00%")).toBeInTheDocument()
    expect(screen.getByText("4.00%")).toBeInTheDocument()
    expect(screen.getByText("+1.00 pp vs. previous period")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: /Engagement Rate by publication period/ })).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole("combobox", { name: "Trend metric" }), { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("option", { name: "Comments" }))
    expect(screen.getByText("Selected period · Comments")).toBeInTheDocument()
    expect(screen.getByText("0.0% vs. previous period")).toBeInTheDocument()
  })

  it("keeps repeated selected dates in collapsed details when embedded without losing accessible comparison bounds", () => {
    render(<><button>Sep 1, 2026 – Sep 30, 2026</button><SocialTrendsChart data={trends()} showPeriod={false} /></>)
    const dates = screen.getAllByText(/Sep 1, 2026.*Sep 30, 2026/)
    expect(dates.filter(element => !element.closest("details"))).toHaveLength(1)
    expect(dates.find(element => element.closest("details"))).not.toBeVisible()
    expect(screen.getByRole("heading", { name: "Performance trends" })).toBeVisible()
    expect(screen.getByRole("img", { name: /Selected: Sep 1, 2026 – Sep 30, 2026/ })).toBeInTheDocument()
    expect(screen.getByText(/Selected period · 1 posts/)).toBeVisible()
    expect(screen.getByText(/Previous period · 1 posts/)).toBeVisible()
  })

  it("uses bounded responsive frames rather than nested empty-card minimum heights", () => {
    const { rerender } = render(<SocialTrendsChart isLoading />)
    expect(screen.getByRole("status", { name: "Loading performance trends" }).lastElementChild).toHaveClass("h-[300px]", "sm:h-[340px]")
    rerender(<SocialTrendsChart />)
    const title = screen.getByText("No post performance data")
    expect(title.closest(".min-h-0")).toBeInTheDocument()
    expect(title.closest(".h-\\[300px\\]")).toHaveClass("sm:h-[340px]")
    rerender(<SocialTrendsChart data={trends()} />)
    expect(screen.getByRole("img")).toHaveClass("h-[300px]", "sm:h-[340px]")
  })

  it("distinguishes loading, error, and genuinely empty data", () => {
    const { rerender } = render(<SocialTrendsChart isLoading />)
    expect(screen.getByRole("status", { name: "Loading performance trends" })).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toBeDisabled()
    rerender(<SocialTrendsChart error />)
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load performance trends")
    rerender(<SocialTrendsChart data={buildSocialTrends([], startDate, endDate)} />)
    expect(screen.getByText("No post performance data")).toBeInTheDocument()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("shows zero-valued measured posts and excludes missing publication dates", () => {
    const data = buildSocialTrends([performancePost({ views: 0 }), performancePost({ content: null })], startDate, endDate)
    const { container } = render(<SocialTrendsChart data={data} />)
    expect(screen.getByRole("img", { name: /Views by publication period/ })).toBeInTheDocument()
    expect(screen.getByText("No posts to compare")).toBeInTheDocument()
    expect(screen.getByText(/1 posts without a valid publication date were excluded/)).toBeInTheDocument()
    expect(container.querySelector(".recharts-line-curve")).not.toBeInTheDocument()
  })

  it("does not calculate infinite percentage growth against a zero baseline", () => {
    const data = trends()
    data.previous.views = 0
    render(<SocialTrendsChart data={data} />)
    expect(screen.getByText("No previous baseline")).toBeInTheDocument()
  })

  it("does not claim growth when either publication cohort has missing metrics", () => {
    const data = trends()
    data.current.missingMetricCounts = { views: 1, reach: 0, comments: 0, likes: 0, shares: 0, engagement_rate: 0 }
    render(<SocialTrendsChart data={data} />)
    expect(screen.getByText("Incomplete metric coverage; comparison unavailable")).toBeInTheDocument()
    expect(screen.getByText("—")).toBeInTheDocument()
    expect(screen.queryByText("+200.0% vs. previous period")).not.toBeInTheDocument()
  })

  it("does not date an undated post using its sync timestamp", () => {
    render(<SocialTrendsChart data={buildSocialTrends([performancePost({ content: null })], startDate, endDate)} />)
    expect(screen.getByText("No post performance data")).toBeInTheDocument()
    expect(screen.getByText(/posts without a valid publication date were excluded/)).toBeInTheDocument()
  })

  it("still renders a comparison when only the previous period has posts", () => {
    const data = buildSocialTrends([performancePost({ content: { published_at: "2026-08-15T12:00:00" } })], startDate, endDate)
    const { container } = render(<SocialTrendsChart data={data} />)
    expect(container.querySelector(".recharts-line-curve")).toBeInTheDocument()
    expect(screen.queryByText("No post performance data")).not.toBeInTheDocument()
  })
})

describe("SocialReports trend integration", () => {
  beforeEach(() => {
    jest.mocked(getTopCommentersData).mockResolvedValue({ data: [] })
  })

  it("places the chart directly after the KPIs and before the other reports", async () => {
    jest.mocked(getSocialPerformanceData).mockResolvedValue({
      ...socialReportFixture(),
      data: [], networks: [], trends: trends(),
      kpis: { totalViews: 300, totalReach: 80, totalComments: 2, avgEngagementRate: 0.05, totalLikes: 10, totalShares: 1, totalImpressions: 120, postCount: 1 },
    })
    const { container } = render(<SocialReports startDate={startDate} endDate={endDate} />)
    expect(screen.getByRole("status", { name: "Loading report" })).toHaveAttribute("aria-busy", "true")
    expect(screen.queryByLabelText("Social performance trends")).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    await waitFor(() => expect(container.querySelector(".recharts-area-curve")).toBeInTheDocument())
    const chart = screen.getByLabelText("Social performance trends")
    expect(chart.previousElementSibling).toHaveTextContent("Views300")
    expect(chart.nextElementSibling).toHaveTextContent("Top Commenters")
    expect(getSocialPerformanceData).toHaveBeenCalledWith("site-1", startDate, endOfDay(endDate), Intl.DateTimeFormat().resolvedOptions().timeZone)
  })

  it("leaves the loading state when the request rejects", async () => {
    jest.mocked(getSocialPerformanceData).mockRejectedValue(new Error("Network error"))
    render(<SocialReports startDate={startDate} endDate={endDate} />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load performance trends")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
})