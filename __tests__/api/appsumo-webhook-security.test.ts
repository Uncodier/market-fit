/** @jest-environment node */

import { createHmac } from "node:crypto"
import { verifyAppSumoSignature } from "@/app/api/webhooks/appsumo/route"

jest.mock("@/lib/supabase/server", () => ({
  createServiceClient: jest.fn(),
}))

describe("AppSumo webhook signature verification", () => {
  const originalKey = process.env.APPSUMO_API_KEY

  beforeEach(() => {
    process.env.APPSUMO_API_KEY = "test-appsumo-key"
  })

  afterAll(() => {
    if (originalKey === undefined) delete process.env.APPSUMO_API_KEY
    else process.env.APPSUMO_API_KEY = originalKey
  })

  it("accepts a current, correctly signed raw body", () => {
    const timestamp = String(Date.now())
    const body = JSON.stringify({ event: "purchase", test: true })
    const signature = createHmac("sha256", "test-appsumo-key")
      .update(timestamp + body)
      .digest("hex")

    expect(verifyAppSumoSignature(timestamp, signature, body)).toBe("valid")
  })

  it("rejects altered bodies and stale timestamps", () => {
    const timestamp = String(Date.now())
    const signature = createHmac("sha256", "test-appsumo-key")
      .update(timestamp + "{}")
      .digest("hex")

    expect(verifyAppSumoSignature(timestamp, signature, '{"test":true}')).toBe(
      "invalid"
    )
    expect(
      verifyAppSumoSignature(String(Date.now() - 600_000), signature, "{}")
    ).toBe("invalid")
  })
})
