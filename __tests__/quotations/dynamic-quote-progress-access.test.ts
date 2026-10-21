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

  function mockItem(overrides = {}) {
    const single = jest.fn().mockResolvedValue({ data: {
      id: "item-1", metadata: { dynamic_quote: { status: "processing" } },
      quotation: {
        site_id: "site-1", public_access_token: "AAAAAAAAAAAAAAAAAAAAAAAA",
        public_access_token_expires_at: "2099-01-01", public_access_token_revoked_at: null,
        ...overrides,
      },
    }, error: null })
    const eq = jest.fn(() => ({ single }))
    ;(createClient as jest.Mock).mockReturnValue({ from: jest.fn(() => ({ select: jest.fn(() => ({ eq })) })) })
    return eq
  }

  it.each([
    { public_access_token_expires_at: "2000-01-01" },
    { public_access_token_expires_at: "invalid" },
    { public_access_token_revoked_at: "2026-01-01" },
  ])("denies expired, malformed and revoked tokens before sync %p", async (overrides) => {
    mockItem(overrides)
    expect((await pollDynamicQuoteProgress("item-1", "AAAAAAAAAAAAAAAAAAAAAAAA")).error).toBeTruthy()
    expect(syncDynamicQuoteFromInstanceLogs).not.toHaveBeenCalled()
  })

  it("preserves token-only progress but never returns internal logs or assistant identifiers", async () => {
    const eq = mockItem()
    ;(syncDynamicQuoteFromInstanceLogs as jest.Mock).mockResolvedValue({ data: {
      status: "priced", unitPrice: 25, validUntil: "2099-01-01", assistantInstanceId: "private-instance",
      sourceLogs: [{ id: "private-log", log_type: "thinking", message: "secret prompt customer@example.com" }],
      error: "provider-secret", arbitrary: "secret",
    } })
    const result = await pollDynamicQuoteProgress("item-1", "AAAAAAAAAAAAAAAAAAAAAAAA")
    expect(eq).toHaveBeenCalledWith("id", "item-1")
    expect(result.data).toEqual({ status: "priced", unitPrice: 25, validUntil: "2099-01-01",
      logs: [{ id: "quote-priced", logType: "status", text: "Quote calculated", createdAt: expect.any(String) }],
    })
    expect(JSON.stringify(result)).not.toMatch(/secret|sourceLogs|assistantInstanceId|private-log/)
  })

  it("preserves the documented legacy null-expiry token policy without exposing failure details", async () => {
    mockItem({ public_access_token_expires_at: null })
    ;(syncDynamicQuoteFromInstanceLogs as jest.Mock).mockResolvedValue({ data: { status: "failed", error: "private provider diagnostic" } })
    const result = await pollDynamicQuoteProgress("item-1", "AAAAAAAAAAAAAAAAAAAAAAAA")
    expect(result.data?.status).toBe("failed")
    expect(JSON.stringify(result)).not.toContain("private provider diagnostic")
  })
})
