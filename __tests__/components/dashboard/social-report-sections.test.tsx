import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SWRConfig, type Middleware } from "swr"
import { SocialReports } from "@/app/components/dashboard/social-reports"
import { getSocialPerformanceData, getTopCommentersData } from "@/app/components/dashboard/social-actions"
import { startDate, endDate } from "./social-fixtures"
import { AuthContext, type AuthContextValue } from "@/app/components/auth/auth-context"
import { socialReportFixture } from "./social-report-fixture"

let mockSiteId = "site-1"
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: mockSiteId } }) }))
jest.mock("@/app/content/content-shared", () => ({ getNetworkIcon: () => null }))
jest.mock("@/app/components/dashboard/social-actions", () => ({
  getSocialPerformanceData: jest.fn(), getTopCommentersData: jest.fn(),
}))
jest.mock("@/app/components/dashboard/social-trends-chart", () => ({
  SocialTrendsChart: ({ isLoading }: { isLoading: boolean }) => <div aria-label="Social performance trends">{isLoading ? "Loading trends" : "Loaded trends"}</div>,
}))

const maskErrors: Middleware = (next) => (key, fetcher, config) => ({ ...next(key, fetcher, config), error: undefined })
const parentConfig = { keepPreviousData: true, use: [maskErrors] }
const performance = () => {
  return socialReportFixture(321)
}
const report = (section?: "summary" | "networks" | "posts", start = startDate) => (
  <SWRConfig value={parentConfig}><SocialReports startDate={start} endDate={endDate} section={section} /></SWRConfig>
)

beforeEach(() => {
  jest.resetAllMocks()
  mockSiteId = "site-1"
  jest.mocked(getSocialPerformanceData).mockResolvedValue(performance())
  jest.mocked(getTopCommentersData).mockResolvedValue({ data: [{ id: "ada", name: "Ada Reader", avatar: null, count: 2 }] })
})

