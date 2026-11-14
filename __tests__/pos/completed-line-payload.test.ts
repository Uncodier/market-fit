/** @jest-environment node */
import { posCheckoutLines } from "@/app/pos/checkout-lines"
import { posOperationCheckoutSchema } from "@/app/pos/operation-schemas"
import { posCheckoutFingerprint } from "@/app/pos/checkout-attempt-server"
import { authorizeCheckoutBoundary } from "@/app/commerce/checkout-boundary"
import { checkoutInput, locationId } from "./operation-fixtures"

jest.mock("server-only", () => ({}))
jest.mock("@/app/commerce/private-site-access", () => ({ requirePrivateCommerceSiteAccess: jest.fn() }))

describe("explicit POS completion payload", () => {
  const line = { ...checkoutInput.lines[0], completedWithoutStock: true }

  it("serializes only the explicit host marker; modifiers inherit rather than claim completion", () => {
    const result = posCheckoutLines([{
      id: locationId, cartQty: 1, cartPrice: 10, completedWithoutStock: true,
      modifiers: [{ catalogItemId: locationId, cartQty: 2, cartPrice: 3 }],
    }] as never)
    expect(result[0].completedWithoutStock).toBe(true)
    expect(result[0].modifiers?.[0]).not.toHaveProperty("completedWithoutStock")
    expect(posOperationCheckoutSchema.parse({ ...checkoutInput, lines: result }).lines[0].completedWithoutStock).toBe(true)
  })

  it.each(["true", 1, null, {}])("rejects malformed completion marker %j", (completedWithoutStock) => {
    expect(posOperationCheckoutSchema.safeParse({ ...checkoutInput, lines: [{ ...line, completedWithoutStock }] }).success).toBe(false)
  })

  it("rejects modifier-level and raw server inventory markers", () => {
    for (const extra of [{ completedWithoutStock: true }, { inventory_completed_quantity: 1 }]) {
      expect(posOperationCheckoutSchema.safeParse({ ...checkoutInput, lines: [{ ...line,
        modifiers: [{ catalogItemId: locationId, quantity: 1, ...extra }],
      }] }).success).toBe(false)
    }
  })

  it("includes completion semantics in durable admission fingerprint", () => {
    expect(posCheckoutFingerprint({ ...checkoutInput, lines: [line] })).not.toBe(posCheckoutFingerprint(checkoutInput))
    expect(posCheckoutFingerprint({ ...checkoutInput, lines: [line] })).toBe(posCheckoutFingerprint({ ...checkoutInput, lines: [line] }))
  })

  it.each(["shop", "sales", "marketplace", "quote"] as const)("rejects explicit completion in %s even outside the HTTP schema", async (source) => {
    await expect(authorizeCheckoutBoundary({ ...checkoutInput, source, lines: [line] })).rejects.toThrow("only available for POS")
  })

  it("rejects malformed direct Server Action marker before checkout authorization or writes", async () => {
    await expect(authorizeCheckoutBoundary({ ...checkoutInput, lines: [{ ...line, completedWithoutStock: "true" }] } as never)).rejects.toThrow("only available for POS")
  })
})