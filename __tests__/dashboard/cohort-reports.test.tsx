import React from "react"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { SWRConfig } from "swr"
import { CohortTables } from "@/app/components/dashboard/cohort-tables"
import { LeadsCohortTables } from "@/app/components/dashboard/leads-cohort-tables"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"

jest.mock("@/app/context/SiteContext", () => ({ useSite: jest.fn() }))
jest.mock("@/app/hooks/use-auth", () => ({ useAuth: jest.fn() }))
jest.mock("@/app/context/ThemeContext", () => ({ useTheme: () => ({ isDarkMode: false }) }))

const fetchMock = global.fetch as jest.Mock
const filters = { startDate: new Date(2026, 8, 1), endDate: new Date(2026, 8, 29), segmentId: "all" }
const row = { cohort: "2026-W36", cohortStart: "2026-08-31", size: 4, weeks: [100, 50, 0, null] }
const response = (payload: unknown) => ({ ok: true, json: async () => payload })

function mount(customers = false) {
  const cache = new Map()
  const view = (props = {}) => <SWRConfig value={{ provider: () => cache, shouldRetryOnError: false }}>
    {customers ? <CohortTables {...filters} {...props} /> : <LeadsCohortTables {...filters} {...props} />}
  </SWRConfig>
  return { ...render(view()), view }
}

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(response({ leadCohorts: [row] }))
  jest.mocked(useSite).mockReturnValue({ currentSite: { id: "site-a" } } as ReturnType<typeof useSite>)
  jest.mocked(useAuth).mockReturnValue({ user: { id: "user-a" }, isLoading: false } as ReturnType<typeof useAuth>)
})

describe("cohort report UI", () => {
  it("shows sample size, week-zero baseline, zero retention and unobserved weeks accessibly", async () => {
    mount()
    const table = await screen.findByRole("table", { name: "Lead engagement retention" })
    expect(within(table).getByRole("columnheader", { name: "Week 0" })).toBeInTheDocument()
    expect(within(table).getByRole("cell", { name: "2026-W36, week 2: 0%" })).toHaveTextContent("0%")
    expect(within(table).getByRole("cell", { name: "2026-W36, week 3: Not observed" })).toBeInTheDocument()
    expect(within(table).getByText("4")).toBeInTheDocument()
    expect(screen.queryByText("Week 7")).not.toBeInTheDocument()
    const url = new URL(fetchMock.mock.calls[0][0], "http://localhost")
    expect(url.searchParams.get("startDate")).toBe("2026-09-01")
    expect(url.searchParams.get("endDate")).toBe("2026-09-29")
    expect(url.searchParams.has("userId")).toBe(false)
    expect(url.searchParams.has("useDemoData")).toBe(false)
  })

  it("renders all observed columns instead of cutting off after eight weeks", async () => {
    fetchMock.mockResolvedValue(response({ leadCohorts: [{ ...row, weeks: [100, 80, 75, 50, 50, 25, 25, 25, 0, null] }] }))
    mount()
    expect(await screen.findByRole("columnheader", { name: "Week 9" })).toBeInTheDocument()
    expect(screen.getByRole("cell", { name: "2026-W36, week 8: 0%" })).toBeInTheDocument()
  })

  it("deduplicates equivalent calendar-date selections", async () => {
    const { rerender, view } = mount()
    await screen.findByRole("table")
    rerender(view({ startDate: new Date(2026, 8, 1, 10), endDate: new Date(2026, 8, 29, 22) }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("prevents a previous segment response from overwriting current data", async () => {
    let resolve!: (body: unknown) => void
    fetchMock.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const { rerender, view } = mount()
    rerender(view({ segmentId: "segment-b" }))
    await screen.findByRole("table")
    await act(async () => resolve(response({ leadCohorts: [{ ...row, cohort: "Stale cohort" }] })))
    expect(screen.queryByText("Stale cohort")).not.toBeInTheDocument()
  })

  it.each(["site", "account"])("does not carry cohorts into a changed %s", async scope => {
    const { rerender, view } = mount()
    await screen.findByRole("table")
    fetchMock.mockImplementation(() => new Promise(() => {}))
    if (scope === "site") jest.mocked(useSite).mockReturnValue({ currentSite: { id: "site-b" } } as ReturnType<typeof useSite>)
    else jest.mocked(useAuth).mockReturnValue({ user: { id: "user-b" }, isLoading: false } as ReturnType<typeof useAuth>)
    rerender(view())
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it.each(["http", "malformed", "network"])("shows an actionable %s failure, not an empty cohort", async failure => {
    if (failure === "network") fetchMock.mockRejectedValueOnce(new Error("private network detail"))
    else fetchMock.mockResolvedValueOnce(failure === "http" ? { ok: false, status: 500 } : response({ unrelated: [] }))
    mount()
    expect(await screen.findByRole("alert")).toBeInTheDocument()
    expect(screen.queryByText("No cohorts match the selected filters.")).not.toBeInTheDocument()
    expect(screen.queryByText("private network detail")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByRole("table")).toBeInTheDocument()
  })

  it("waits for authentication before requesting data", async () => {
    jest.mocked(useAuth).mockReturnValue({ user: null, isLoading: true } as ReturnType<typeof useAuth>)
    const { rerender, view } = mount()
    expect(fetchMock).not.toHaveBeenCalled()
    jest.mocked(useAuth).mockReturnValue({ user: { id: "user-a" }, isLoading: false } as ReturnType<typeof useAuth>)
    rerender(view())
    await screen.findByRole("table")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("shows customer and engagement cohorts without duplicating purchase data", async () => {
    fetchMock.mockResolvedValue(response({ salesCohorts: [row], usageCohorts: [], metadata: {
      definition: "First confirmed sale observed in the selected window", observationEnd: "2026-09-29", excludedAnonymousSales: 3,
    } }))
    mount(true)
    expect(await screen.findByRole("table", { name: "Repeat purchase retention" })).toBeInTheDocument()
    expect(screen.queryByRole("table", { name: "Customer engagement retention" })).not.toBeInTheDocument()
    expect(screen.getByText("No matching cohorts for this measure.")).toBeInTheDocument()
    expect(screen.getByText(/3 sales without an identified customer/)).toBeInTheDocument()
    expect(fetchMock.mock.calls[0][0]).toContain("/api/cohorts?")
  })

  it("renders genuinely empty responses without claiming an error", async () => {
    fetchMock.mockResolvedValue(response({ leadCohorts: [] }))
    mount()
    expect(await screen.findByText("No cohorts match the selected filters.")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("explains missing activity coverage without inventing retention percentages", async () => {
    fetchMock.mockResolvedValue(response({ leadCohorts: [{ ...row, weeks: [100, null, null] }], metadata: {
      activityAvailable: false, activityUnavailableReason: "Recorded message activity is unavailable; retention is not inferred.",
    } }))
    mount()
    expect(await screen.findByText(/retention is not inferred/)).toBeInTheDocument()
    expect(screen.getByRole("cell", { name: "2026-W36, week 1: Not observed" })).toBeInTheDocument()
    expect(screen.queryByText("0%")).not.toBeInTheDocument()
  })
})