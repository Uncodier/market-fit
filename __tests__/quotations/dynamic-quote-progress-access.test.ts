/** @jest-environment node */

import { pollDynamicQuoteProgress } from "@/app/quotations/dynamic-quote-progress"
import { createClient } from "@supabase/supabase-js"
import { syncDynamicQuoteFromInstanceLogs } from "@/app/quotations/dynamic-quote-sync"

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}))

jest.mock("@/app/quotations/dynamic-quote-sync", () => ({
  findAssistantInstanceForQuote: jest.fn(),
  syncDynamicQuoteFromInstanceLogs: jest.fn(),
}))

describe("dynamic quote progress access", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("rejects malformed capabilities before database access", async () => {
    await expect(
      pollDynamicQuoteProgress("item-1", "invalid")
    ).resolves.toEqual({ error: "Quote progress is not available" })
    expect(createClient).not.toHaveBeenCalled()
  })

  it("rejects a capability belonging to another quotation", async () => {
    const single = jest.fn().mockResolvedValue({
      data: {
        id: "item-1",
        metadata: { dynamic_quote: { status: "processing" } },
        quotation: {
          site_id: "site-1",
          public_access_token: "AAAAAAAAAAAAAAAAAAAAAAAA",
          public_access_token_expires_at: null,
          public_access_token_revoked_at: null,
        },
      },
      error: null,
    })
    ;(createClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({ single })),
        })),
      })),
    })

    await expect(
      pollDynamicQuoteProgress(
        "item-1",
        "BBBBBBBBBBBBBBBBBBBBBBBB"
      )
    ).resolves.toEqual({ error: "Quote progress is not available" })
    expect(syncDynamicQuoteFromInstanceLogs).not.toHaveBeenCalled()
  })
})
