import {
  canCommand,
  resetPermissionStore,
  setPermissionStore,
} from "@/lib/permissions/capabilities"
import { wrapSupabaseClient } from "@/lib/permissions/mutation-guard"
import { capabilitiesFromRole } from "@/lib/permissions/capabilities"

function fakeClient(insertImpl?: () => unknown) {
  return {
    from(_table?: string) {
      return {
        insert: insertImpl || (() => Promise.resolve({ data: [{ id: 1 }], error: null })),
        update: () => Promise.resolve({ data: [{ id: 1 }], error: null }),
        delete: () => Promise.resolve({ data: null, error: null }),
      }
    },
  }
}

describe("mutation-guard", () => {
  afterEach(() => {
    resetPermissionStore()
  })

  it("blocks insert when the cached role cannot write", async () => {
    setPermissionStore({
      siteId: "site-1",
      capabilities: capabilitiesFromRole("marketing"),
      loaded: true,
    })
    expect(canCommand("insert")).toBe(false)

    const onDenied = jest.fn()
    const client = wrapSupabaseClient(fakeClient(), { onDenied })
    const result = await client.from("leads").insert({ name: "Ada" })

    expect(onDenied).toHaveBeenCalledWith("insert")
    expect(result.error?.code).toBe("42501")
    expect(result.error?.message).toBe("You don't have permission to create this.")
    expect(result.data).toBeNull()
  })

  it("maps RLS errors from allowed writes", async () => {
    setPermissionStore({
      siteId: "site-1",
      capabilities: capabilitiesFromRole("owner"),
      loaded: true,
    })

    const onDenied = jest.fn()
    const client = wrapSupabaseClient(
      fakeClient(() =>
        Promise.resolve({
          data: null,
          error: { code: "42501", message: "new row violates row-level security policy" },
        })
      ),
      { onDenied }
    )
    const result = await client.from("leads").insert({ name: "Ada" })

    expect(onDenied).toHaveBeenCalled()
    expect(result.error?.message).toBe("You don't have permission to create this.")
  })

  it("fail-opens when capabilities are not loaded", async () => {
    const insert = jest.fn(() => Promise.resolve({ data: [{ id: 1 }], error: null }))
    const client = wrapSupabaseClient(fakeClient(insert))
    const result = await client.from("leads").insert({ name: "Ada" })
    expect(insert).toHaveBeenCalled()
    expect(result.error).toBeNull()
  })

  it("does not apply the write matrix to site_members", async () => {
    setPermissionStore({
      siteId: "site-1",
      capabilities: capabilitiesFromRole("marketing"),
      loaded: true,
    })
    const insert = jest.fn(() => Promise.resolve({ data: [{ id: 1 }], error: null }))
    const client = wrapSupabaseClient(fakeClient(insert))
    const result = await client.from("site_members").insert({ email: "a@b.c" })
    expect(insert).toHaveBeenCalled()
    expect(result.error).toBeNull()
  })

  it("does not intercept select queries", async () => {
    setPermissionStore({
      siteId: "site-1",
      capabilities: capabilitiesFromRole("marketing"),
      loaded: true,
    })
    const select = jest.fn(() => Promise.resolve({ data: [{ id: "site-1" }], error: null }))
    const client = wrapSupabaseClient({
      from() {
        return { select, insert: () => Promise.resolve({ data: null, error: null }) }
      },
    })
    const result = await client.from("sites").select("*")
    expect(select).toHaveBeenCalled()
    expect(result.data).toEqual([{ id: "site-1" }])
  })
})
