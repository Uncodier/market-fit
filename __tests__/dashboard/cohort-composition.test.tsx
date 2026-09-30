import { fireEvent, render, screen } from "@testing-library/react"
import { CohortReport } from "@/app/components/dashboard/cohort-report"
import { useCohortReport } from "@/app/components/dashboard/use-cohort-report"

jest.mock("@/app/components/dashboard/use-cohort-report", () => ({ useCohortReport: jest.fn() }))
jest.mock("@/app/context/ThemeContext", () => ({ useTheme: () => ({ isDarkMode: false }) }))

const cohort = useCohortReport as jest.Mock
const row = { cohort: "2026-W36", cohortStart: "2026-08-31", size: 4, weeks: [100, 50, 0, null] }
const state = {
  data: { salesCohorts: [row], leadCohorts: [row], usageCohorts: [], metadata: {
    definition: "First confirmed sale observed in this date range.", observationEnd: "2026-09-29", excludedAnonymousSales: 3,
  } },
  error: undefined, isLoading: false, isValidating: false, mutate: jest.fn(), authLoading: false,
  signedIn: true, hasSite: true, invalidDates: false,
}

beforeEach(() => cohort.mockReturnValue(state))

it.each(["authLoading", "isLoading", "isValidating"])("shows a structured skeleton rather than stale error or figures during %s", field => {
  cohort.mockReturnValue({ ...state, [field]: true, error: new Error("Previous attempt failed") })
  render(<CohortReport kind="customers" />)
  expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true")
  expect(screen.getByRole("status").querySelectorAll(".motion-reduce\\:animate-none").length).toBeGreaterThan(4)
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(screen.queryByRole("table")).not.toBeInTheDocument()
})

it("restores actionable failure only when the retry settles", () => {
  const retry = jest.fn()
  cohort.mockReturnValue({ ...state, data: undefined, error: new Error("Unable to load cohort data."), mutate: retry })
  render(<CohortReport kind="customers" />)
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to load cohort data.")
  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  expect(retry).toHaveBeenCalledTimes(1)
})

it("keeps primary tables and observation key visible while moving long definitions into details", () => {
  render(<CohortReport kind="customers" />)
  expect(screen.getByText("2026-09-29")).toBeInTheDocument()
  expect(screen.getByRole("table", { name: "Repeat purchase retention" })).toHaveClass("min-w-[640px]")
  const definitions = screen.getByText("Cohort definitions and coverage").closest("details")
  expect(definitions).not.toHaveAttribute("open")
  expect(definitions).toHaveTextContent("First confirmed sale observed")
  expect(definitions).toHaveTextContent("3 sales without an identified customer")
  expect(screen.getByText("No matching cohorts for this measure.")).toBeInTheDocument()
})

it("does not bury missing activity coverage inside collapsed definitions", () => {
  cohort.mockReturnValue({ ...state, data: { ...state.data, metadata: {
    activityAvailable: false, activityUnavailableReason: "Activity is unavailable; retention is not estimated.",
  } } })
  render(<CohortReport kind="leads" />)
  expect(screen.getByRole("status")).toHaveTextContent("Activity is unavailable")
  expect(screen.getByRole("status").closest("details")).toBeNull()
  expect(screen.queryByRole("heading", { name: "Customer engagement retention" })).not.toBeInTheDocument()
})