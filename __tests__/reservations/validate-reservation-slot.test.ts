import { validateReservationSlot } from "../../app/reservations/actions"
import { assertCommerceReservationSlot } from "../../app/commerce/pass-round-robin-server"

jest.mock("../../lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}))

jest.mock("../../app/commerce/pass-round-robin-server", () => ({
  assertCommerceReservationSlot: jest.fn(),
}))

describe("validateReservationSlot", () => {
  const params = {
    siteId: "site-1",
    catalogItem: { id: "cat-1" },
    startIso: "2026-08-26T19:00:00.000Z",
    endIso: "2026-08-26T20:00:00.000Z",
    quantity: 1,
    isAdmin: true,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns empty when the slot is valid", async () => {
    ;(assertCommerceReservationSlot as jest.Mock).mockResolvedValue(undefined)
    await expect(validateReservationSlot(params)).resolves.toEqual({})
  })

  it("returns the error message instead of throwing", async () => {
    ;(assertCommerceReservationSlot as jest.Mock).mockRejectedValue(
      new Error("Not enough capacity for this slot")
    )
    await expect(validateReservationSlot(params)).resolves.toEqual({
      error: "Not enough capacity for this slot",
    })
  })
})
