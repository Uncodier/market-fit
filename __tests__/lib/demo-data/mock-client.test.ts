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
})
