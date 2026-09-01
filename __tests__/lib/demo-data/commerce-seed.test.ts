import { getDemoData } from "@/lib/demo-data"

describe("demo commerce seed", () => {
  it("fills HabitUall catalog, records, reservations, and commerce settings", async () => {
    const data = await getDemoData("demo-habituall")
    expect(data?.catalog_items?.length).toBeGreaterThan(0)
    expect(data?.catalog_items.some((item: { is_reservation: boolean }) => item.is_reservation)).toBe(true)
    expect(data?.record_categories?.length).toBeGreaterThan(0)
    expect(data?.records?.length).toBeGreaterThan(0)
    expect(data?.records?.every((record: { status: string }) =>
      ["draft", "published", "archived"].includes(record.status)
    )).toBe(true)
    expect(data?.reservations?.length).toBeGreaterThan(0)
    expect(data?.locations?.some((location: { is_default: boolean }) => location.is_default)).toBe(true)
    expect(data?.settings?.[0]?.commerce).toBeTruthy()
    expect(data?.settings?.[0]?.visits?.enabled_physical).toBe(true)
    expect(data?.settings?.[0]?.about).toContain("HabitUall")
    expect(data?.settings?.[0]?.branding?.brand_essence).toBeTruthy()
    expect(data?.sites?.[0]?.description).toContain("Coworking")
    expect(data?.copywriting?.length).toBeGreaterThan(0)
  })

  it("fills SaaS plans, quotations, subscriptions, and records", async () => {
    const data = await getDemoData("demo-saas-en-123")
    expect(data?.catalog_items?.some((item: { is_recurring: boolean }) => item.is_recurring)).toBe(true)
    expect(data?.quotations?.length).toBeGreaterThan(0)
    expect(data?.quotation_items?.length).toBeGreaterThan(0)
    expect(data?.subscriptions?.length).toBeGreaterThan(0)
    expect(data?.record_categories?.some((category: { name: string }) => category.name.includes("Implementation"))).toBe(true)
    expect(data?.records?.length).toBeGreaterThan(0)
    expect(data?.inventory_levels).toBeUndefined()
    expect(data?.settings?.[0]?.industry).toBe("B2B SaaS")
    expect(data?.settings?.[0]?.goals?.quarterly).toBeTruthy()
    expect(data?.copywriting?.length).toBeGreaterThan(0)
  })

  it("fills ecommerce products, inventory, promotions, orders, and shipments", async () => {
    const data = await getDemoData("demo-ecom-es-456")
    expect(data?.catalog_items?.some((item: { parent_id: string | null }) => item.parent_id)).toBe(true)
    expect(data?.inventory_levels?.length).toBeGreaterThan(0)
    expect(data?.promotions?.some((promo: { status: string }) => promo.status === "active")).toBe(true)
    expect(data?.sale_orders?.every((order: { status: string }) =>
      ["pending", "in_progress", "completed", "cancelled"].includes(order.status)
    )).toBe(true)
    expect(data?.sale_orders?.length).toBeGreaterThan(0)
    expect(data?.sale_order_items?.length).toBeGreaterThan(0)
    expect(data?.shipments?.length).toBeGreaterThan(0)
    expect(data?.records?.some((record: { title: string }) => record.title.toLowerCase().includes("return") || record.title.toLowerCase().includes("dress") || record.title.toLowerCase().includes("belt"))).toBe(true)
    expect(data?.settings?.[0]?.shop?.hero_title).toBeTruthy()
    expect(data?.settings?.[0]?.social_media?.length).toBeGreaterThan(0)
    expect(data?.copywriting?.length).toBeGreaterThan(0)
    expect(data?.accounting_accounts?.some((account: { code: string }) => account.code === "4000")).toBe(true)
    expect(data?.journal_entries?.length).toBeGreaterThan(0)
    expect(data?.journal_lines?.some((line: { account_code: string; credit: number }) => line.account_code === "4000" && line.credit > 0)).toBe(true)
    const lastMonth = new Date()
    lastMonth.setDate(lastMonth.getDate() - 30)
    const recent = (data?.journal_entries || []).filter((entry: { entry_date: string }) => entry.entry_date >= lastMonth.toISOString().slice(0, 10))
    expect(recent.length).toBeGreaterThan(0)
  })

  it.each([
    ["demo-habituall", "wf-hab-trigger-1"],
    ["demo-saas-en-123", "wf-saas-trigger-1"],
    ["demo-ecom-es-456", "wf-ecom-trigger-1"],
  ] as const)("seeds workflow trigger and steps for %s", async (siteId, triggerId) => {
    const data = await getDemoData(siteId)
    const nodes = data?.instance_nodes || []
    expect(nodes.some((node: { type: string; id: string }) => node.type === "wf-trigger" && node.id === triggerId)).toBe(true)
    expect(nodes.filter((node: { type: string }) => node.type === "wf-step").length).toBeGreaterThan(0)
  })
})

