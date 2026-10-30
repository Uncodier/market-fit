import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { ReservationListPeriod } from "@/app/reservations/components/ReservationListPeriod"
import ReservationsPage from "@/app/reservations/page"
import useSWR from "swr"
import { getReservations } from "@/app/reservations/actions"
import { getCalendarBlocks } from "@/app/reservations/calendar-blocks-actions"
import { calendarReadWindow, listReadWindow } from "@/app/reservations/read-window"

let mockParams = new URLSearchParams("date=2026-10-14&viewType=list")
let mockReadError: Error | undefined
const mockReplace = jest.fn()
const mockMutate = jest.fn()
const mockFetchers: (() => Promise<unknown>)[] = []
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }), usePathname: () => "/reservations", useSearchParams: () => mockParams,
}))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site" } }) }))
jest.mock("@/app/reservations/actions", () => ({ getReservations: jest.fn() }))
jest.mock("@/app/reservations/calendar-blocks-actions", () => ({ getCalendarBlocks: jest.fn() }))
jest.mock("swr", () => ({ __esModule: true, default: jest.fn((key, fetcher) => {
  if (key?.[0] === "reservations" || key?.[0] === "calendar-blocks") mockFetchers.push(fetcher)
  return { data: { data: [], members: [] }, error: mockReadError, isLoading: false, mutate: mockMutate }
}) }))
jest.mock("@/app/reservations/components/CreateReservationDialog", () => ({ CreateReservationDialog: () => null }))
jest.mock("@/app/reservations/components/ReservationPaymentDialog", () => ({ ReservationPaymentDialog: () => null }))
jest.mock("@/app/reservations/components/CreateCalendarBlockDialog", () => ({ CreateCalendarBlockDialog: () => null }))
jest.mock("@/app/reservations/components/ReservationsList", () => ({ ReservationsList: () => <div>Service records</div> }))
jest.mock("@/app/reservations/components/ReservationsByDateList", () => ({ ReservationsByDateList: () => <div>Date records</div> }))
jest.mock("@/app/reservations/components/SchedulesList", () => ({ SchedulesList: () => <div>Schedules</div> }))
jest.mock("@/app/reservations/components/reservation-table", () => ({ ReservationsTableSkeleton: () => <div>Loading</div> }))
jest.mock("@/app/reservations/components/ReservationCalendar", () => ({ ReservationCalendar: () => <div>Calendar records</div> }))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))

beforeEach(() => {
  window.matchMedia = jest.fn().mockImplementation(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }))
  mockReadError = undefined; mockParams = new URLSearchParams("date=2026-10-14&viewType=list")
  jest.clearAllMocks(); mockFetchers.length = 0
  ;(getReservations as jest.Mock).mockResolvedValue({ data: [] })
  ;(getCalendarBlocks as jest.Mock).mockResolvedValue({ data: [] })
})

it("provides explicit month picker, navigation and search scope", () => {
  const change = jest.fn()
  render(<ReservationListPeriod date={new Date(2026, 0, 31)} onChange={change} />)
  expect(screen.getByText(/Search and filters apply to this period/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Next month" }))
  expect(change).toHaveBeenLastCalledWith(new Date(2026, 1, 28))
  fireEvent.change(screen.getByLabelText("Reservation month"), { target: { value: "2027-12" } })
  expect(change).toHaveBeenLastCalledWith(new Date(2027, 11, 1))
})

it("keys and fetches list month, changes URL with picker, then matches calendar navigation", async () => {
  const { rerender } = render(<ReservationsPage />)
  const listRange = listReadWindow(new Date(2026, 9, 14))
  expect((useSWR as jest.Mock).mock.calls[0][0]).toEqual(["reservations", "site", listRange.start, listRange.end])
  await mockFetchers[0](); await mockFetchers[1]()
  expect(getReservations).toHaveBeenCalledWith("site", listRange)
  expect(getCalendarBlocks).toHaveBeenCalledWith("site", listRange)
  fireEvent.click(screen.getByRole("button", { name: "Next month" }))
  expect(mockReplace).toHaveBeenCalledWith("/reservations?date=2026-11-14&viewType=list", { scroll: false })
  mockParams = new URLSearchParams("date=2026-11-14&viewType=calendar&calView=week")
  ;(useSWR as jest.Mock).mockClear()
  rerender(<ReservationsPage />)
  const range = calendarReadWindow(new Date(2026, 10, 14), "week")
  expect((useSWR as jest.Mock).mock.calls[0][0]).toEqual(["reservations", "site", range.start, range.end])
  expect(screen.queryByLabelText("Reservation month")).not.toBeInTheDocument()
})

it("renders retryable errors rather than an empty or partial calendar/list", async () => {
  mockReadError = new Error("Calendar data could not be loaded.")
  render(<ReservationsPage />)
  expect(screen.getByRole("alert")).toHaveTextContent("Calendar data could not be loaded.")
  expect(screen.queryByText("Date records")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  expect(mockMutate).toHaveBeenCalledTimes(2)
  ;(getReservations as jest.Mock).mockResolvedValue({ data: [], error: "Subread failed" })
  await expect(mockFetchers[0]()).rejects.toThrow("Subread failed")
})

it("does not read reservations or blocks for schedule-only view", () => {
  mockParams = new URLSearchParams("viewMode=schedules")
  render(<ReservationsPage />)
  expect((useSWR as jest.Mock).mock.calls.slice(0, 2).map(call => call[0])).toEqual([null, null])
})