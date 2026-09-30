import type { Payment } from "@/app/types"
import type { SiteMemberRole } from "@/lib/permissions/types"

export const siteId = "00000000-0000-4000-8000-000000000001"
export const purchaseId = "00000000-0000-4000-8000-000000000002"
export const userId = "00000000-0000-4000-8000-000000000003"
export const foreignSiteId = "00000000-0000-4000-8000-000000000004"
export const locationId = "00000000-0000-4000-8000-000000000005"
export const catalogItemId = "00000000-0000-4000-8000-000000000006"

type Row = ReturnType<typeof purchaseRow>
type QueryResult = { data: unknown; error: { message: string } | null; count?: number }
type Query = {
  select: jest.Mock; eq: jest.Mock; update: jest.Mock; insert: jest.Mock; delete: jest.Mock
  single: jest.Mock; maybeSingle: jest.Mock; range: jest.Mock; order: jest.Mock; ilike: jest.Mock
  then: (resolve: (result: QueryResult) => unknown) => Promise<unknown>
}

export function purchaseRow() {
  return {
    id: purchaseId, site_id: siteId, user_id: userId, title: "Vendor bill", status: "pending",
    amount: 100, amount_due: 100, payments: [] as Payment[], accounting_state: "pending",
    location_id: locationId, stock_received: false, updated_at: "2026-09-01T00:00:00.000Z",
    purchase_items: [{
      id: catalogItemId, purchase_id: purchaseId, site_id: siteId, catalog_item_id: catalogItemId,
      name: "Materials", quantity: 2, unit_cost: 50, subtotal: 100,
      catalog_items: { id: catalogItemId, name: "Materials", kind: "product" },
    }],
    site: { id: siteId, name: "Test site" },
  }
}

export function purchaseClient(options: {
  role?: SiteMemberRole; active?: boolean; memberSiteId?: string; row?: Partial<Row>
  missingReferences?: string[]
} = {}) {
  const row = { ...purchaseRow(), ...options.row }
  const events: string[] = []
  const writes: { table: string; operation: string; data: unknown }[] = []
  const queries: { table: string; columns: string; filters: Record<string, unknown> }[] = []
  const role = options.role ?? "owner"
  const auth = {
    getUser: jest.fn(async (): Promise<{
      data: { user: { id: string } | null }; error: { message: string } | null
    }> => {
      events.push("auth")
      return { data: { user: { id: userId } }, error: null }
    }),
    getSession: jest.fn(async () => ({ data: { session: { user: { id: userId } } } })),
  }
  const client = {
    _isDemo: false,
    auth,
    from: jest.fn((table: string) => {
      const query = { table, columns: "", filters: {} as Record<string, unknown> }
      queries.push(query)
      let operation = "select"
      let payload: unknown
      const result = (single = false): QueryResult => {
        if (table === "purchases") {
          const found = (query.filters.site_id === undefined || query.filters.site_id === row.site_id)
            && (query.filters.id === undefined || query.filters.id === row.id)
          if (operation === "update" && found) Object.assign(row, payload)
          return { data: single ? (found ? row : null) : (found ? [row] : []), count: found ? 1 : 0, error: null }
        }
        if (table === "inventory_levels") return { data: null, error: null }
        const exists = !options.missingReferences?.includes(table)
          && (table === "companies" ? query.filters.site_id === undefined : query.filters.site_id === siteId)
        return { data: exists ? { id: query.filters.id } : null, error: null }
      }
      const write = (kind: string, data: unknown) => {
        operation = kind
        payload = data
        events.push(`write:${table}:${kind}`)
        writes.push({ table, operation: kind, data })
        return chain
      }
      const chain: Query = {
        select: jest.fn((columns: string) => { query.columns = columns; return chain }),
        eq: jest.fn((key: string, value: unknown) => { query.filters[key] = value; return chain }),
        update: jest.fn((data: unknown) => write("update", data)),
        insert: jest.fn((data: unknown) => write("insert", data)),
        delete: jest.fn(() => write("delete", null)),
        single: jest.fn(async () => result(true)),
        maybeSingle: jest.fn(async () => result(true)),
        range: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), ilike: jest.fn().mockReturnThis(),
        then: resolve => Promise.resolve(result()).then(resolve),
      }
      return chain
    }),
    rpc: jest.fn(async (name: string, args: Record<string, unknown>): Promise<{
      data: boolean | null; error: { message: string } | null
    }> => {
      if (name === "user_can") {
        events.push(`can:${args.p_command}`)
        const allowed = options.active !== false && args.p_site_id === (options.memberSiteId ?? siteId)
          && (args.p_command === "select" || role === "owner" || role === "admin"
            || (role === "collaborator" && ["insert", "update"].includes(String(args.p_command))))
        return { data: allowed, error: null }
      }
      events.push(`write:rpc:${name}`)
      writes.push({ table: name, operation: "rpc", data: args })
      return { data: null, error: null }
    }),
  }
  return { client, row, writes, queries, events }
}