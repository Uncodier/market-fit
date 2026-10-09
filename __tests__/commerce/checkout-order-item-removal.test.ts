/** @jest-environment node */
import { upsertSaleOrderItemsWithModifiers } from "@/app/commerce/checkout-order-items"

type Row = Record<string, unknown> & { id: string; status?: string }
type Operation = {
  actor: string
  table: string
  action: "insert" | "update" | "delete"
  filters: Record<string, unknown>
  payload?: Record<string, unknown>
  selection?: string
}
type Failure = { table: string; action: Operation["action"]; id?: string; message: string }

function database(items: Row[], reservations: Row[] = []) {
  const tables: Record<string, Row[]> = {
    sale_order_items: structuredClone(items),
    reservations: structuredClone(reservations),
  }
  const operations: Operation[] = []
  const failures: Failure[] = []
  const deniedIds = new Set<string>()
  let returnedStatus: string | undefined
  let allowEmptySingle = false

  const client = (actor: string) => ({
    from: jest.fn((table: string) => {
      let action: Operation["action"] = "update"
      let payload: Record<string, unknown> | undefined
      let selection: string | undefined
      const filters: Record<string, unknown> = {}
      const matches = (row: Row) => Object.entries(filters).every(([key, value]) => row[key] === value)
      const execute = () => {
        operations.push({ actor, table, action, filters: { ...filters }, payload, selection })
        const failure = failures.find((entry) => entry.table === table && entry.action === action &&
          (!entry.id || entry.id === filters.id))
        if (failure) return { data: [], error: { message: failure.message } }
        const rows = tables[table].filter((row) => matches(row) && !deniedIds.has(row.id))
        if (action === "insert") {
          const row = { ...payload, id: `inserted-${tables[table].length}` }
          tables[table].push(row)
          return { data: [row], error: null }
        }
        if (action === "delete") {
          // Model a self-FK cascade: deleting a parent would erase its modifiers.
          const deletedIds = new Set(rows.map((row) => row.id))
          tables[table] = tables[table].filter((row) => !deletedIds.has(row.id) &&
            !(table === "sale_order_items" && deletedIds.has(String(row.parent_sale_order_item_id))))
        } else {
          for (const row of rows) Object.assign(row, payload)
        }
        return {
          data: rows.map((row) => returnedStatus && action === "update"
            ? { ...row, status: returnedStatus } : { ...row }),
          error: null,
        }
      }
      const query = {
        delete: () => { action = "delete"; return query },
        update: (data: Record<string, unknown>) => { action = "update"; payload = data; return query },
        insert: (data: Record<string, unknown>) => { action = "insert"; payload = data; return query },
        eq: (key: string, value: unknown) => { filters[key] = value; return query },
        select: (columns?: string) => { selection = columns; return query },
        single: async () => {
          const result = execute()
          return {
            data: result.data[0] || null,
            error: result.error || (!allowEmptySingle && result.data.length !== 1
              ? { message: "JSON object requested, multiple (or no) rows returned" } : null),
          }
        },
        then: <T>(resolve: (value: ReturnType<typeof execute>) => T) => Promise.resolve(execute()).then(resolve),
      }
      return query
    }),
  })
  const supabase = client("user")
  const supabaseAdmin = client("admin")
  return {
    tables, operations, failures, deniedIds, supabase, supabaseAdmin,
    setReturnedStatus: (status: string) => { returnedStatus = status },
    allowEmptySingle: () => { allowEmptySingle = true },
  }
}

function item(id: string, status = "draft", parentId: string | null = null): Row {
  return {
    id, status, site_id: "site", sale_order_id: "order", catalog_item_id: `catalog-${id}`,
    parent_sale_order_item_id: parentId, quantity: 2, unit_price: 10, subtotal: 20,
    sent_at: status === "draft" ? null : "2026-10-01T12:00:00Z",
    metadata: { client_line_key: id, kitchen_note: "Keep history" },
  }
}

function save(db: ReturnType<typeof database>, existingItems: Row[], overrides: Partial<Parameters<typeof upsertSaleOrderItemsWithModifiers>[0]> = {}) {
  return upsertSaleOrderItemsWithModifiers({
    supabase: db.supabase, supabaseAdmin: db.supabaseAdmin, isAdmin: false,
    siteId: "site", orderId: "order", existingOrderId: "order", existingItems,
    processedLines: [], lines: [], intent: "draft", isFullyPaid: false, ...overrides,
  })
}

