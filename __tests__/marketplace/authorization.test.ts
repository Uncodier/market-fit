/** @jest-environment node */
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn() }))
import { createClient } from "@/lib/supabase/server"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { authorizeMarketplaceResource } from "@/lib/marketplace/authorization"

describe("marketplace operator authorization", () => {
  const resource = { id: "order-id", site_id: "trusted-site", marketplace_integration_id: "connection-id", metadata: { marketplace: {} } }
  function client(user: unknown, row: unknown = resource) {
    const query = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn(async () => ({ data: row, error: null })) }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    return { from: jest.fn(() => query), auth: { getUser: jest.fn(async () => ({ data: { user }, error: null })) } }
  }
  beforeEach(() => { jest.clearAllMocks() })

  it("denies anonymous callers before accessing order data", async () => {
    const database = client(null)
    jest.mocked(createClient).mockResolvedValue(database)
    await expect(authorizeMarketplaceResource(new Request("https://orders.example.test/action"), "sale_orders", "order-id"))
      .rejects.toMatchObject({ status: 401 })
    expect(database.from).not.toHaveBeenCalled()
  })
  it("does not disclose cross-tenant resources hidden by RLS", async () => {
    jest.mocked(createClient).mockResolvedValue(client({ id: "actor" }, null))
    await expect(authorizeMarketplaceResource(new Request("https://orders.example.test/action"), "sale_orders", "foreign-id"))
      .rejects.toMatchObject({ status: 404 })
    expect(requireSiteAccess).not.toHaveBeenCalled()
  })
  it("requires the trusted site's mutation capability, not just login", async () => {
    jest.mocked(createClient).mockResolvedValue(client({ id: "actor" }))
    const rpc = jest.fn(async () => ({ data: false, error: null }))
    jest.mocked(requireSiteAccess).mockResolvedValue({
      role: "marketing", userId: "actor", userEmail: null, supabase: { rpc },
    })
    await expect(authorizeMarketplaceResource(new Request("https://orders.example.test/action"), "sale_orders", "order-id"))
      .rejects.toMatchObject({ status: 403 })
    expect(rpc).toHaveBeenCalledWith("user_can", { p_site_id: "trusted-site", p_command: "update" })
  })
})