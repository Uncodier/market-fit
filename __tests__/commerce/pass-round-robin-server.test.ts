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

function createCatalogChain(items: any[]) {
  let currentData = [...items]
  const chain: any = {}
  chain.select = () => chain
  chain.eq = (key: string, val: any) => {
    currentData = currentData.filter(i => i[key] === val)
    return chain
  }
  chain.in = (key: string, vals: any[]) => {
    currentData = currentData.filter(i => vals.includes(i[key]))
    return chain
  }
  chain.single = () => Promise.resolve({ data: currentData[0] || null, error: null })
  chain.maybeSingle = () => Promise.resolve({ data: currentData[0] || null, error: null })
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve({ data: currentData, error: null }).then(resolve, reject)
  return chain
}

describe("pickNextRedeemableService", () => {
  const passId = "pass-1"
  const siteId = "site-1"
  const defaultMembers = [
    { reservable_catalog_item_id: "A", sort_order: 0, created_at: "2026-01-01" },
    { reservable_catalog_item_id: "B", sort_order: 1, created_at: "2026-01-02" },
    { reservable_catalog_item_id: "C", sort_order: 2, created_at: "2026-01-03" },
  ]
  const defaultMemberItems = [
    { id: "A", kind: "service", is_reservation: true, status: "active", availability_mode: "always", availability_status: "available" },
    { id: "B", kind: "service", is_reservation: true, status: "active", availability_mode: "always", availability_status: "available" },
    { id: "C", kind: "service", is_reservation: true, status: "active", availability_mode: "always", availability_status: "available" },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function mockClient(opts: {
    nextIndex?: number
    busyIds?: string[]
    upsert?: jest.Mock
    members?: any[]
    memberItems?: any[]
    passItem?: any
  }) {
    const members = opts.members || defaultMembers
    const memberItems = opts.memberItems || defaultMemberItems
    const passItem = opts.passItem || { id: passId }

    const redeemables = chainFor({ data: members, error: null })
    const state = chainFor({
      data: opts.nextIndex != null ? { next_index: opts.nextIndex } : null,
      error: null,
    })
    const upsert = opts.upsert || jest.fn(() => chainFor({ error: null }))
    ;(createServiceClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "pass_redeemable_items") return redeemables
        if (table === "catalog_items") return createCatalogChain([passItem, ...memberItems])
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

  it("skips archived members", async () => {
    mockClient({
      nextIndex: 0,
      memberItems: [
        { id: "A", kind: "service", is_reservation: true, status: "archived", availability_mode: "always", availability_status: "available" },
        { id: "B", kind: "service", is_reservation: true, status: "active", availability_mode: "always", availability_status: "available" },
        { id: "C", kind: "service", is_reservation: true, status: "active", availability_mode: "always", availability_status: "available" },
      ]
    })
    const assigned = await pickNextRedeemableService({
      passCatalogItemId: passId,
      siteId,
      startIso: "2026-08-14T10:00:00Z",
      endIso: "2026-08-14T11:00:00Z",
      quantity: 1,
    })
    expect(assigned).toBe("B")
  })

  it("skips unavailable members", async () => {
    mockClient({
      nextIndex: 0,
      memberItems: [
        { id: "A", kind: "service", is_reservation: true, status: "active", availability_mode: "manual", availability_status: "unavailable" },
        { id: "B", kind: "service", is_reservation: true, status: "active", availability_mode: "always", availability_status: "available" },
        { id: "C", kind: "service", is_reservation: true, status: "active", availability_mode: "always", availability_status: "available" },
      ]
    })
    const assigned = await pickNextRedeemableService({
      passCatalogItemId: passId,
      siteId,
      startIso: "2026-08-14T10:00:00Z",
      endIso: "2026-08-14T11:00:00Z",
      quantity: 1,
    })
    expect(assigned).toBe("B")
  })

  it("skips archived parent with active child variant", async () => {
    mockClient({
      nextIndex: 0,
      passItem: { id: passId, parent_id: "parent-pass", metadata: { option_values: { type: "basic" } } },
      members: [
        { reservable_catalog_item_id: "parentA", sort_order: 0, created_at: "2026-01-01" },
        { reservable_catalog_item_id: "parentB", sort_order: 1, created_at: "2026-01-02" },
      ],
      memberItems: [
        { id: "parent-pass" },
        // parentA is archived, but has an active child
        { id: "parentA", status: "archived" },
        { id: "childA", parent_id: "parentA", kind: "service", is_reservation: true, status: "active", availability_mode: "always", availability_status: "available", metadata: { option_values: { type: "basic" } }, parent: { status: "archived" } },
        // parentB is active
        { id: "parentB", status: "active" },
        { id: "childB", parent_id: "parentB", kind: "service", is_reservation: true, status: "active", availability_mode: "always", availability_status: "available", metadata: { option_values: { type: "basic" } }, parent: { status: "active" } },
      ]
    })
    const assigned = await pickNextRedeemableService({
      passCatalogItemId: passId,
      siteId,
      startIso: "2026-08-14T10:00:00Z",
      endIso: "2026-08-14T11:00:00Z",
      quantity: 1,
    })
    expect(assigned).toBe("childB")
  })

  it("skips unavailable parent with active child variant", async () => {
    mockClient({
      nextIndex: 0,
      passItem: { id: passId, parent_id: "parent-pass", metadata: { option_values: { type: "basic" } } },
      members: [
        { reservable_catalog_item_id: "parentA", sort_order: 0, created_at: "2026-01-01" },
        { reservable_catalog_item_id: "parentB", sort_order: 1, created_at: "2026-01-02" },
      ],
      memberItems: [
        { id: "parent-pass" },
        {
          id: "parentA",
          status: "active",
          availability_mode: "manual",
          availability_status: "unavailable",
        },
        {
          id: "childA",
          parent_id: "parentA",
          kind: "service",
          is_reservation: true,
          status: "active",
          availability_mode: "always",
          availability_status: "available",
          metadata: { option_values: { type: "basic" } },
        },
        { id: "parentB", status: "active", availability_mode: "always", availability_status: "available" },
        {
          id: "childB",
          parent_id: "parentB",
          kind: "service",
          is_reservation: true,
          status: "active",
          availability_mode: "always",
          availability_status: "available",
          metadata: { option_values: { type: "basic" } },
        },
      ],
    })
    const assigned = await pickNextRedeemableService({
      passCatalogItemId: passId,
      siteId,
      startIso: "2026-08-14T10:00:00Z",
      endIso: "2026-08-14T11:00:00Z",
      quantity: 1,
    })
    expect(assigned).toBe("childB")
  })

  it("skips a child whose parent is archived when the child is linked directly", async () => {
    mockClient({
      nextIndex: 0,
      members: [
        { reservable_catalog_item_id: "childA", sort_order: 0, created_at: "2026-01-01" },
        { reservable_catalog_item_id: "childB", sort_order: 1, created_at: "2026-01-02" },
      ],
      memberItems: [
        { id: "parentA", status: "archived" },
        {
          id: "childA",
          parent_id: "parentA",
          kind: "service",
          is_reservation: true,
          status: "active",
          availability_mode: "always",
          availability_status: "available",
        },
        { id: "parentB", status: "active" },
        {
          id: "childB",
          parent_id: "parentB",
          kind: "service",
          is_reservation: true,
          status: "active",
          availability_mode: "always",
          availability_status: "available",
        },
      ],
    })
    const assigned = await pickNextRedeemableService({
      passCatalogItemId: passId,
      siteId,
      startIso: "2026-08-14T10:00:00Z",
      endIso: "2026-08-14T11:00:00Z",
      quantity: 1,
    })
    expect(assigned).toBe("childB")
  })
})
