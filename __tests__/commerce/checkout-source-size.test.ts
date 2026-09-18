import fs from "node:fs"
import path from "node:path"

const sourceFiles = [
  "app/commerce/checkout.ts",
  "app/commerce/checkout-types.ts",
  "app/commerce/checkout-environment.ts",
  "app/commerce/checkout-lines.ts",
  "app/commerce/checkout-records.ts",
  "app/commerce/checkout-finalize.ts",
  "app/pos/page.tsx",
  "app/pos/hooks/use-pos-cart.ts",
  "app/pos/hooks/use-pos-checkout.ts",
  "app/pos/components/PosPageDialogs.tsx",
  "app/pos/create-pending-split-orders.ts",
  "app/pos/order-session.ts",
  "app/sales/[id]/page.tsx",
  "app/sales/[id]/components/SaleDetailHeader.tsx",
  "app/orders/[id]/page.tsx",
  "app/orders/[id]/components/OrderDetailView.tsx",
]

describe("checkout-related source size", () => {
  it.each(sourceFiles)("%s stays below 500 lines", (relativePath) => {
    const source = fs.readFileSync(
      path.join(process.cwd(), relativePath),
      "utf8"
    )
    expect(source.split(/\r?\n/).length).toBeLessThan(500)
  })
})
