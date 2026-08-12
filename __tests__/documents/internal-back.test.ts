import {
  isDocumentViewPath,
  withInternalFrom,
} from "@/app/documents/internal-back"

describe("internal-back", () => {
  describe("isDocumentViewPath", () => {
    it("matches public document prefixes", () => {
      expect(isDocumentViewPath("/so/abc")).toBe(true)
      expect(isDocumentViewPath("/i/abc")).toBe(true)
      expect(isDocumentViewPath("/vb/abc")).toBe(true)
      expect(isDocumentViewPath("/q/abc")).toBe(true)
      expect(isDocumentViewPath("/order-pdf/1")).toBe(true)
      expect(isDocumentViewPath("/bill-pdf/1")).toBe(true)
      expect(isDocumentViewPath("/quote-pdf/1")).toBe(true)
    })

    it("rejects non-document paths", () => {
      expect(isDocumentViewPath("/shop/pigs")).toBe(false)
      expect(isDocumentViewPath("/marketplace")).toBe(false)
      expect(isDocumentViewPath("/orders")).toBe(false)
      expect(isDocumentViewPath(null)).toBe(false)
    })
  })

  describe("withInternalFrom", () => {
    it("appends a safe from param", () => {
      expect(withInternalFrom("/so/tok", "/shop/abc")).toBe(
        "/so/tok?from=%2Fshop%2Fabc"
      )
    })

    it("ignores unsafe or document from values", () => {
      expect(withInternalFrom("/so/tok", "https://evil.com")).toBe("/so/tok")
      expect(withInternalFrom("/so/tok", "//evil.com")).toBe("/so/tok")
      expect(withInternalFrom("/so/tok", "/auth")).toBe("/so/tok")
      expect(withInternalFrom("/so/tok", "/so/other")).toBe("/so/tok")
      expect(withInternalFrom("/so/tok", null)).toBe("/so/tok")
    })
  })
})
