import fs from "node:fs"
import path from "node:path"

describe("public document token actions", () => {
  it.each([
    ["app/quotations/public-actions.ts", "Quotation"],
    ["app/orders/send-actions.ts", "Order"],
    ["app/sales/send-actions.ts", "Sale"],
    ["app/bills/send-actions.ts", "Bill"],
  ])("%s exposes explicit rotate and revoke actions", (relativePath, kind) => {
    const source = fs.readFileSync(
      path.join(process.cwd(), relativePath),
      "utf8"
    )

    expect(source).toContain(`rotate${kind}PublicAccessToken`)
    expect(source).toContain(`revoke${kind}PublicAccessToken`)
  })

  it.each([
    ["app/quotations/[id]/page.tsx", "ensureQuotationPublicAccessToken"],
    ["app/orders/[id]/page.tsx", "ensureOrderPublicAccessToken"],
    ["app/sales/[id]/page.tsx", "ensureSalePublicAccessToken"],
    ["app/bills/[id]/page.tsx", "ensureBillPublicAccessToken"],
  ])("%s resolves the token when copying", (relativePath, ensureAction) => {
    const source = fs.readFileSync(
      path.join(process.cwd(), relativePath),
      "utf8"
    )
    const copyHandler = source.match(
      /const handleCopy(?:Client|Vendor)Link = async \(\) => \{([\s\S]*?)\n  \}/
    )?.[1]

    expect(copyHandler).toContain(ensureAction)
    expect(copyHandler).not.toMatch(
      /if\s*\([^)]*public(?:_access_token|AccessToken)[^)]*\)/
    )
  })
})
