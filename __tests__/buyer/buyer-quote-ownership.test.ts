import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getBuyerQuotation } from "@/app/buyer/quote-actions"

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  createServiceClient: jest.fn(),
}))

const quotationId = "00000000-0000-4000-8000-000000000001"

function authenticatedClient(user: unknown) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
  }
}

function quotationQuery(result: unknown) {
  const builder: any = {}
  builder.select = jest.fn(() => builder)
  builder.eq = jest.fn(() => builder)
  builder.single = jest.fn().mockResolvedValue(result)
  return builder
}

describe("buyer quotation ownership", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("rejects anonymous access before using the service role", async () => {
    ;(createClient as jest.Mock).mockResolvedValue(authenticatedClient(null))

    const result = await getBuyerQuotation(quotationId)

    expect(result).toEqual({ error: "Not authenticated" })
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("binds the quotation lookup to the authenticated buyer", async () => {
    const query = quotationQuery({ data: null, error: { message: "not found" } })
    ;(createClient as jest.Mock).mockResolvedValue(
      authenticatedClient({ id: "buyer-a" })
    )
    ;(createServiceClient as jest.Mock).mockResolvedValue({
      from: jest.fn(() => query),
    })

    const result = await getBuyerQuotation(quotationId)

    expect(result).toEqual({ error: "Quotation not found" })
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", quotationId)
    expect(query.eq).toHaveBeenNthCalledWith(2, "buyer_user_id", "buyer-a")
  })
})
