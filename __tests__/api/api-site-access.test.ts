import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { createClient } from "@/lib/supabase/server"

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

function requestWithCookie(hasCookie = true) {
  return {
    headers: {
      get: jest.fn((name: string) =>
        hasCookie && name.toLowerCase() === "cookie"
          ? "sb-access-token=test"
          : null
      ),
    },
  } as unknown as Request
}

function userClient(user: unknown, role: unknown, roleError: unknown = null) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    rpc: jest.fn().mockImplementation(async (name: string) => ({
      data: name === "current_user_site_role" ? role : false,
      error: roleError,
    })),
  }
}

describe("site API access", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("rejects missing credentials before creating a user client", async () => {
    const result = await requireSiteAccess(
      requestWithCookie(false),
      "00000000-0000-4000-8000-000000000001"
    )

    expect(result.error?.status).toBe(401)
    expect(createClient).not.toHaveBeenCalled()
  })

  it("rejects unauthenticated credentials", async () => {
    ;(createClient as jest.Mock).mockResolvedValue(userClient(null, null))

    const result = await requireSiteAccess(
      requestWithCookie(),
      "00000000-0000-4000-8000-000000000001"
    )

    expect(result.error?.status).toBe(401)
  })

  it("rejects a user without access to the requested tenant", async () => {
    ;(createClient as jest.Mock).mockResolvedValue(
      userClient({ id: "user-1" }, null)
    )

    const result = await requireSiteAccess(
      requestWithCookie(),
      "00000000-0000-4000-8000-000000000001"
    )

    expect(result.error?.status).toBe(403)
  })

  it("recovers from a temporary membership lookup error without granting access early", async () => {
    const client = userClient({ id: "user-1" }, "owner")
    client.rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST002" }, status: 503 })
    jest.mocked(createClient).mockResolvedValue(client)
    const result = await requireSiteAccess(requestWithCookie(), "site", { allowLocationScoped: true })
    expect(result.error).toBeUndefined()
    expect(result.role).toBe("owner")
    expect(client.rpc).toHaveBeenCalledTimes(2)
  })

  it("returns unavailable, not forbidden, after repeated lookup failures", async () => {
    const client = userClient({ id: "user-1" }, null)
    client.rpc.mockResolvedValue({ data: null, error: { code: "PGRST002", message: "private detail" }, status: 503 })
    jest.mocked(createClient).mockResolvedValue(client)
    const result = await requireSiteAccess(requestWithCookie(), "site")
    expect(result.error?.status).toBe(503)
    expect(result.supabase).toBeUndefined()
    expect(await result.error?.json()).toEqual({ error: "Site access could not be verified. Please try again." })
    expect(client.rpc).toHaveBeenCalledTimes(2)
  })

  it("rejects a read-only member from manager operations", async () => {
    ;(createClient as jest.Mock).mockResolvedValue(
      userClient({ id: "user-1" }, "marketing")
    )

    const result = await requireSiteAccess(
      requestWithCookie(),
      "00000000-0000-4000-8000-000000000001",
      { requireManager: true }
    )

    expect(result.error?.status).toBe(403)
  })

  it("allows an owner to perform manager operations", async () => {
    ;(createClient as jest.Mock).mockResolvedValue(
      userClient({ id: "user-1" }, "owner")
    )

    const result = await requireSiteAccess(
      requestWithCookie(),
      "00000000-0000-4000-8000-000000000001",
      { requireManager: true }
    )

    expect(result.error).toBeUndefined()
    expect(result.role).toBe("owner")
    expect(result.userId).toBe("user-1")
  })

  it("denies scoped operations when the location authorization fails", async () => {
    const client = userClient({ id: "user-1" }, "collaborator")
    client.rpc.mockReset().mockResolvedValueOnce({ data: "collaborator", error: null })
      .mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: false, error: null })
    ;(createClient as jest.Mock).mockResolvedValue(client)
    const result = await requireSiteAccess(requestWithCookie(), "00000000-0000-4000-8000-000000000001", {
      location: { id: "00000000-0000-4000-8000-000000000002", command: "update" },
    })
    expect(result.error?.status).toBe(403)
    expect(result.supabase).toBeUndefined()
    expect(client.rpc).toHaveBeenLastCalledWith("user_can_access_location", {
      p_site_id: "00000000-0000-4000-8000-000000000001", p_location_id: "00000000-0000-4000-8000-000000000002",
    })
  })

  it("allows scoped operations only with both affirmative permission results", async () => {
    const client = userClient({ id: "user-1" }, "owner")
    client.rpc.mockReset().mockResolvedValueOnce({ data: "owner", error: null })
      .mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: true, error: null })
    ;(createClient as jest.Mock).mockResolvedValue(client)
    const result = await requireSiteAccess(requestWithCookie(), "00000000-0000-4000-8000-000000000001", {
      location: { id: null, command: "select" },
    })
    expect(result.error).toBeUndefined()
    expect(result.supabase).toBe(client)
  })

  it("fails closed when location enforcement cannot be verified", async () => {
    const client = userClient({ id: "user-1" }, "collaborator")
    client.rpc.mockImplementation(async (name: string) => name === "current_user_site_role"
      ? { data: "collaborator", error: null }
      : { data: null, error: { code: "PGRST202" } })
    jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
    const result = await requireSiteAccess(requestWithCookie(), "00000000-0000-4000-8000-000000000001")
    expect(result.error?.status).toBe(403)
    expect(client.rpc).toHaveBeenCalledTimes(2)
    expect(client.rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: "00000000-0000-4000-8000-000000000001" })
  })

  it.each([true, null, "false"])("denies unscoped access for restriction result %p", async (state) => {
    const client = userClient({ id: "user-1" }, "collaborator")
    client.rpc.mockImplementation(async (name: string) => ({
      data: name === "current_user_site_role" ? "collaborator" : state, error: null,
    }))
    ;(createClient as jest.Mock).mockResolvedValue(client)
    const result = await requireSiteAccess(requestWithCookie(), "00000000-0000-4000-8000-000000000001")
    expect(result.error?.status).toBe(403)
  })

  it("supports explicitly audited RLS-only projections without granting manager privileges", async () => {
    const client = userClient({ id: "user-1" }, "collaborator")
    ;(createClient as jest.Mock).mockResolvedValue(client)
    expect((await requireSiteAccess(requestWithCookie(), "00000000-0000-4000-8000-000000000001", {
      allowLocationScoped: true,
    })).error).toBeUndefined()
    expect(client.rpc).toHaveBeenCalledTimes(1)
    expect((await requireSiteAccess(requestWithCookie(), "00000000-0000-4000-8000-000000000001", {
      allowLocationScoped: true, requireManager: true,
    })).error?.status).toBe(403)
  })
})
