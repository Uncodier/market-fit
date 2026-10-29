import { fireEvent, render, screen } from "@testing-library/react"
import { ReservationTimezoneField } from "@/app/reservations/components/reservation-timezone-field"
import { ReservationSlotPicker } from "@/app/components/commerce/ReservationSlotPicker"
import { getReservationSlotsLocalFirst } from "@/app/pos/local/reservation-slots"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ locale: "en", t: () => "" }) }))
jest.mock("@/app/components/auth/auth-provider", () => ({ useAuthContext: () => ({ user: null }) }))
jest.mock("@/app/pos/local/reservation-slots", () => ({ getReservationSlotsLocalFirst: jest.fn() }))

it("provides a labeled, searchable zone selector", () => {
  const onChange = jest.fn()
  render(<ReservationTimezoneField value="UTC" onChange={onChange} />)
  fireEvent.change(screen.getByLabelText("Time zone"), { target: { value: "Mexico" } })
  fireEvent.click(screen.getByText(/Mexico.*America\/Mexico City/))
  expect(onChange).toHaveBeenCalledWith("America/Mexico_City")
})

it("changes slot display and calendar day without changing the selected instant", async () => {
  const start = "2026-10-29T23:30:00.000Z"
  const end = "2026-10-30T00:00:00.000Z"
  jest.mocked(getReservationSlotsLocalFirst).mockResolvedValue({ fromCache: false, slots: [{ start, end, available: 1, timezone: "America/Mexico_City" }] })
  const onSelect = jest.fn()
  const props = { catalogItemId: "service-one", selectedStartIso: start, selectedEndIso: end, hideDetailsStep: true, onSelect }
  const { rerender } = render(<ReservationSlotPicker {...props} displayTimezone="America/Mexico_City" />)
  await screen.findByRole("button", { name: /5:30 PM/ })
  rerender(<ReservationSlotPicker {...props} displayTimezone="Asia/Tokyo" />)
  const slot = await screen.findByRole("button", { name: /8:30 AM/ })
  fireEvent.click(slot)
  expect(onSelect).toHaveBeenCalledWith(start, end, expect.objectContaining({ timezone: "Asia/Tokyo" }))
})