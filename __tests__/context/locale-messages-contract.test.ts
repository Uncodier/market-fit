import { flattenMessages } from "@/app/context/locale-messages"
import { documentT } from "@/app/lib/i18n/document-t"

describe("mixed locale dictionary normalization", () => {
  it("preserves nested leaves and gives explicit dotted entries precedence", () => {
    const messages = {
      buyer: { library: { digitalAsset: "Nested asset", purchased: "Purchased" } },
      "buyer.library.digitalAsset": "Explicit asset",
      hello: "Hello {{name}}",
    }
    expect(flattenMessages(messages)).toEqual({
      "buyer.library.digitalAsset": "Explicit asset",
      "buyer.library.purchased": "Purchased",
      hello: "Hello {{name}}",
    })
    expect(messages.buyer.library.digitalAsset).toBe("Nested asset")
  })

  it("resolves the nested document key without leaking an object to rendering", () => {
    expect(typeof documentT("en", "buyer.library.digitalAsset")).toBe("string")
    expect(documentT("en", "buyer.library.digitalAsset")).not.toBe("buyer.library.digitalAsset")
    expect(documentT("en", "buyer")).toBe("buyer")
  })
})