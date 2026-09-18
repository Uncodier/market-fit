import { createServiceClient } from "@/lib/supabase/server"
import { rejectQuotationByPublicToken } from "@/app/quotations/public-actions"

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  createServiceClient: jest.fn(),
}))

const token = "0123456789abcdefghijklmn"

function chain(result: unknown) {
  const builder: any = {}
  builder.select = jest.fn(() => builder)
  builder.update = jest.fn(() => builder)
  builder.eq = jest.fn(() => builder)
  builder.is = jest.fn(() => builder)
  builder.or = jest.fn(() => builder)
  builder.single = jest.fn().mockResolvedValue(result)
  builder.maybeSingle = jest.fn().mockResolvedValue(result)
  return builder
}

describe("public quote rejection concurrency", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("binds the final mutation to token, status, and active lifecycle", async () => {
    const readQuery = chain({
      data: {
        id: "quote-1",
        status: "sent",
        valid_until: "2999-01-01T00:00:00.000Z",
        buyer_user_id: "buyer-a",
        public_access_token: token,
        public_access_token_expires_at: null,
        public_access_token_revoked_at: null,
      },
      error: null,
    })
    const updateQuery = chain({ data: { id: "quote-1" }, error: null })
    ;(createServiceClient as jest.Mock).mockResolvedValue({
      from: jest.fn()
        .mockReturnValueOnce(readQuery)
        .mockReturnValueOnce(updateQuery),
    })

    const result = await rejectQuotationByPublicToken(token)

    expect(result).toEqual({ success: true })
    expect(updateQuery.eq).toHaveBeenCalledWith("public_access_token", token)
    expect(updateQuery.eq).toHaveBeenCalledWith("status", "sent")
    expect(updateQuery.is).toHaveBeenCalledWith("checkout_claim_id", null)
    expect(updateQuery.is).toHaveBeenCalledWith(
      "public_access_token_revoked_at",
      null
    )
  })

  it("reports a concurrent status or token change instead of false success", async () => {
    const readQuery = chain({
      data: {
        id: "quote-1",
        status: "sent",
        valid_until: "2999-01-01T00:00:00.000Z",
        buyer_user_id: "buyer-a",
        public_access_token: token,
        public_access_token_expires_at: null,
        public_access_token_revoked_at: null,
      },
      error: null,
    })
    const updateQuery = chain({ data: null, error: null })
    ;(createServiceClient as jest.Mock).mockResolvedValue({
      from: jest.fn()
        .mockReturnValueOnce(readQuery)
        .mockReturnValueOnce(updateQuery),
    })

    const result = await rejectQuotationByPublicToken(token)

    expect(result).toEqual({ error: "Quote is no longer available" })
  })
})
