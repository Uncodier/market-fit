import { loadStorefrontDisplay } from "../../app/commerce/storefront-display"

jest.mock("../../app/reservations/availability", () => ({
  getAvailableSlots: jest.fn().mockResolvedValue([{ available: 4, capacity: 10 }]),
}))

function mockSupabase(tables: Record<string, any>) {
  return {
    from: jest.fn((table: string) => {
      const result = tables[table]
      if (!result) {
        return chain({ data: [] })
      }
      return result
    }),
  } as any
}

function chain(resolved: any) {
  const api: any = {
    select: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    then: (resolve: any, reject: any) => Promise.resolve(resolved).then(resolve, reject),
  }
  return api
}

describe("loadStorefrontDisplay", () => {
  it("returns empty map if items are empty", async () => {
    const result = await loadStorefrontDisplay({} as any, [])
    expect(result.size).toBe(0)
  })

  it("skips db queries if no flags are set", async () => {
    const supabase = { from: jest.fn() } as any
    const result = await loadStorefrontDisplay(supabase, [{ id: "1", metadata: {} }])
    expect(supabase.from).not.toHaveBeenCalled()
    expect(result.size).toBe(0)
  })

  it("queries buyers and maps them to item", async () => {
    const mockSalesData = [
      {
        catalog_item_id: "1",
        sale_orders: { buyer_user_id: "u1", status: "completed", created_at: "2023-01-01T00:00:00Z" },
      },
    ]
    const mockProfiles = [{ id: "u1", name: "User 1", avatar_url: null }]

    const supabase = mockSupabase({
      catalog_items: chain({ data: [] }),
      sale_order_items: chain({ data: mockSalesData }),
      reservations: chain({ data: [] }),
      profiles: {
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({ data: mockProfiles }),
        }),
      },
    })

    const result = await loadStorefrontDisplay(supabase, [{ id: "1", metadata: { show_buyers: true } }])

    expect(result.get("1")).toEqual({
      buyers: mockProfiles,
      buyerCount: 1,
    })
  })

  it("excludes cancelled orders in memory", async () => {
    const mockSalesData = [
      {
        catalog_item_id: "1",
        sale_orders: { buyer_user_id: "u1", status: "cancelled", created_at: "2023-01-01T00:00:00Z" },
      },
    ]

    const supabase = mockSupabase({
      catalog_items: chain({ data: [] }),
      sale_order_items: chain({ data: mockSalesData }),
      reservations: chain({ data: [] }),
    })

    const result = await loadStorefrontDisplay(supabase, [{ id: "1", metadata: { show_buyers: true } }])
    expect(result.get("1")).toBeUndefined()
  })

  it("aggregates variant child purchases onto the parent listing", async () => {
    const mockSalesData = [
      {
        catalog_item_id: "child-1",
        sale_orders: { buyer_user_id: "u2", status: "completed", created_at: "2023-02-01T00:00:00Z" },
      },
    ]
    const mockProfiles = [{ id: "u2", name: "Child Buyer", avatar_url: null }]

    const supabase = mockSupabase({
      catalog_items: chain({ data: [{ id: "child-1", parent_id: "parent-1" }] }),
      sale_order_items: chain({ data: mockSalesData }),
      reservations: chain({ data: [] }),
      profiles: {
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({ data: mockProfiles }),
        }),
      },
    })

    const result = await loadStorefrontDisplay(supabase, [
      { id: "parent-1", metadata: { show_buyers: true } },
    ])

    expect(result.get("parent-1")).toEqual({
      buyers: mockProfiles,
      buyerCount: 1,
    })
  })

  it("fills missing profile avatars from auth metadata", async () => {
    const supabase = mockSupabase({
      catalog_items: chain({ data: [] }),
      sale_order_items: chain({
        data: [
          {
            catalog_item_id: "1",
            sale_orders: { buyer_user_id: "u1", status: "completed", created_at: "2023-01-01T00:00:00Z" },
          },
        ],
      }),
      reservations: chain({ data: [] }),
      profiles: {
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: [{ id: "u1", name: null, avatar_url: null }],
          }),
        }),
      },
    })
    supabase.auth = {
      admin: {
        getUserById: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: "u1",
              email: "ada@example.com",
              user_metadata: { full_name: "Ada", picture: "https://img/ada.jpg" },
            },
          },
        }),
      },
    }

    const result = await loadStorefrontDisplay(supabase, [{ id: "1", metadata: { show_buyers: true } }])
    expect(result.get("1")).toEqual({
      buyers: [{ id: "u1", name: "Ada", avatar_url: "https://img/ada.jpg" }],
      buyerCount: 1,
    })
  })

  it("fetches next slot available for flagged reservations", async () => {
    const supabase = { from: jest.fn() } as any
    const result = await loadStorefrontDisplay(supabase, [
      { id: "2", is_reservation: true, metadata: { show_available_inventory: true } },
    ])

    expect(result.get("2")).toEqual({ nextSlotAvailable: 4, nextSlotCapacity: 10 })
  })

  it("sums sold ticket quantity from completed orders", async () => {
    const supabase = mockSupabase({
      catalog_items: chain({ data: [] }),
      sale_order_items: chain({
        data: [
          { catalog_item_id: "1", quantity: 2, sale_orders: { status: "completed" } },
          { catalog_item_id: "1", quantity: 1, sale_orders: { status: "cancelled" } },
        ],
      }),
    })

    const result = await loadStorefrontDisplay(supabase, [
      { id: "1", metadata: { show_available_inventory: true } },
    ])

    expect(result.get("1")).toEqual({ soldQty: 2 })
  })
})
