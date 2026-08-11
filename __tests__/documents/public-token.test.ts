import {
  buildPublicDocPath,
  buildPublicDocUrl,
  generatePublicAccessToken,
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
})
