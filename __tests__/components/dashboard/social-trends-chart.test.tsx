import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SocialTrendsChart } from "@/app/components/dashboard/social-trends-chart"
import { SocialReports } from "@/app/components/dashboard/social-reports"
import { buildSocialTrends } from "@/app/components/dashboard/social-trends"
import { getSocialPerformanceData, getTopCommentersData } from "@/app/components/dashboard/social-actions"
import { performancePost, startDate, endDate } from "./social-fixtures"

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

  it("shows zero-valued measured posts, omits an absent comparison line, and discloses fallback dates", () => {
    const data = buildSocialTrends([performancePost({ views: 0, content: null })], startDate, endDate)
    const { container } = render(<SocialTrendsChart data={data} />)
    expect(screen.getByRole("img", { name: /Views by publication period/ })).toBeInTheDocument()
    expect(screen.getByText("No posts to compare")).toBeInTheDocument()
    expect(screen.getByText(/1 posts have no publication date/)).toBeInTheDocument()
    expect(container.querySelector(".recharts-line-curve")).not.toBeInTheDocument()
  })

  it("does not calculate infinite percentage growth against a zero baseline", () => {
    const data = trends()
    data.previous.views = 0
    render(<SocialTrendsChart data={data} />)
    expect(screen.getByText("No previous baseline")).toBeInTheDocument()
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
      data: [], networks: [], trends: trends(),
      kpis: { totalViews: 300, totalReach: 80, totalComments: 2, avgEngagementRate: 0.05, totalLikes: 10, totalShares: 1, postCount: 1 },
    })
    const { container } = render(<SocialReports startDate={startDate} endDate={endDate} />)
    const loadingChart = screen.getByLabelText("Social performance trends")
    expect(loadingChart.previousElementSibling).toHaveTextContent("Engagement Rate")
    expect(loadingChart.nextElementSibling).toHaveTextContent("By Network")
    await waitFor(() => expect(container.querySelector(".recharts-area-curve")).toBeInTheDocument())
    const chart = screen.getByLabelText("Social performance trends")
    expect(chart.previousElementSibling).toHaveTextContent("Views300")
    expect(chart.nextElementSibling).toHaveTextContent("Top Commenters")
    expect(getSocialPerformanceData).toHaveBeenCalledWith("site-1", startDate, endDate, Intl.DateTimeFormat().resolvedOptions().timeZone)
  })

  it("leaves the loading state when the request rejects", async () => {
    jest.mocked(getSocialPerformanceData).mockRejectedValue(new Error("Network error"))
    render(<SocialReports startDate={startDate} endDate={endDate} />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load performance trends")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
})