describe("checkout order-item removal persistence", () => {
  it("deletes draft modifiers before parents and scopes reservation cleanup to the site", async () => {
    const items = [item("parent"), item("modifier", "draft", "parent")]
    const db = database(items, [
      { id: "reservation", site_id: "site", sale_order_item_id: "parent" },
      { id: "other-site", site_id: "other", sale_order_item_id: "parent" },
      { id: "other-item", site_id: "site", sale_order_item_id: "unrelated" },
    ])

    await expect(save(db, items)).resolves.toEqual([])

    expect(db.tables.sale_order_items).toEqual([])
    expect(db.tables.reservations.map((row) => row.id)).toEqual(["other-site", "other-item"])
    expect(db.operations.map((operation) => [operation.actor, operation.table, operation.filters])).toEqual([
      ["user", "sale_order_items", { id: "modifier", sale_order_id: "order", site_id: "site", status: "draft" }],
      ["admin", "reservations", { sale_order_item_id: "modifier", site_id: "site" }],
      ["user", "sale_order_items", { id: "parent", sale_order_id: "order", site_id: "site", status: "draft" }],
      ["admin", "reservations", { sale_order_item_id: "parent", site_id: "site" }],
    ])
    expect(db.operations.filter((operation) => operation.table === "sale_order_items")
      .every((operation) => operation.selection === "id")).toBe(true)
  })

  it("cancels sent modifiers before parents without deleting lifecycle or reservation history", async () => {
    const items = [item("parent", "preparing"), item("modifier", "new", "parent")]
    const reservations = [{ id: "reservation", site_id: "site", sale_order_item_id: "parent" }]
    const db = database(items, reservations)

    await save(db, items)

    expect(db.tables.sale_order_items).toEqual(items.map((row) => ({ ...row, status: "cancelled" })))
    expect(db.tables.reservations).toEqual(reservations)
    expect(db.supabaseAdmin.from).not.toHaveBeenCalled()
    expect(db.operations).toEqual(["modifier", "parent"].map((id) => ({
      actor: "user", table: "sale_order_items", action: "update", payload: { status: "cancelled" },
      filters: { id, sale_order_id: "order", site_id: "site" }, selection: "id, status",
    })))
  })

  it.each(["new", "pending", "preparing", "in_progress", "completed", "ready", "returned", "cancelled"])(
    "retains unmatched %s rows as cancellation history", async (status) => {
      const items = [item("line", status)]
      const db = database(items)
      await save(db, items)
      expect(db.tables.sale_order_items).toEqual([{ ...items[0], status: "cancelled" }])
      expect(db.operations.map((operation) => operation.action)).toEqual(["update"])
    },
  )

  it("keeps a draft parent when deleting it would cascade away sent modifier history", async () => {
    const items = [item("parent"), item("sent-modifier", "new", "parent"), item("draft-modifier", "draft", "parent")]
    const db = database(items)

    await save(db, items)

    expect(db.tables.sale_order_items).toEqual(items.slice(0, 2).map((row) => ({ ...row, status: "cancelled" })))
    expect(db.operations.filter((operation) => operation.table === "sale_order_items")
      .map((operation) => [operation.filters.id, operation.action])).toEqual([
      ["sent-modifier", "update"], ["draft-modifier", "delete"], ["parent", "update"],
    ])
  })

  it("rejects draft deletion errors before privileged cleanup or parent removal", async () => {
    const items = [item("parent"), item("modifier", "draft", "parent")]
    const db = database(items)
    db.failures.push({ table: "sale_order_items", action: "delete", message: "Insufficient permissions" })

    await expect(save(db, items)).rejects.toThrow("Sale order item delete error: Insufficient permissions")
    expect(db.tables.sale_order_items).toEqual(items)
    expect(db.operations).toHaveLength(1)
    expect(db.supabaseAdmin.from).not.toHaveBeenCalled()
  })

  it("rejects cancellation errors before processing the parent", async () => {
    const items = [item("parent", "new"), item("modifier", "new", "parent")]
    const db = database(items)
    db.failures.push({ table: "sale_order_items", action: "update", message: "Status trigger failed" })

    await expect(save(db, items)).rejects.toThrow("Sale order item cancellation error: Status trigger failed")
    expect(db.tables.sale_order_items).toEqual(items)
    expect(db.operations).toHaveLength(1)
  })

  it("surfaces reservation cleanup errors instead of reporting removal success", async () => {
    const items = [item("parent"), item("modifier", "draft", "parent")]
    const db = database(items)
    db.failures.push({ table: "reservations", action: "delete", message: "Cleanup unavailable" })

    await expect(save(db, items)).rejects.toThrow("Reservation cleanup error: Cleanup unavailable")
    expect(db.tables.sale_order_items).toEqual([items[0]])
    expect(db.operations).toHaveLength(2)
  })

  it.each(["draft", "new"])("rejects silent RLS no-op removal of a %s item", async (status) => {
    const items = [item("line", status)]
    const db = database(items)
    db.deniedIds.add("line")

    await expect(save(db, items)).rejects.toThrow(status === "draft"
      ? "Sale order item delete error: JSON object requested"
      : "Sale order item cancellation error: JSON object requested")
    expect(db.tables.sale_order_items).toEqual(items)
    expect(db.supabaseAdmin.from).not.toHaveBeenCalled()
  })

  it.each(["draft", "new"])("does not treat an empty successful %s mutation response as persistence", async (status) => {
    const items = [item("line", status)]
    const db = database(items)
    db.deniedIds.add("line")
    db.allowEmptySingle()

    await expect(save(db, items)).rejects.toThrow(status === "draft"
      ? "Sale order item delete did not remove the requested item"
      : "Sale order item cancellation did not persist")
    expect(db.supabaseAdmin.from).not.toHaveBeenCalled()
  })

  it.each([
    ["draft", "site_id", "other-site"], ["draft", "sale_order_id", "other-order"],
    ["new", "site_id", "other-site"], ["new", "sale_order_id", "other-order"],
  ])("does not mutate a %s item belonging to a different %s", async (status, field, value) => {
    const items = [{ ...item("line", status), [field]: value }]
    const reservations = [{ id: "reservation", site_id: "site", sale_order_item_id: "line" }]
    const db = database(items, reservations)

    await expect(save(db, items)).rejects.toThrow()
    expect(db.tables.sale_order_items).toEqual(items)
    expect(db.tables.reservations).toEqual(reservations)
    expect(db.supabaseAdmin.from).not.toHaveBeenCalled()
  })

  it("does not delete a draft snapshot that has since been sent", async () => {
    const draft = item("line")
    const sent = item("line", "new")
    const db = database([sent])

    await expect(save(db, [draft])).rejects.toThrow("Sale order item delete error: JSON object requested")
    expect(db.tables.sale_order_items).toEqual([sent])
    expect(db.supabaseAdmin.from).not.toHaveBeenCalled()
  })

  it("verifies the returned cancellation status", async () => {
    const items = [item("line", "new")]
    const db = database(items)
    db.setReturnedStatus("new")
    await expect(save(db, items)).rejects.toThrow("Sale order item cancellation did not persist")
  })

  it("uses the selected admin client without broadening the mutation scope", async () => {
    const items = [item("line")]
    const db = database(items)
    await save(db, items, { isAdmin: true })
    expect(db.supabase.from).not.toHaveBeenCalled()
    expect(db.operations[0]).toMatchObject({
      actor: "admin", filters: { id: "line", sale_order_id: "order", site_id: "site", status: "draft" },
    })
  })

  it("does not remove matched parents or modifiers", async () => {
    const items = [item("parent"), item("modifier", "draft", "parent"), item("removed")]
    const db = database(items)
    await save(db, items, {
      processedLines: [
        { catalog_item_id: "catalog-parent", quantity: 2, client_line_key: "parent" },
        { catalog_item_id: "catalog-modifier", quantity: 2, client_line_key: "modifier", parent_client_line_key: "parent" },
      ],
    })
    expect(db.tables.sale_order_items.map((row) => row.id)).toEqual(["parent", "modifier"])
    expect(db.operations.filter((operation) => operation.action === "delete")
      .map((operation) => [operation.table, operation.filters])).toEqual([
      ["sale_order_items", { id: "removed", sale_order_id: "order", site_id: "site", status: "draft" }],
      ["reservations", { sale_order_item_id: "removed", site_id: "site" }],
    ])
  })

  it.each(["draft", "new"])("removes an unmatched %s modifier without removing its matched parent", async (status) => {
    const items = [item("parent", "preparing"), item("modifier", status, "parent")]
    const db = database(items)
    const result = await save(db, items, {
      processedLines: [{ catalog_item_id: "catalog-parent", quantity: 2, client_line_key: "parent" }],
    })

    expect(result.map((row) => row.id)).toEqual(["parent"])
    expect(db.tables.sale_order_items[0]).toMatchObject({ id: "parent", status: "preparing" })
    expect(db.tables.sale_order_items.map((row) => row.id)).toEqual(status === "draft"
      ? ["parent"] : ["parent", "modifier"])
    if (status !== "draft") {
      expect(db.tables.sale_order_items[1]).toEqual({ ...items[1], status: "cancelled" })
      expect(db.supabaseAdmin.from).not.toHaveBeenCalled()
    }
    expect(db.operations.filter((operation) => operation.table === "sale_order_items")
      .map((operation) => [operation.filters.id, operation.action])).toEqual([
      ["parent", "update"], ["modifier", status === "draft" ? "delete" : "update"],
    ])
  })

  it("does not reconcile removals for a new order", async () => {
    const items = [item("line")]
    const db = database(items)
    await save(db, items, { existingOrderId: undefined })
    expect(db.tables.sale_order_items).toEqual(items)
    expect(db.operations).toEqual([])
  })
})