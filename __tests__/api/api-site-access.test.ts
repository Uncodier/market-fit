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
  } as any
}

function userClient(user: unknown, role: unknown, roleError: unknown = null) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    rpc: jest.fn().mockResolvedValue({
      data: role,
      error: roleError,
    }),
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
})
