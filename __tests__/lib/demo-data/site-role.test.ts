import { createDemoMockClient } from "@/lib/demo-data/mock-client"
import { getDemoSiteRole } from "@/lib/demo-data/site-role"

const demoIds = ["demo-habituall", "demo-saas-en-123", "demo-ecom-es-456"]

describe("demo site role isolation", () => {
  it.each(demoIds)("resolves the seeded owner's role for %s", async (siteId) => {
    const client = createDemoMockClient(siteId)
    await expect(client.rpc("current_user_site_role", { p_site_id: siteId }))
      .resolves.toEqual({ data: "owner", error: null })
  })

  it.each(demoIds)("rejects foreign sites from %s", async (siteId) => {
    const client = createDemoMockClient(siteId)
    for (const foreignId of [...demoIds.filter((id) => id !== siteId), "11111111-1111-4111-8111-111111111111"]) {
      await expect(client.rpc("current_user_site_role", { p_site_id: foreignId }))
        .resolves.toEqual({ data: null, error: null })
    }
  })

  it.each([undefined, null, {}, { p_site_id: "" }, { p_site_id: 123 }])(
    "rejects missing or malformed site parameters: %p", async (params) => {
      await expect(createDemoMockClient("demo-habituall").rpc("current_user_site_role", params))
        .resolves.toEqual({ data: null, error: null })
    },
  )

  it("does not authenticate an unknown demo", async () => {
    const client = createDemoMockClient("demo-missing")
    expect((await client.auth.getUser()).data.user).toBeUndefined()
    await expect(client.rpc("current_user_site_role", { p_site_id: "demo-missing" }))
      .resolves.toEqual({ data: null, error: null })
  })

  it("resolves an active member without granting ownership", () => {
    const data = {
      sites: [{ id: "demo-members", user_id: "owner" }],
      site_members: [{ site_id: "demo-members", user_id: "member", role: "collaborator", status: "active" }],
    }
    expect(getDemoSiteRole(data, "demo-members", "member", "demo-members")).toBe("collaborator")
    expect(getDemoSiteRole(data, "demo-members", "stranger", "demo-members")).toBeNull()
    expect(getDemoSiteRole(data, "demo-members", null, "demo-members")).toBeNull()
  })

  it.each([undefined, "pending", "inactive"])("rejects a member with status %s", (status) => {
    expect(getDemoSiteRole({
      sites: [{ id: "demo-members", user_id: "owner" }],
      site_members: [{ site_id: "demo-members", user_id: "member", role: "admin", status }],
    }, "demo-members", "member", "demo-members")).toBeNull()
  })

  it("recognizes co-ownership but rejects archived and missing sites", () => {
    const data = {
      sites: [{ id: "demo-owned", user_id: "owner", archived_at: null as string | null }],
      site_ownership: [{ site_id: "demo-owned", user_id: "co-owner" }],
    }
    expect(getDemoSiteRole(data, "demo-owned", "co-owner", "demo-owned")).toBe("owner")
    data.sites[0].archived_at = new Date().toISOString()
    expect(getDemoSiteRole(data, "demo-owned", "co-owner", "demo-owned")).toBeNull()
    expect(getDemoSiteRole({}, "demo-owned", "owner", "demo-owned")).toBeNull()
  })
})