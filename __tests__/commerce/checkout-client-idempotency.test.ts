/** @jest-environment node */

import { checkoutCartRequest } from "@/app/commerce/checkout-client"
import type { CheckoutCartParams } from "@/app/commerce/checkout"

const params: CheckoutCartParams = {
  siteId: "4a7a360b-1034-4555-bcd8-6aaeedbb423c",
  lines: [{ catalogItemId: "item-1", quantity: 1 }],
  fulfillment: "none",
  source: "shop",
}

function successfulResponse(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      saleId: "sale-1",
      orderId: "order-1",
      publicAccessToken: "token-1",
    }),
  } as Response
}

describe("checkoutCartRequest idempotency", () => {
  beforeEach(() => { jest.mocked(global.fetch).mockReset() })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("reuses the mutation ID after an uncertain network failure", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValueOnce(successfulResponse())
      .mockResolvedValueOnce(successfulResponse())

    await expect(checkoutCartRequest(params)).rejects.toThrow("connection reset")
    await expect(checkoutCartRequest(params)).resolves.toMatchObject({
      success: true,
    })
    await checkoutCartRequest(params)

    const bodies = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body))
    )
    expect(bodies[1].clientMutationId).toBe(bodies[0].clientMutationId)
    expect(bodies[2].clientMutationId).not.toBe(bodies[1].clientMutationId)
  })

  it.each([400, 409, 500])("retains identity after an ambiguous HTTP %s response", async (status) => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce({ ok: false, status, json: async () => ({ error: "Confirmation failed" }) } as Response)
      .mockResolvedValueOnce(successfulResponse())
    await checkoutCartRequest(params)
    await checkoutCartRequest(params)
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))
    expect(bodies[0].clientMutationId).toBe(bodies[1].clientMutationId)
  })

  it("only rotates a failed attempt after an explicit pre-write rejection", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: "Invalid item", checkoutState: "rejected" }) } as Response)
      .mockResolvedValueOnce(successfulResponse())
    await checkoutCartRequest(params)
    await checkoutCartRequest(params)
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))
    expect(bodies[0].clientMutationId).not.toBe(bodies[1].clientMutationId)
  })
})
