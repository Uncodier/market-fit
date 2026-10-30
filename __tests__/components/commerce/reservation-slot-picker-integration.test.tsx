import { fireEvent, render, screen } from "@testing-library/react"
import { ReservationSlotPicker } from "@/app/components/commerce/ReservationSlotPicker"
import { getReservationSlotsLocalFirst } from "@/app/pos/local/reservation-slots"

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ locale: "en", t: () => "" }),
}))
jest.mock("@/app/components/auth/auth-provider", () => ({
  useAuthContext: () => ({ user: null }),
}))
jest.mock("@/app/pos/local/reservation-slots", () => ({
  getReservationSlotsLocalFirst: jest.fn(),
}))

const start = "2030-10-29T23:30:00.000Z"
const end = "2030-10-30T00:00:00.000Z"
const slots = [{ start, end, available: 1, timezone: "America/Mexico_City" }]

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getReservationSlotsLocalFirst).mockResolvedValue({ fromCache: false, slots })
})

it.each(["live", "preview"] as const)("changes the %s calendar day and time without changing the selected instant", async mode => {
  const onSelect = jest.fn()
  const props = {
    catalogItemId: "service-one", selectedStartIso: start, selectedEndIso: end,
    hideDetailsStep: true, onSelect, previewSlots: mode === "preview" ? slots : undefined,
  }
  const { rerender } = render(<ReservationSlotPicker {...props} displayTimezone="America/Mexico_City" />)
  await screen.findByRole("button", { name: /5:30 PM/ })
  rerender(<ReservationSlotPicker {...props} displayTimezone="Asia/Tokyo" />)
  fireEvent.click(await screen.findByRole("button", { name: /8:30 AM/ }))
  expect(onSelect).toHaveBeenCalledWith(start, end, expect.objectContaining({ timezone: "Asia/Tokyo" }))
  expect(slots[0].timezone).toBe("America/Mexico_City")
  if (mode === "preview") {
    expect(getReservationSlotsLocalFirst).not.toHaveBeenCalled()
  } else {
    expect(getReservationSlotsLocalFirst).toHaveBeenCalledWith(expect.objectContaining({
      startDate: "2030-09-28", endDate: "2030-11-10",
    }))
  }
})

it("keeps an empty preview offline and refreshes availability when preview slots change", async () => {
  const onSelect = jest.fn()
  const props = {
    catalogItemId: "service-one", selectedStartIso: start, selectedEndIso: end,
    hideDetailsStep: true, onSelect, displayTimezone: "Asia/Tokyo",
  }
  const { rerender } = render(<ReservationSlotPicker {...props} previewSlots={[]} />)
  await screen.findByRole("button", { name: /8:30 AM/ })
  const updatedStart = "2030-10-30T01:30:00.000Z"
  const updatedEnd = "2030-10-30T02:00:00.000Z"
  const updatedSlots = [{ start: updatedStart, end: updatedEnd, available: 2, timezone: "UTC" }]
  rerender(<ReservationSlotPicker {...props} previewSlots={updatedSlots} />)
  fireEvent.click(await screen.findByRole("button", { name: /10:30 AM/ }))
  expect(onSelect).toHaveBeenLastCalledWith(updatedStart, updatedEnd, expect.objectContaining({ timezone: "Asia/Tokyo" }))
  expect(getReservationSlotsLocalFirst).not.toHaveBeenCalled()
})