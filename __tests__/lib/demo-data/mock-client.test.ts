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
})


