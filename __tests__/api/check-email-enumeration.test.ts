import { POST } from "@/app/api/auth/check-email-exists/route"

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

describe("email existence endpoint", () => {
  it("returns the same neutral response for every request", async () => {
    const existing = await POST()
    const unknown = await POST()

    expect(existing.status).toBe(200)
    expect(await existing.json()).toEqual({ accepted: true })
    expect(await unknown.json()).toEqual({ accepted: true })
  })
})
