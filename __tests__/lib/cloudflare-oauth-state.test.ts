/** @jest-environment node */

import {
  createCloudflareOAuthState,
  verifyCloudflareOAuthState,
} from "@/app/lib/integrations/cloudflare/oauth-state"

describe("Cloudflare OAuth state", () => {
  const originalSecret = process.env.CLOUDFLARE_CLIENT_SECRET

  beforeEach(() => {
    process.env.CLOUDFLARE_CLIENT_SECRET = "test-cloudflare-secret"
  })

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.CLOUDFLARE_CLIENT_SECRET
    } else {
      process.env.CLOUDFLARE_CLIENT_SECRET = originalSecret
    }
  })

  it("round-trips a signed site and user binding", () => {
    const siteId = "a32dcf3a-08a1-45a5-98d4-cc84745337b0"
    const userId = "855cd31d-1537-45ac-b9b0-16d8bd1869b8"

    expect(
      verifyCloudflareOAuthState(
        createCloudflareOAuthState(siteId, userId)
      )
    ).toEqual({ siteId, userId })
  })

  it("rejects tampered state", () => {
    const state = createCloudflareOAuthState(
      "a32dcf3a-08a1-45a5-98d4-cc84745337b0",
      "855cd31d-1537-45ac-b9b0-16d8bd1869b8"
    )

    expect(verifyCloudflareOAuthState(`${state}tampered`)).toBeNull()
  })
})
