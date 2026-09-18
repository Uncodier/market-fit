import {
  buildPublicDocPath,
  buildPublicDocUrl,
  generatePublicAccessToken,
  isPublicAccessTokenActive,
  isValidPublicAccessToken,
} from "@/app/documents/public-token"

describe("document public tokens", () => {
  it("generates a valid token", () => {
    const token = generatePublicAccessToken()
    expect(isValidPublicAccessToken(token)).toBe(true)
  })

  it("builds paths and urls for each prefix", () => {
    expect(buildPublicDocPath("i", "abc")).toBe("/i/abc")
    expect(buildPublicDocPath("so", "abc")).toBe("/so/abc")
    expect(buildPublicDocPath("vb", "abc")).toBe("/vb/abc")
    expect(buildPublicDocUrl("i", "tok", "https://app.example.com")).toBe(
      "https://app.example.com/i/tok"
    )
  })

  it("accepts active and non-expiring public links", () => {
    const now = new Date("2026-09-17T12:00:00.000Z")

    expect(isPublicAccessTokenActive({}, now)).toBe(true)
    expect(isPublicAccessTokenActive({
      public_access_token_expires_at: "2026-09-18T12:00:00.000Z",
    }, now)).toBe(true)
  })

  it("rejects expired or revoked public links", () => {
    const now = new Date("2026-09-17T12:00:00.000Z")

    expect(isPublicAccessTokenActive({
      public_access_token_expires_at: "2026-09-16T12:00:00.000Z",
    }, now)).toBe(false)
    expect(isPublicAccessTokenActive({
      public_access_token_revoked_at: "2026-09-17T11:00:00.000Z",
    }, now)).toBe(false)
  })
})
