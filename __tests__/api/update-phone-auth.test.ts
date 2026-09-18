import { createClient } from "@supabase/supabase-js"
import { POST } from "@/app/api/auth/update-phone/route"

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}))

const userId = "00000000-0000-4000-8000-000000000001"

function request(
  body: Record<string, unknown>,
  authorization?: string
) {
  return {
    json: async () => body,
    headers: new Headers(
      authorization ? { authorization } : undefined
    ),
  } as Request
}

describe("update phone authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("rejects missing bearer credentials before creating any client", async () => {
    const response = await POST(request({ userId, phone: "+15555550100" }))

    expect(response.status).toBe(401)
    expect(createClient).not.toHaveBeenCalled()
  })

  it.each<{ phone: unknown; label: string }>([
    { phone: 12345, label: "non-string" },
    { phone: "123", label: "too short" },
    { phone: "+1234567890123456", label: "too many digits" },
    { phone: "+1<script>alert(1)</script>", label: "invalid characters" },
  ])("rejects $label phone input", async ({ phone }) => {
    const response = await POST(
      request({ phone }, "Bearer valid-user-token")
    )

    expect(response.status).toBe(400)
    expect(createClient).not.toHaveBeenCalled()
  })

  it("rejects invalid bearer credentials before updating auth", async () => {
    ;(createClient as jest.Mock).mockReturnValueOnce({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: new Error("Invalid token"),
        }),
      },
    })

    const response = await POST(
      request(
        { userId, phone: "+15555550100" },
        "Bearer invalid-token"
      )
    )

    expect(response.status).toBe(401)
    expect(createClient).toHaveBeenCalledTimes(1)
  })

  it("derives identity from the token and never marks phone as verified", async () => {
    ;(createClient as jest.Mock).mockReturnValueOnce({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: userId,
              user_metadata: { name: "Test Buyer" },
            },
          },
          error: null,
        }),
      },
    })
    const authFetch = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: userId }),
    } as Response)

    const response = await POST(
      request(
        { userId: "spoofed-victim-id", phone: "+15555550100" },
        "Bearer valid-user-token"
      )
    )

    expect(response.status).toBe(200)
    expect(createClient).toHaveBeenCalledTimes(1)
    expect(authFetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/v1/user"),
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          Authorization: "Bearer valid-user-token",
        }),
        body: JSON.stringify({
          data: {
            name: "Test Buyer",
            phone: "+15555550100",
          },
        }),
      })
    )
  })
})
