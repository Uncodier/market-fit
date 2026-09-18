import fs from "node:fs"
import path from "node:path"

describe("public document email checkout links", () => {
  it.each([
    "app/orders/send-actions.ts",
    "app/sales/send-actions.ts",
  ])("%s routes payment through the guarded public page", (relativePath) => {
    const source = fs.readFileSync(
      path.join(process.cwd(), relativePath),
      "utf8"
    )

    expect(source).not.toContain("checkout.sessions.create")
    expect(source).not.toMatch(/new\s+Stripe\s*\(/)
    expect(source).toMatch(
      /const checkoutLink =[\s\S]*status === "pending"[\s\S]*\? viewLink/
    )
  })
})
