import { createClient } from "@supabase/supabase-js"
import { POST as secretsPost } from "@/app/api/secrets/route"
import { POST as secureTokensPost } from "@/app/api/secure-tokens/route"

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

function request(body: Record<string, unknown>) {
  return {
    headers: { get: jest.fn().mockReturnValue(null) },
    json: async () => body,
  } as any
}

describe.each([
  {
    name: "site secrets",
    handler: secretsPost,
    body: {
      operation: "check",
      siteId: "00000000-0000-4000-8000-000000000001",
      provider: "smtp",
      useCase: "outbound-email",
    },
  },
  {
    name: "secure tokens",
    handler: secureTokensPost,
    body: {
      operation: "check",
      siteId: "00000000-0000-4000-8000-000000000001",
      tokenType: "api",
      identifier: "primary",
    },
  },
])("$name route authorization", ({ handler, body }) => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, "error").mockImplementation(() => undefined)
    jest.spyOn(console, "log").mockImplementation(() => undefined)
    ;(createClient as jest.Mock).mockImplementation(() => {
      throw new Error("Service-role access must happen after authorization")
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("rejects missing credentials before creating a service-role client", async () => {
    const response = await handler(request(body))

    expect(response.status).toBe(401)
    expect(createClient).not.toHaveBeenCalled()
  })
})
