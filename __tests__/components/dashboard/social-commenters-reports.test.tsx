import React from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { SocialReports } from "@/app/components/dashboard/social-reports"
import { getSocialPerformanceData, getTopCommentersData } from "@/app/components/dashboard/social-actions"
import { buildSocialTrends } from "@/app/components/dashboard/social-trends"
import { performancePost, startDate, endDate } from "./social-fixtures"

jest.mock("@/app/context/ThemeContext", () => ({ useTheme: () => ({ isDarkMode: false }) }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-1" } }) }))
jest.mock("@/app/content/content-shared", () => ({ getNetworkIcon: () => null }))
jest.mock("@/app/components/dashboard/social-actions", () => ({
  getSocialPerformanceData: jest.fn(), getTopCommentersData: jest.fn(),
}))
jest.mock("recharts", () => ({
  ...jest.requireActual("recharts"),
  ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
    React.cloneElement(children as React.ReactElement<{ width: number; height: number }>, { width: 900, height: 300 }),
}))

function performance(totalComments = 2) {
  const post = performancePost({ comments: totalComments, views: 300 })
  return {
    data: [post], networks: [{ network: "instagram", views: 300, likes: 10, comments: totalComments, reach: 80 }],
    trends: buildSocialTrends([post], startDate, endDate),
    kpis: { totalViews: 300, totalReach: 80, totalComments, avgEngagementRate: 0.05, totalLikes: 10, totalShares: 1, postCount: 1 },
  }
}

beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(getSocialPerformanceData).mockResolvedValue(performance())
  jest.mocked(getTopCommentersData).mockResolvedValue({ data: [] })
})

describe("SocialReports commenters", () => {
  it("shows missing synchronized authors rather than claiming there are no comments", async () => {
    render(<SocialReports startDate={startDate} endDate={endDate} />)
    expect(await screen.findByText("Comment authors not synchronized")).toBeInTheDocument()
    expect(screen.getByText(/Post metrics report comments, but no synchronized comment authors/)).toBeInTheDocument()
    expect(screen.queryByText("No commenters found")).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("shows the genuinely empty state when both comments and commenters are empty", async () => {
    jest.mocked(getSocialPerformanceData).mockResolvedValue(performance(0))
    render(<SocialReports startDate={startDate} endDate={endDate} />)
    expect(await screen.findByText("No commenters found")).toBeInTheDocument()
    expect(screen.queryByText("Comment authors not synchronized")).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("renders available commenters even when aggregate comments are zero", async () => {
    jest.mocked(getSocialPerformanceData).mockResolvedValue(performance(0))
    jest.mocked(getTopCommentersData).mockResolvedValue({ data: [
      { id: "author:instagram:123", name: "Ada Reader", avatar: null, count: 3 },
    ] })
    render(<SocialReports startDate={startDate} endDate={endDate} />)
    expect(await screen.findByText("Ada Reader")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.queryByText("No commenters found")).not.toBeInTheDocument()
    expect(getTopCommentersData).toHaveBeenCalledWith("site-1", startDate, endDate, Intl.DateTimeFormat().resolvedOptions().timeZone)
  })

  it.each(["returned", "rejected"])("keeps KPIs, trends, networks and posts on a %s commenter error", async (failure) => {
    if (failure === "returned") {
      jest.mocked(getTopCommentersData).mockResolvedValue({ error: "Private database detail", data: [] })
    } else {
      jest.mocked(getTopCommentersData).mockRejectedValue(new Error("Private database detail"))
    }
    const { container } = render(<SocialReports startDate={startDate} endDate={endDate} />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load top commenters")
    expect(screen.queryByText(/Private database detail/)).not.toBeInTheDocument()
    expect(screen.queryByText("No commenters found")).not.toBeInTheDocument()
    expect(screen.queryByText("Comment authors not synchronized")).not.toBeInTheDocument()
    const chart = screen.getByLabelText("Social performance trends")
    expect(chart.previousElementSibling).toHaveTextContent("Views300")
    expect(chart.previousElementSibling).toHaveTextContent("Comments2")
    expect(container.querySelector(".recharts-area-curve")).toBeInTheDocument()
    expect(screen.getByText("instagram")).toBeInTheDocument()
    expect(screen.getByText("Example post")).toBeInTheDocument()
  })

  it("keeps commenters when only performance rejects", async () => {
    jest.mocked(getSocialPerformanceData).mockRejectedValue(new Error("Network unavailable"))
    jest.mocked(getTopCommentersData).mockResolvedValue({ data: [
      { id: "author:instagram:123", name: "Ada", avatar: null, count: 1 },
    ] })
    render(<SocialReports startDate={startDate} endDate={endDate} />)
    expect(await screen.findByText("Ada")).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load performance trends")
    expect(screen.queryByText("Unable to load top commenters")).not.toBeInTheDocument()
  })

  it("clears a commenter error when a new date range loads successfully", async () => {
    jest.mocked(getTopCommentersData).mockRejectedValueOnce(new Error("Network unavailable"))
    const { rerender } = render(<SocialReports startDate={startDate} endDate={endDate} />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load top commenters")
    rerender(<SocialReports startDate={new Date("2026-09-02T00:00:00")} endDate={endDate} />)
    expect(await screen.findByText("Comment authors not synchronized")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("ignores a late rejection from the previous date range", async () => {
    let rejectPrevious!: (reason: Error) => void
    jest.mocked(getTopCommentersData).mockReturnValueOnce(new Promise((_, reject) => { rejectPrevious = reject }))
    const { rerender } = render(<SocialReports startDate={startDate} endDate={endDate} />)
    rerender(<SocialReports startDate={new Date("2026-09-02T00:00:00")} endDate={endDate} />)
    await waitFor(() => expect(screen.getByText("Comment authors not synchronized")).toBeInTheDocument())
    await act(async () => { rejectPrevious(new Error("Stale request")) })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})