it.each(["summary", "networks", "posts", undefined] as const)("renders only the %s section and fetches only required sources", async (section) => {
  render(report(section))
  await waitFor(() => expect(getSocialPerformanceData).toHaveBeenCalledTimes(1))
  if (section === undefined || section === "summary") {
    expect(await screen.findByText("321")).toBeInTheDocument()
    expect(screen.getByLabelText("Social performance trends")).toBeInTheDocument()
    expect(screen.queryByText("By Network")).not.toBeInTheDocument()
    expect(screen.queryByText("Top Posts")).not.toBeInTheDocument()
  } else if (section === "networks") {
    expect(await screen.findByText("Ada Reader")).toBeInTheDocument()
    expect(screen.getByText("By Network")).toBeInTheDocument()
    expect(screen.queryByText("Top Posts")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Social performance trends")).not.toBeInTheDocument()
  } else {
    expect(await screen.findByText("Example post")).toBeInTheDocument()
    expect(screen.queryByText("By Network")).not.toBeInTheDocument()
    expect(screen.queryByText("Top Commenters")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Social performance trends")).not.toBeInTheDocument()
  }
  expect(getTopCommentersData).toHaveBeenCalledTimes(section === "networks" ? 1 : 0)
})

it("reuses performance across sections and equal date objects, and commenters when revisiting networks", async () => {
  const { rerender } = render(report("summary"))
  expect(await screen.findByText("321")).toBeInTheDocument()
  rerender(report("networks", new Date(startDate)))
  expect(await screen.findByText("Ada Reader")).toBeInTheDocument()
  rerender(report("posts"))
  expect(await screen.findByText("Example post")).toBeInTheDocument()
  rerender(report("networks"))
  expect(await screen.findByText("Ada Reader")).toBeInTheDocument()
  expect(getSocialPerformanceData).toHaveBeenCalledTimes(1)
  expect(getTopCommentersData).toHaveBeenCalledTimes(1)
})

it.each(["returned", "rejected"])("shows a retryable %s error without fake metrics or empty states", async (failure) => {
  if (failure === "returned") jest.mocked(getSocialPerformanceData).mockResolvedValueOnce({ error: "Private detail" })
  else jest.mocked(getSocialPerformanceData).mockRejectedValueOnce(new Error("Private detail"))
  render(report("summary"))
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load performance trends")
  expect(screen.queryByText("Private detail")).not.toBeInTheDocument()
  expect(screen.queryByText("0")).not.toBeInTheDocument()
  expect(screen.queryByText("No posts found")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Retry social performance" }))
  expect(await screen.findByText("321")).toBeInTheDocument()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(getSocialPerformanceData).toHaveBeenCalledTimes(2)
})

it("shows network metrics while commenters are pending, and retries commenters independently", async () => {
  let reject!: (error: Error) => void
  jest.mocked(getTopCommentersData).mockReturnValueOnce(new Promise((_, fail) => { reject = fail }))
  render(report("networks"))
  await screen.findByText("instagram")
  expect(screen.getByRole("status", { name: "Loading top commenters" })).toBeInTheDocument()
  expect(screen.queryByLabelText("Social performance trends")).not.toBeInTheDocument()
  expect(screen.queryByText("Example post")).not.toBeInTheDocument()
  await act(async () => reject(new Error("Request failed")))
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to load top commenters")
  fireEvent.click(screen.getByRole("button", { name: "Retry top commenters" }))
  expect(await screen.findByText("Ada Reader")).toBeInTheDocument()
  expect(getSocialPerformanceData).toHaveBeenCalledTimes(1)
  expect(getTopCommentersData).toHaveBeenCalledTimes(2)
})

it.each(["site", "dates"])("does not retain previous data while a new %s scope loads or fails", async (scope) => {
  const { rerender } = render(report("posts"))
  expect(await screen.findByText("Example post")).toBeInTheDocument()
  let reject!: (error: Error) => void
  jest.mocked(getSocialPerformanceData).mockReturnValueOnce(new Promise((_, fail) => { reject = fail }))
  if (scope === "site") mockSiteId = "site-2"
  rerender(report("posts", scope === "dates" ? new Date("2026-09-02T00:00:00") : startDate))
  expect(screen.queryByText("Example post")).not.toBeInTheDocument()
  await act(async () => reject(new Error("Failed for new scope")))
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to load social performance")
  expect(screen.queryByText("Example post")).not.toBeInTheDocument()
  expect(screen.queryByText("No posts found")).not.toBeInTheDocument()
  expect(getSocialPerformanceData).toHaveBeenCalledTimes(2)
})

it("ignores late performance data from the previous scope", async () => {
  let resolve!: (value: ReturnType<typeof performance>) => void
  jest.mocked(getSocialPerformanceData).mockReturnValueOnce(new Promise((done) => { resolve = done }))
  const { rerender } = render(report("summary"))
  const next = performance()
  next.kpis.totalViews = 654
  jest.mocked(getSocialPerformanceData).mockResolvedValueOnce(next)
  rerender(report("summary", new Date("2026-09-02T00:00:00")))
  expect(await screen.findByText("654")).toBeInTheDocument()
  await act(async () => resolve(performance()))
  expect(screen.queryByText("321")).not.toBeInTheDocument()
  expect(screen.getByText("654")).toBeInTheDocument()
})

it("does not fetch for an invalid date range or missing site", async () => {
  const { rerender } = render(report("summary", new Date("invalid")))
  expect(screen.getByRole("alert")).toHaveTextContent("Select a valid date range")
  mockSiteId = "default"
  rerender(report("networks"))
  expect(screen.getByText("Select a site to view social reports.")).toBeInTheDocument()
  expect(getSocialPerformanceData).not.toHaveBeenCalled()
  expect(getTopCommentersData).not.toHaveBeenCalled()
})

it("accepts a missing engagement rate without converting it into zero or an error", async () => {
  const data = performance()
  jest.mocked(getSocialPerformanceData).mockResolvedValue({ ...data, kpis: { ...data.kpis, avgEngagementRate: null } })
  render(report("summary"))
  expect(await screen.findByText("321")).toBeInTheDocument()
  expect(screen.getByText("—")).toBeInTheDocument()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

it("deduplicates requests with different timestamps on the same reporting day", async () => {
  const { rerender } = render(report("summary"))
  expect(await screen.findByText("321")).toBeInTheDocument()
  const laterStart = new Date(startDate)
  laterStart.setHours(15, 0, 0, 0)
  rerender(report("summary", laterStart))
  expect(getSocialPerformanceData).toHaveBeenCalledTimes(1)
})

it("waits for authentication and drops cached metrics when the account changes", async () => {
  const auth = (id: string | null, loading = false) => ({ user: id ? { id } : null, isLoading: loading } as AuthContextValue)
  const view = (id: string | null, loading = false) => <AuthContext.Provider value={auth(id, loading)}>{report("summary")}</AuthContext.Provider>
  const { rerender } = render(view(null, true))
  expect(screen.getByRole("status", { name: "Loading report" })).toHaveAttribute("aria-busy", "true")
  expect(getSocialPerformanceData).not.toHaveBeenCalled()
  rerender(view("user-1"))
  expect(await screen.findByText("321")).toBeInTheDocument()
  jest.mocked(getSocialPerformanceData).mockImplementationOnce(() => new Promise(() => {}))
  rerender(view("user-2"))
  expect(screen.queryByText("321")).not.toBeInTheDocument()
  await waitFor(() => expect(getSocialPerformanceData).toHaveBeenCalledTimes(2))
  rerender(view(null))
  expect(screen.getByRole("alert")).toHaveTextContent("Sign in to view social reports")
  expect(screen.queryByText("321")).not.toBeInTheDocument()
})

it("keeps each section's layout separate with source diagnostics below its content", async () => {
  const { rerender } = render(report("summary"))
  await screen.findByText("Loaded trends")
  const trend = screen.getByLabelText("Social performance trends")
  expect(trend.compareDocumentPosition(screen.getByLabelText("Social data coverage")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.queryByText("By Network")).not.toBeInTheDocument()
  expect(screen.queryByText("Top Posts")).not.toBeInTheDocument()
  rerender(report("networks"))
  await screen.findByText("Ada Reader")
  const networks = screen.getByText("By Network").closest(".rounded-lg")!
  expect(networks.parentElement).toHaveClass("xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]")
  expect(networks.parentElement).toHaveClass("items-stretch", "xl:grid-rows-[auto_1fr]", "xl:[&>*]:grid-rows-subgrid")
  expect(networks).toHaveClass("h-full", "flex", "flex-col")
  expect(screen.getByText("Top Commenters").closest("[data-report-panel]")).toHaveClass("h-full", "flex", "flex-col")
  expect(screen.queryByLabelText("Social performance trends")).not.toBeInTheDocument()
  rerender(report("posts"))
  await screen.findByText("Example post")
  const posts = screen.getByText("Top Posts")
  const coverage = screen.getByLabelText("Social data coverage")
  expect(screen.queryByText("By Network")).not.toBeInTheDocument()
  expect(posts.compareDocumentPosition(coverage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(coverage.querySelector("details")).not.toHaveAttribute("open")
  expect(screen.getByText(/Newest stored sync/)).not.toBeVisible()
})

it.each(["summary", "networks", "posts"] as const)("keeps one page title and date control in embedded social %s", async section => {
  render(<><h1>Social</h1><button>Sep 1, 2026 – Sep 30, 2026</button>
    <SocialReports startDate={startDate} endDate={endDate} section={section} embedded /></>)
  await waitFor(() => expect(screen.queryByRole("status", { name: "Loading report" })).not.toBeInTheDocument())
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  expect(screen.queryByRole("heading", { name: /^Social (summary|networks|posts)$/i })).not.toBeInTheDocument()
  expect(screen.getAllByText(/Sep 1, 2026.*Sep 30, 2026/)).toHaveLength(1)
  if (section === "networks") expect(screen.getByRole("heading", { name: "By Network" })).toBeVisible()
  if (section === "posts") expect(screen.getByRole("heading", { name: "Top Posts" })).toBeVisible()
})

it("preserves missing versus reported-zero social values in KPI and network summaries", async () => {
  const data = performance()
  data.kpis.totalViews = 0
  data.kpis.totalComments = 0
  data.metadata.missingMetricCounts.views = data.metadata.postCount
  data.metadata.missingMetricCounts.comments = 0
  data.networks[0].views = 0
  data.networks[0].comments = 0
  data.networks[0].coverage.missingMetricCounts.views = data.networks[0].coverage.accountRowCount
  data.networks[0].coverage.missingMetricCounts.comments = 0
  jest.mocked(getSocialPerformanceData).mockResolvedValueOnce(data)
  const { rerender } = render(report("summary"))
  await screen.findByText("Loaded trends")
  const kpis = screen.getByLabelText("Social performance trends").previousElementSibling!
  expect(kpis).toHaveTextContent("Views—")
  expect(kpis).toHaveTextContent("Comments0")
  rerender(report("networks"))
  await screen.findByText("instagram")
  const network = screen.getByText("instagram").parentElement!.parentElement!
  expect(network).toHaveTextContent("views—")
  expect(network).toHaveTextContent("comments0")
})

it("masks the previous performance error throughout a deferred retry", async () => {
  jest.mocked(getSocialPerformanceData).mockRejectedValueOnce(new Error("Failed"))
  render(report("summary"))
  await screen.findByRole("alert")
  let resolve!: (data: ReturnType<typeof performance>) => void
  jest.mocked(getSocialPerformanceData).mockImplementationOnce(() => new Promise(done => { resolve = done }))
  fireEvent.click(screen.getByRole("button", { name: "Retry social performance" }))
  expect(await screen.findByRole("status", { name: "Loading report" })).toBeInTheDocument()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(screen.queryByText("No posts found")).not.toBeInTheDocument()
  await act(async () => resolve(performance()))
  expect(await screen.findByText("321")).toBeInTheDocument()
})

it("masks a commenter error while its retry runs without hiding network data", async () => {
  jest.mocked(getTopCommentersData).mockRejectedValueOnce(new Error("Failed"))
  render(report("networks"))
  await screen.findByRole("alert")
  let resolve!: (data: { data: [] }) => void
  jest.mocked(getTopCommentersData).mockImplementationOnce(() => new Promise(done => { resolve = done }))
  fireEvent.click(screen.getByRole("button", { name: "Retry top commenters" }))
  expect(await screen.findByRole("status", { name: "Loading top commenters" })).toBeInTheDocument()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(screen.getByText("instagram")).toBeInTheDocument()
  await act(async () => resolve({ data: [] }))
  expect(await screen.findByText("Comment authors not synchronized")).toBeInTheDocument()
})