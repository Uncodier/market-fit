import { pickNextRedeemableService } from "../../app/commerce/pass-round-robin-server"
import { assertReservationSlot } from "../../app/reservations/availability"
import { createServiceClient } from "../../lib/supabase/server"

jest.mock("../../lib/supabase/server", () => ({
  createServiceClient: jest.fn(),
}))

jest.mock("../../app/reservations/availability", () => ({
  assertReservationSlot: jest.fn(),
  getAvailableSlotsForItem: jest.fn(),
}))

function chainFor(resolved: any) {
  const chain: any = {}
  const methods = [
    "select",
    "eq",
    "in",
    "order",
    "maybeSingle",
    "single",
    "upsert",
  ]
  for (const m of methods) {
    chain[m] = jest.fn(() => chain)
  }
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(resolved).then(resolve, reject)
  return chain
}

describe("pickNextRedeemableService", () => {
  const passId = "pass-1"
  const siteId = "site-1"
  const members = [
    { reservable_catalog_item_id: "A", sort_order: 0, created_at: "2026-01-01" },
    { reservable_catalog_item_id: "B", sort_order: 1, created_at: "2026-01-02" },
    { reservable_catalog_item_id: "C", sort_order: 2, created_at: "2026-01-03" },
  ]
  const memberItems = [
    { id: "A", kind: "service", is_reservation: true, status: "active" },
    { id: "B", kind: "service", is_reservation: true, status: "active" },
    { id: "C", kind: "service", is_reservation: true, status: "active" },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function mockClient(opts: {
    nextIndex?: number
    busyIds?: string[]
    upsert?: jest.Mock
  }) {
    const redeemables = chainFor({ data: members, error: null })
    const items = chainFor({ data: memberItems, error: null })
    const state = chainFor({
      data: opts.nextIndex != null ? { next_index: opts.nextIndex } : null,
      error: null,
    })
    const upsert = opts.upsert || jest.fn(() => chainFor({ error: null }))
    ;(createServiceClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "pass_redeemable_items") return redeemables
        if (table === "catalog_items") return items
        if (table === "pass_round_robin_state") {
          return { ...state, upsert }
        }
        return chainFor({ data: null, error: null })
      }),
    })
    ;(assertReservationSlot as jest.Mock).mockImplementation(
      async (_site: string, catalogItemId: string) => {
        if (opts.busyIds?.includes(catalogItemId)) {
          throw new Error("Not enough capacity for this slot")
        }
        return true
      }
    )
    return { upsert }
  }

  it("assigns the next member and persists the cursor", async () => {
    const { upsert } = mockClient({ nextIndex: 0 })
    const assigned = await pickNextRedeemableService({
      passCatalogItemId: passId,
      siteId,
      startIso: "2026-08-14T10:00:00Z",
      endIso: "2026-08-14T11:00:00Z",
      quantity: 1,
    })
    expect(assigned).toBe("A")
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        pass_catalog_item_id: passId,
        next_index: 1,
        last_member_id: "A",
      })
    )
  })

  it("skips a busy member and assigns the next available", async () => {
    mockClient({ nextIndex: 0, busyIds: ["A"] })
    const assigned = await pickNextRedeemableService({
      passCatalogItemId: passId,
      siteId,
      startIso: "2026-08-14T10:00:00Z",
      endIso: "2026-08-14T11:00:00Z",
      quantity: 1,
    })
    expect(assigned).toBe("B")
  })

  it("keeps an existing assignment when that member can still take the slot", async () => {
    const { upsert } = mockClient({ nextIndex: 0 })
    const assigned = await pickNextRedeemableService({
      passCatalogItemId: passId,
      siteId,
      startIso: "2026-08-14T10:00:00Z",
      endIso: "2026-08-14T11:00:00Z",
      quantity: 1,
      preferredMemberId: "C",
    })
    expect(assigned).toBe("C")
    expect(upsert).not.toHaveBeenCalled()
  })

  it("throws when no member can take the slot", async () => {
    mockClient({ nextIndex: 0, busyIds: ["A", "B", "C"] })
    await expect(
      pickNextRedeemableService({
        passCatalogItemId: passId,
        siteId,
        startIso: "2026-08-14T10:00:00Z",
        endIso: "2026-08-14T11:00:00Z",
        quantity: 1,
      })
    ).rejects.toThrow("No redeemable service is available for this slot.")
  })
})
