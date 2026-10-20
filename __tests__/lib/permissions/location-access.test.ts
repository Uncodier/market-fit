import { readLocationAccess, restrictedLocationIdsSchema, userCanOnLocation } from "@/lib/permissions/location-access"

const siteId = "00000000-0000-4000-8000-000000000001"
const locationId = "00000000-0000-4000-8000-000000000002"
const scope = { site_id: siteId, role: "collaborator", restricted_location_ids: [], revision: 0 }

describe("authenticated location authorization", () => {
  it("accepts a verified empty list without fabricating permissions", async () => {
    const client = { rpc: jest.fn().mockResolvedValue({ data: scope, error: null }) }
    await expect(readLocationAccess(client, siteId)).resolves.toEqual(scope)
    expect(client.rpc).toHaveBeenCalledWith("current_user_location_access", { p_site_id: siteId })
  })

  it.each([
    null, {}, { ...scope, restricted_location_ids: null }, { ...scope, role: "unknown" },
    { ...scope, site_id: locationId }, { ...scope, restricted_location_ids: ["demo-location"] },
    { ...scope, revision: undefined }, { ...scope, revision: -1 },
  ])("denies invalid or cross-site permission responses: %j", async data => {
    await expect(readLocationAccess({ rpc: jest.fn().mockResolvedValue({ data, error: null }) }, siteId)).resolves.toBeNull()
  })

  it("never converts RPC errors, exceptions, or invalid identity into an empty scope", async () => {
    await expect(readLocationAccess({ rpc: jest.fn().mockResolvedValue({ data: scope, error: {} }) }, siteId)).resolves.toBeNull()
    const rpc = jest.fn().mockRejectedValue(new Error("Unavailable"))
    await expect(readLocationAccess({ rpc }, siteId)).resolves.toBeNull()
    rpc.mockClear()
    await expect(readLocationAccess({ rpc }, "demo-site")).resolves.toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })

  it("composes action and location permission with AND", async () => {
    const rpc = jest.fn().mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: true, error: null })
    await expect(userCanOnLocation({ rpc }, siteId, locationId, "update")).resolves.toBe(true)
    expect(rpc.mock.calls).toEqual([
      ["user_can", { p_site_id: siteId, p_command: "update" }],
      ["user_can_access_location", { p_site_id: siteId, p_location_id: locationId }],
    ])
  })

  it("does not use location permission to elevate a viewer", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: false, error: null })
    await expect(userCanOnLocation({ rpc }, siteId, locationId, "insert")).resolves.toBe(false)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it.each([false, null, "true", 1])("requires a strict true location result: %j", async data => {
    const rpc = jest.fn().mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data, error: null })
    await expect(userCanOnLocation({ rpc }, siteId, locationId, "select")).resolves.toBe(false)
  })

  it("delegates null scope compatibility to the database, never guessing a branch", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: true, error: null })
    await expect(userCanOnLocation({ rpc }, siteId, null, "select")).resolves.toBe(true)
    expect(rpc).toHaveBeenLastCalledWith("user_can_access_location", { p_site_id: siteId, p_location_id: null })
  })

  it("denies lookup failures and malformed IDs", async () => {
    const rpc = jest.fn().mockRejectedValue(new Error("Offline"))
    await expect(userCanOnLocation({ rpc }, siteId, locationId, "select")).resolves.toBe(false)
    rpc.mockClear()
    await expect(userCanOnLocation({ rpc }, siteId, "all", "select")).resolves.toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("distinguishes valid clearing from invalid or duplicate restrictions", () => {
    expect(restrictedLocationIdsSchema.safeParse([]).success).toBe(true)
    for (const ids of [null, undefined, "[]", [locationId, locationId], ["unknown"]]) {
      expect(restrictedLocationIdsSchema.safeParse(ids).success).toBe(false)
    }
    const mixedCase = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    expect(restrictedLocationIdsSchema.safeParse([mixedCase, mixedCase.toUpperCase()]).success).toBe(false)
  })
})