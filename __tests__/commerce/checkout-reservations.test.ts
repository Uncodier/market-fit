import { syncCheckoutDropinReservations } from "@/app/commerce/checkout-reservations"
import { pickNextRedeemableService } from "@/app/commerce/pass-round-robin-server"

jest.mock("@/app/commerce/pass-round-robin-server", () => ({
  pickNextRedeemableService: jest.fn(),
}))

describe("syncCheckoutDropinReservations", () => {
  const supabaseAdmin = {
    from: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("creates a reservation on the round-robin member, not the pass SKU", async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null })
    const insert = jest.fn().mockResolvedValue({ error: null })
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({ maybeSingle }),
      }),
      insert,
    })
    ;(pickNextRedeemableService as jest.Mock).mockResolvedValue("member-b")

    await syncCheckoutDropinReservations({
      supabaseAdmin,
      siteId: "site-1",
      upsertedItems: [
        {
          id: "soi-1",
          catalog_item_id: "pass-1",
          quantity: 1,
          _is_reservation_dropin: true,
          _isRoundRobinDropin: true,
          _reservationStart: "2026-08-14T10:00:00Z",
          _reservationEnd: "2026-08-14T11:00:00Z",
        },
      ],
      intent: "complete",
      isFullyPaid: true,
      isAdmin: false,
      finalLeadId: "lead-1",
    })

    expect(pickNextRedeemableService).toHaveBeenCalledWith(
      expect.objectContaining({ passCatalogItemId: "pass-1" })
    )
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        catalog_item_id: "member-b",
        sale_order_item_id: "soi-1",
        status: "confirmed",
      })
    )
  })

  it("does not auto-assign when the line is a normal drop-in service", async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null })
    const insert = jest.fn().mockResolvedValue({ error: null })
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({ maybeSingle }),
      }),
      insert,
    })

    await syncCheckoutDropinReservations({
      supabaseAdmin,
      siteId: "site-1",
      upsertedItems: [
        {
          id: "soi-2",
          catalog_item_id: "service-1",
          quantity: 1,
          _is_reservation_dropin: true,
          _isRoundRobinDropin: false,
          _reservationStart: "2026-08-14T10:00:00Z",
          _reservationEnd: "2026-08-14T11:00:00Z",
        },
      ],
      intent: "complete",
      isFullyPaid: true,
      isAdmin: true,
    })

    expect(pickNextRedeemableService).not.toHaveBeenCalled()
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ catalog_item_id: "service-1" })
    )
  })
})
