import { syncCheckoutDropinReservations, resolveDropinReservationCatalogItemId } from "@/app/commerce/checkout-reservations"
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

  it("links an existing reservation instead of inserting a second row", async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null })
    const eq = jest.fn().mockResolvedValue({ error: null })
    const update = jest.fn().mockReturnValue({ eq })
    const insert = jest.fn()
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({ maybeSingle }),
      }),
      update,
      insert,
    })

    await syncCheckoutDropinReservations({
      supabaseAdmin,
      siteId: "site-1",
      upsertedItems: [
        {
          id: "soi-3",
          catalog_item_id: "service-1",
          quantity: 1,
          _is_reservation_dropin: true,
          _reservationStart: "2026-08-14T10:00:00Z",
          _reservationEnd: "2026-08-14T11:00:00Z",
        },
      ],
      intent: "send",
      isFullyPaid: false,
      isAdmin: true,
      finalLeadId: "lead-1",
      existingReservationId: "res-existing",
    })

    expect(insert).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        sale_order_item_id: "soi-3",
        catalog_item_id: "service-1",
        status: "pending",
      })
    )
    expect(eq).toHaveBeenCalledWith("id", "res-existing")
  })

  it("updates a linked reservation without overwriting dates when the cart omitted them", async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { id: "res-linked", catalog_item_id: "service-1" },
    })
    const eq = jest.fn().mockResolvedValue({ error: null })
    const update = jest.fn().mockReturnValue({ eq })
    const insert = jest.fn()
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({ maybeSingle }),
      }),
      update,
      insert,
    })

    await syncCheckoutDropinReservations({
      supabaseAdmin,
      siteId: "site-1",
      upsertedItems: [
        {
          id: "soi-4",
          catalog_item_id: "service-1",
          quantity: 1,
          _is_reservation_dropin: true,
        },
      ],
      intent: "complete",
      isFullyPaid: true,
      isAdmin: true,
      finalLeadId: "lead-1",
    })

    expect(insert).not.toHaveBeenCalled()
    expect(pickNextRedeemableService).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "confirmed",
        quantity: 1,
        catalog_item_id: "service-1",
        sale_order_item_id: "soi-4",
      })
    )
    expect(update.mock.calls[0][0]).not.toHaveProperty("start_time")
    expect(update.mock.calls[0][0]).not.toHaveProperty("end_time")
    expect(eq).toHaveBeenCalledWith("id", "res-linked")
  })

  it("keeps the assigned round-robin member when dates are missing", async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { id: "res-rr", catalog_item_id: "member-b" },
    })
    const eq = jest.fn().mockResolvedValue({ error: null })
    const update = jest.fn().mockReturnValue({ eq })
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({ maybeSingle }),
      }),
      update,
      insert: jest.fn(),
    })

    await syncCheckoutDropinReservations({
      supabaseAdmin,
      siteId: "site-1",
      upsertedItems: [
        {
          id: "soi-5",
          catalog_item_id: "pass-1",
          quantity: 1,
          _is_reservation_dropin: true,
          _isRoundRobinDropin: true,
        },
      ],
      intent: "complete",
      isFullyPaid: true,
      isAdmin: true,
    })

    expect(pickNextRedeemableService).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ catalog_item_id: "member-b" })
    )
  })

  it("skips creating a reservation when dates and a linked booking are both missing", async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null })
    const insert = jest.fn()
    const update = jest.fn()
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({ maybeSingle }),
      }),
      update,
      insert,
    })

    await syncCheckoutDropinReservations({
      supabaseAdmin,
      siteId: "site-1",
      upsertedItems: [
        {
          id: "soi-6",
          catalog_item_id: "service-1",
          quantity: 1,
          _is_reservation_dropin: true,
        },
      ],
      intent: "complete",
      isFullyPaid: true,
      isAdmin: true,
    })

    expect(insert).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it("keeps the assigned member when billing a pass against an existing reservation", async () => {
    const maybeSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { id: "res-existing", catalog_item_id: "member-b" } })
    const eq = jest.fn().mockResolvedValue({ error: null })
    const update = jest.fn().mockReturnValue({ eq })
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({ maybeSingle }),
      }),
      update,
      insert: jest.fn(),
    })

    await syncCheckoutDropinReservations({
      supabaseAdmin,
      siteId: "site-1",
      upsertedItems: [
        {
          id: "soi-7",
          catalog_item_id: "pass-1",
          quantity: 1,
          _is_reservation_dropin: true,
          _reservationStart: "2026-08-14T10:00:00Z",
          _reservationEnd: "2026-08-14T11:00:00Z",
        },
      ],
      intent: "send",
      isFullyPaid: false,
      isAdmin: true,
      finalLeadId: "lead-1",
      existingReservationId: "res-existing",
    })

    expect(pickNextRedeemableService).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ catalog_item_id: "member-b" })
    )
  })

  it("passes the assigned member as preferred for round-robin checkout", async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { id: "res-rr", catalog_item_id: "member-b" },
    })
    const eq = jest.fn().mockResolvedValue({ error: null })
    const update = jest.fn().mockReturnValue({ eq })
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({ maybeSingle }),
      }),
      update,
      insert: jest.fn(),
    })
    ;(pickNextRedeemableService as jest.Mock).mockResolvedValue("member-b")

    await syncCheckoutDropinReservations({
      supabaseAdmin,
      siteId: "site-1",
      upsertedItems: [
        {
          id: "soi-8",
          catalog_item_id: "pass-1",
          quantity: 1,
          _is_reservation_dropin: true,
          _isRoundRobinDropin: true,
          _reservationStart: "2026-08-14T10:00:00Z",
          _reservationEnd: "2026-08-14T11:00:00Z",
        },
      ],
      intent: "send",
      isFullyPaid: false,
      isAdmin: true,
      existingReservationId: "res-rr",
    })

    expect(pickNextRedeemableService).toHaveBeenCalledWith(
      expect.objectContaining({
        passCatalogItemId: "pass-1",
        preferredMemberId: "member-b",
        ignoreReservationId: "res-rr",
      })
    )
  })
})

describe("resolveDropinReservationCatalogItemId", () => {
  it("keeps the assigned member when billing a pass without round robin", () => {
    expect(
      resolveDropinReservationCatalogItemId({
        lineCatalogItemId: "pass-1",
        hasReservationDates: true,
        isRoundRobinDropin: false,
        existingCatalogItemId: "member-b",
      })
    ).toBe("member-b")
  })

  it("asks round robin to assign when the drop-in is a round-robin pass", () => {
    expect(
      resolveDropinReservationCatalogItemId({
        lineCatalogItemId: "pass-1",
        hasReservationDates: true,
        isRoundRobinDropin: true,
        existingCatalogItemId: "member-b",
      })
    ).toBe("round_robin")
  })

  it("uses the line catalog item for a normal service drop-in", () => {
    expect(
      resolveDropinReservationCatalogItemId({
        lineCatalogItemId: "service-1",
        hasReservationDates: true,
        existingCatalogItemId: "service-1",
      })
    ).toBe("service-1")
  })
})
