import { createDemoMockClientImpl } from "@/lib/demo-data/mock-client-impl"

describe("demo mock client", () => {
  it("returns demo sites from get_my_accessible_sites", async () => {
    const client = await createDemoMockClientImpl("demo-saas-en-123")
    const { data, error } = await client.rpc("get_my_accessible_sites", {})
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
    expect(data.some((site: { id: string }) => site.id === "demo-saas-en-123")).toBe(true)
  })

  it("supports chained update filters used by buyer reservation completion", async () => {
    const client = await createDemoMockClientImpl("demo-saas-en-123")
    const past = new Date(Date.now() - 60_000).toISOString()
    await client.from("reservations").insert({
      id: "res-1",
      buyer_user_id: "demo-user-123",
      status: "confirmed",
      end_time: past,
    })

    const { error } = await client
      .from("reservations")
      .update({ status: "completed" })
      .eq("buyer_user_id", "demo-user-123")
      .in("status", ["pending", "confirmed"])
      .lt("end_time", new Date().toISOString())

    expect(error).toBeNull()

    const { data } = await client.from("reservations").select("*").eq("id", "res-1")
    expect(data[0].status).toBe("completed")
  })

  it("embeds record categories and filters catalog variants with not()", async () => {
    const habituall = await createDemoMockClientImpl("demo-habituall")
    const { data: records } = await habituall
      .from("records")
      .select("*, category:record_categories(*)")
      .eq("id", "rec-hab-1")

    expect(records[0].title).toContain("Yoga")
    expect(records[0].category?.name).toBe("Class attendance")

    const ecom = await createDemoMockClientImpl("demo-ecom-es-456")
    const { data: variants } = await ecom
      .from("catalog_items")
      .select("*")
      .not("parent_id", "is", null)

    expect(variants.length).toBeGreaterThan(0)
    expect(variants.every((item: { parent_id: string | null }) => item.parent_id != null)).toBe(true)
  })

  it("returns a single settings row with context fields", async () => {
    const client = await createDemoMockClientImpl("demo-ecom-es-456")
    const { data, error } = await client
      .from("settings")
      .select("*")
      .eq("site_id", "demo-ecom-es-456")
      .single()

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(false)
    expect(data.about).toContain("Moda Rápida")
    expect(data.branding.brand_essence).toBeTruthy()
    expect(data.shop.hero_title).toBeTruthy()
    expect(data.commerce).toBeTruthy()
  })

  it("filters journal lines through journal_entries embeds", async () => {
    const client = await createDemoMockClientImpl("demo-ecom-es-456")
    const fromDate = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10)
    const toDate = new Date().toISOString().slice(0, 10)
    const { data, error } = await client
      .from("journal_lines")
      .select("account_code, debit, credit, journal_entries!inner(entry_date, source_type, site_id)")
      .eq("journal_entries.site_id", "demo-ecom-es-456")
      .gte("journal_entries.entry_date", fromDate)
      .lte("journal_entries.entry_date", toDate)
      .neq("journal_entries.source_type", "opening")

    expect(error).toBeNull()
    expect(data.length).toBeGreaterThan(0)
    expect(data.some((line: { account_code: string; credit: number }) => line.account_code === "4000" && line.credit > 0)).toBe(true)
    expect(data.every((line: { journal_entries: { site_id: string } }) => line.journal_entries.site_id === "demo-ecom-es-456")).toBe(true)
  })

  it("loads workflow nodes with type in() filter", async () => {
    const client = await createDemoMockClientImpl("demo-ecom-es-456")
    const { data } = await client
      .from("instance_nodes")
      .select("*")
      .eq("instance_id", "remote-ecom-1")
      .in("type", ["wf-trigger", "wf-step", "wf-condition"])

    expect(data.some((node: { type: string }) => node.type === "wf-trigger")).toBe(true)
    expect(data.filter((node: { type: string }) => node.type === "wf-step").length).toBeGreaterThan(0)
    expect(data.every((node: { type: string }) => node.type.startsWith("wf-"))).toBe(true)
  })

  it("keeps exact counts before applying a page range", async () => {
    const client = await createDemoMockClientImpl("demo-ecom-es-456")
    const { data, count } = await client
      .from("sale_order_item_units")
      .select("*", { count: "exact" })
      .eq("site_id", "demo-ecom-es-456")
      .range(0, 0)

    expect(data).toHaveLength(1)
    expect(count).toBeGreaterThan(1)
  })

  it("updates quantity-split units independently through the mutation RPC", async () => {
    const client = await createDemoMockClientImpl("demo-ecom-es-456")
    const { data: units } = await client
      .from("sale_order_item_units")
      .select("*")
      .eq("site_id", "demo-ecom-es-456")
    const grouped = new Map<string, any[]>()
    for (const unit of units) {
      const group = grouped.get(unit.sale_order_item_id) || []
      group.push(unit)
      grouped.set(unit.sale_order_item_id, group)
    }
    const pair = [...grouped.values()].find(
      (group) =>
        group.length > 1 &&
        ["draft", "new", "pending"].includes(group[0].status),
    )
    expect(pair).toBeDefined()

    const { data: updated, error } = await client.rpc(
      "mutate_sale_order_item_units",
      {
        p_site_id: "demo-ecom-es-456",
        p_unit_ids: [pair![0].id],
        p_operation: "set_status",
        p_status: "preparing",
      },
    )

    expect(error).toBeNull()
    expect(updated).toBe(1)
    expect(pair![0].status).toBe("preparing")
    expect(pair![0].in_progress_at).toBeTruthy()
    expect(pair![0].ready_at).toBeNull()
    expect(["draft", "new", "pending"]).toContain(pair![1].status)

    const advanced = await client.rpc("mutate_sale_order_item_units", {
      p_site_id: "demo-ecom-es-456",
      p_unit_ids: [pair![0].id],
      p_operation: "advance",
      p_status: JSON.stringify({ [pair![0].id]: "completed" }),
    })
    expect(advanced.error).toBeNull()
    expect(pair![0].status).toBe("completed")
    expect(pair![0].ready_at).toBeTruthy()
  })

  it("cascades parent order-item statuses to every operational unit", async () => {
    const client = await createDemoMockClientImpl("demo-ecom-es-456")
    const { data: units } = await client
      .from("sale_order_item_units")
      .select("*")
      .eq("site_id", "demo-ecom-es-456")
    const itemId = units[0].sale_order_item_id

    await client
      .from("sale_order_items")
      .update({ status: "cancelled" })
      .eq("id", itemId)

    const { data: updatedUnits } = await client
      .from("sale_order_item_units")
      .select("*")
      .eq("sale_order_item_id", itemId)
    expect(updatedUnits.every((unit: any) => unit.status === "cancelled")).toBe(
      true,
    )
  })

  it("creates, resizes, and removes demo operational units with parent items", async () => {
    const client = await createDemoMockClientImpl("demo-ecom-es-456")
    await client.from("sale_order_items").insert({
      id: "demo-runtime-line",
      site_id: "demo-ecom-es-456",
      sale_order_id: "so-ecom-web-2",
      name: "Runtime product",
      quantity: 2,
      status: "new",
      created_at: new Date().toISOString(),
    })

    let result = await client
      .from("sale_order_item_units")
      .select("*")
      .eq("sale_order_item_id", "demo-runtime-line")
    expect(result.data).toHaveLength(2)

    await client
      .from("sale_order_items")
      .update({ quantity: 1 })
      .eq("id", "demo-runtime-line")
    result = await client
      .from("sale_order_item_units")
      .select("*")
      .eq("sale_order_item_id", "demo-runtime-line")
    expect(result.data).toHaveLength(1)

    await client.from("sale_order_items").insert({
      id: "demo-runtime-modifier",
      site_id: "demo-ecom-es-456",
      sale_order_id: "so-ecom-web-2",
      parent_sale_order_item_id: "demo-runtime-line",
      name: "Runtime modifier",
      quantity: 1,
      status: "new",
      created_at: new Date().toISOString(),
    })
    await client.from("sale_order_items").delete().eq("id", "demo-runtime-line")
    result = await client
      .from("sale_order_item_units")
      .select("*")
      .eq("sale_order_item_id", "demo-runtime-line")
    expect(result.data).toHaveLength(0)
    const modifiers = await client
      .from("sale_order_items")
      .select("*")
      .eq("id", "demo-runtime-modifier")
    expect(modifiers.data).toHaveLength(0)
  })
})


