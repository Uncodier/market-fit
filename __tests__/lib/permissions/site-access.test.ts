import { userCanOnSite } from "@/lib/permissions/site-access"

describe("userCanOnSite", () => {
  it("returns true only when the RPC returns true", async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
    }
    await expect(userCanOnSite(supabase, "site-1", "delete")).resolves.toBe(true)
    expect(supabase.rpc).toHaveBeenCalledWith("user_can", {
      p_site_id: "site-1",
      p_command: "delete",
    })
  })

  it("fails closed on RPC errors", async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: true, error: { message: "boom" } }),
    }
    await expect(userCanOnSite(supabase, "site-1", "delete")).resolves.toBe(false)
  })
})
