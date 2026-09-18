import { GET } from "@/app/api/revenue/route"
import { createServiceApiClient } from "@/lib/supabase/server-client"

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

jest.mock("@/lib/supabase/server-client", () => ({
  createApiClient: jest.fn(),
  createServiceApiClient: jest.fn(),
}))

function request(url: string) {
  return {
    nextUrl: new URL(url),
  } as any
}

describe("revenue route contract", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("rejects a request without a site id before creating a service client", async () => {
    const response = await GET(request("http://localhost:3000/api/revenue"))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Site ID is required" })
    expect(createServiceApiClient).not.toHaveBeenCalled()
  })

  it("rejects an unauthenticated request for an arbitrary site", async () => {
    ;(createServiceApiClient as jest.Mock).mockImplementation(() => {
      throw new Error("Service-role access must happen after authorization")
    })

    const response = await GET(
      request("http://localhost:3000/api/revenue?siteId=00000000-0000-4000-8000-000000000001")
    )

    expect(response.status).toBe(401)
    expect(createServiceApiClient).not.toHaveBeenCalled()
  })
})
