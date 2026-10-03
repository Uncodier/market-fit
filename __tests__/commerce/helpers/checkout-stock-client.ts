export type StockItem = {
  id: string
  site_id: string
  name: string
  status: string
  availability_mode: string
  availability_status?: string
  track_inventory?: boolean
  parent_id?: string | null
  is_purchasable?: boolean
  currency: string
}

export function stockItem(id = "sku", overrides: Partial<StockItem> = {}): StockItem {
  return {
    id, site_id: "site", name: id, status: "active", availability_mode: "inventory",
    currency: "USD", ...overrides,
  }
}

export type StockFixture = {
  items: StockItem[]
  settings: { commerce?: { stock_shortage_policy?: string | null } | null } | null
  levels: { site_id: string; catalog_item_id: string; location_id: string; quantity: unknown }[]
  settingsError?: boolean
  inventoryError?: boolean
  inventoryMissing?: boolean
  variantError?: boolean
  childCount?: number
}

export function stockFixture(quantity: unknown = 5): StockFixture {
  return {
    items: [stockItem()],
    settings: { commerce: { stock_shortage_policy: "allow" } },
    levels: [{ site_id: "site", catalog_item_id: "sku", location_id: "origin", quantity }],
  }
}

export function checkoutStockClient(fixture: StockFixture) {
  const reads: { table: string; filters: Record<string, unknown> }[] = []
  const from = jest.fn((table: string) => {
    const filters: Record<string, unknown> = {}
    let head = false
    const result = () => {
      reads.push({ table, filters: { ...filters } })
      const error = { message: "Database unavailable" }
      if (table === "settings") {
        return { data: fixture.settings, error: fixture.settingsError ? error : null }
      }
      if (table === "catalog_items") {
        if (head) return { data: null, count: fixture.childCount || 0, error: fixture.variantError ? error : null }
        return { data: fixture.items.find((item) => item.id === filters.id &&
          (!filters.site_id || item.site_id === filters.site_id)) || null, error: null }
      }
      if (table === "inventory_levels") {
        return {
          data: fixture.inventoryMissing ? null : fixture.levels.filter((level) =>
            Object.entries(filters).every(([key, value]) => level[key as keyof typeof level] === value)),
          error: fixture.inventoryError ? error : null,
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    }
    const query = {
      select: (_columns?: string, options?: { head?: boolean }) => {
        head = Boolean(options?.head)
        return query
      },
      eq: (key: string, value: unknown) => { filters[key] = value; return query },
      single: async () => result(),
      maybeSingle: async () => result(),
      then: <T>(resolve: (value: ReturnType<typeof result>) => T) => Promise.resolve(result()).then(resolve),
    }
    return query
  })
  return { from, reads }
}