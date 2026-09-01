import { applyNotFilter, applySelectEmbeds, parseSelectEmbeds } from "@/lib/demo-data/mock-query"

describe("demo mock query embeds", () => {
  it("parses alias, inner, fk hint, and nested embeds", () => {
    const embeds = parseSelectEmbeds(`
      *,
      category:record_categories(*),
      sales!inner (
        status,
        leads (id, name)
      ),
      locations!origin_location_id (name),
      parent:parent_id(name)
    `)

    expect(embeds.map((embed) => embed.alias)).toEqual([
      "category",
      "sales",
      "locations",
      "parent",
    ])
    expect(embeds[0].table).toBe("record_categories")
    expect(embeds[1].inner).toBe(true)
    expect(embeds[1].nested[0]).toMatchObject({ alias: "leads", table: "leads" })
    expect(embeds[2].hint).toBe("origin_location_id")
    expect(embeds[3].hint).toBe("parent_id")
    expect(embeds[3].table).toBe("")
  })

  it("attaches belongs-to and has-many relations", () => {
    const memory = {
      records: [{ id: "r1", category_id: "c1", title: "A" }],
      record_categories: [{ id: "c1", name: "Attendance" }],
      sale_orders: [{ id: "so1", sale_id: "s1" }],
      sale_order_items: [{ id: "i1", sale_order_id: "so1", name: "Coffee" }],
      sales: [{ id: "s1", lead_id: "l1", status: "completed" }],
      leads: [{ id: "l1", name: "Ada" }],
    }

    const records = applySelectEmbeds(
      memory.records,
      "records",
      "*, category:record_categories(*)",
      memory
    )
    expect(records[0].category.name).toBe("Attendance")

    const orders = applySelectEmbeds(
      memory.sale_orders,
      "sale_orders",
      "*, sale_order_items (*), sales (status, leads (name))",
      memory
    )
    expect(orders[0].sale_order_items[0].name).toBe("Coffee")
    expect(orders[0].sales.leads.name).toBe("Ada")
  })

  it("filters parent_id with not('parent_id', 'is', null)", () => {
    const rows = [
      { id: "parent", parent_id: null },
      { id: "variant", parent_id: "parent" },
    ]
    expect(applyNotFilter(rows, "parent_id", "is", null).map((row) => row.id)).toEqual(["variant"])
  })
})
