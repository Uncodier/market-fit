import { createClient } from "@/lib/supabase/server"
import { rejectQuotation } from "@/app/quotations/buyer-actions"

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

function chain(result?: unknown) {
  const builder: any = {}
  builder.select = jest.fn(() => builder)
  builder.update = jest.fn(() => builder)
  builder.eq = jest.fn(() => builder)
  builder.is = jest.fn(() => builder)
  builder.single = jest.fn().mockResolvedValue(result)
  builder.maybeSingle = jest.fn().mockResolvedValue(result)
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(result ?? { error: null }).then(resolve)
  return builder
}

describe("buyer quotation rejection ownership", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("repeats buyer ownership in the final mutation predicate", async () => {
    const readQuery = chain({
      data: {
        id: "quote-1",
        status: "sent",
        valid_until: "2999-01-01T00:00:00.000Z",
        buyer_user_id: "buyer-a",
      },
      error: null,
    })
    const updateQuery = chain({ data: { id: "quote-1" }, error: null })
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "buyer-a" } },
          error: null,
        }),
      },
      from: jest.fn()
        .mockReturnValueOnce(readQuery)
        .mockReturnValueOnce(updateQuery),
    })

    const result = await rejectQuotation("quote-1")

    expect(result).toEqual({ success: true })
    expect(updateQuery.eq).toHaveBeenNthCalledWith(1, "id", "quote-1")
    expect(updateQuery.eq).toHaveBeenNthCalledWith(
      2,
      "buyer_user_id",
      "buyer-a"
    )
    expect(updateQuery.eq).toHaveBeenNthCalledWith(3, "status", "sent")
    expect(updateQuery.is).toHaveBeenCalledWith("checkout_claim_id", null)
  })

  it("does not report success when a concurrent change prevents the update", async () => {
    const readQuery = chain({
      data: {
        id: "quote-1",
        status: "sent",
        valid_until: "2999-01-01T00:00:00.000Z",
        buyer_user_id: "buyer-a",
      },
      error: null,
    })
    const updateQuery = chain({ data: null, error: null })
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "buyer-a" } },
          error: null,
        }),
      },
      from: jest.fn()
        .mockReturnValueOnce(readQuery)
        .mockReturnValueOnce(updateQuery),
    })

    const result = await rejectQuotation("quote-1")

    expect(result).toEqual({ error: "Quotation is no longer available" })
  })
})
