/** @jest-environment node */

import { POST } from "@/app/api/commerce/checkout/route"
import { checkoutCart } from "@/app/commerce/checkout"
import { createClient } from "@/lib/supabase/server"

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

jest.mock("@/app/commerce/checkout", () => ({
  checkoutCart: jest.fn(),
}))

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

const baseBody = {
  siteId: "site-1",
  lines: [{ catalogItemId: "item-1", quantity: 1 }],
  fulfillment: "none",
  source: "shop",
  clientMutationId: "84b1399d-c814-4d63-ae43-86050a5f9dd1",
}

function request(body: Record<string, unknown>) {
  return new Request("https://example.test/api/commerce/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("public commerce checkout identity", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(checkoutCart as jest.Mock).mockResolvedValue({
      success: true,
      orderId: "order-1",
    })
  })

  it("replaces a caller-supplied buyer id with the authenticated user", async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "authenticated-buyer" } },
          error: null,
        }),
      },
    })

    const response = await POST(
      request({ ...baseBody, buyerUserId: "victim-user", userId: "staff-user" })
    )

    expect(response.status).toBe(200)
    expect(checkoutCart).toHaveBeenCalledWith(
      expect.objectContaining({ buyerUserId: "authenticated-buyer" })
    )
    expect((checkoutCart as jest.Mock).mock.calls[0][0].userId).toBeUndefined()
  })

  it("removes a spoofed buyer id for anonymous checkout", async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    })

    await POST(request({ ...baseBody, buyerUserId: "victim-user" }))

    expect((checkoutCart as jest.Mock).mock.calls[0][0].buyerUserId).toBeUndefined()
  })
})
