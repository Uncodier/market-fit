import { adaptSiteToForm } from "@/app/components/settings/data-adapter"
import type { Site } from "@/app/context/site-types"

describe("settings form adapter defaults", () => {
  it("normalizes persisted optional fields without resetting explicit values", () => {
    const site: Site = {
      id: "site-1", name: "Shop", url: "https://example.test", user_id: "user-1",
      description: "", logo_url: "", created_at: "2026-09-01", updated_at: "2026-09-01", resource_urls: [],
      settings: {
        team_members: [{ email: "sam@example.test", role: "view", blocked_screens: ["payments"] }],
        channels: { connections: [{ id: "channel-1", type: "whatsapp", status: "connected" }] },
        printers: { devices: [{ id: "printer-1", name: "Printer", transport: "system", paperWidthMm: 80,
          copies: 1, modules: { pos: true, orders: false, inventory: false },
          autoPrint: { posReceipt: true, kitchenTicket: false, orderDelta: false, inventoryLabel: false } }] },
      },
      billing: { plan: "engine", auto_renew: false },
    }
    const adapted = adaptSiteToForm(site)
    expect(adapted.billing).toMatchObject({ plan: "engine", auto_renew: false, addons_count: 0 })
    expect(adapted.channels.connections[0]).toMatchObject({ id: "channel-1", name: "" })
    expect(adapted.printers.devices[0].enabled).toBe(true)
    expect(adapted.team_members[0].blocked_screens).toEqual(["payments"])
  })
})