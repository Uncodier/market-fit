import {
  markInterventionMessageFailed,
  interventionErrorMessageId,
  InterventionRequestError,
  shouldMarkInterventionFailedFromClient,
} from "@/app/services/mark-intervention-message-failed"
import { buildInterventionRequestBody } from "@/app/services/intervention-request"

const fromMock = jest.fn()

jest.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    from: (...args: unknown[]) => fromMock(...args),
  }),
}))

function createChain(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const chain = {
    select: jest.fn(), eq: jest.fn(), is: jest.fn(), insert: jest.fn(), update: jest.fn(),
    single: jest.fn().mockResolvedValue(result),
  }
  for (const method of [chain.select, chain.eq, chain.is, chain.insert, chain.update]) method.mockReturnValue(chain)
  return chain
}

describe("markInterventionMessageFailed", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("does not fabricate a failed message without an API-saved ID", async () => {
    expect(await markInterventionMessageFailed({
      conversationId: "conv-1", userId: "user-1", content: "Hello", errorMessage: "Network error",
    })).toBeNull()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it("updates by message_id when the API already returned it", async () => {
    const byId = createChain({
      data: { id: "msg-from-api", created_at: "2026-08-26T09:46:00.000Z", custom_data: {} },
      error: null,
    })
    const update = createChain({
      data: { id: "msg-from-api", created_at: "2026-08-26T09:46:00.000Z", custom_data: { command_status: "failed" } },
      error: null,
    })
    fromMock.mockReturnValueOnce(byId).mockReturnValueOnce(update)

    const result = await markInterventionMessageFailed({
      conversationId: "conv-1",
      userId: "user-1",
      content: "Hola",
      errorMessage: "500",
      messageId: "msg-from-api",
    })

    expect(fromMock).toHaveBeenCalledTimes(2)
    expect(update.insert).not.toHaveBeenCalled()
    expect(result?.id).toBe("msg-from-api")
    expect(update.eq).toHaveBeenCalledWith('custom_data', '{}')
  })

  it("does not mutate same-text messages or insert when the exact row is missing", async () => {
    const missing = createChain()
    fromMock.mockReturnValueOnce(missing)
    expect(await markInterventionMessageFailed({
      conversationId: "conv-1", userId: "user-1", content: "Hello", errorMessage: "Not started", messageId: "missing",
    })).toBeNull()
    expect(fromMock).toHaveBeenCalledTimes(1)
    expect(missing.update).not.toHaveBeenCalled()
    expect(missing.insert).not.toHaveBeenCalled()
  })

  it.each([
    { status: "sent" }, { status: "delivered" }, { command_status: "success" },
    { provider_call_id: "call-1" }, { status: "placement_unknown" }, { call_status: "placement_unknown" },
    { command_status: "failed", error_message: "Lead has not granted explicit Voice call consent" },
    { status: "failed", error_message: "Lead is on the do-not-call list" },
    { call_status: "failed", error_message: "Voice call recipient must use E.164 format" },
  ])("does not overwrite an authoritative delivery state: %j", async custom_data => {
    const row = { id: "msg-1", created_at: "2026-09-29T09:46:00.000Z", custom_data }
    const byId = createChain({ data: row, error: null })
    fromMock.mockReturnValueOnce(byId)
    expect(await markInterventionMessageFailed({
      conversationId: "conv-1", userId: "user-1", content: "Hello", errorMessage: "Not started", messageId: "msg-1",
    })).toEqual(row)
    expect(byId.update).not.toHaveBeenCalled()
    expect(fromMock).toHaveBeenCalledTimes(1)
    expect(byId.eq).toHaveBeenCalledWith("conversation_id", "conv-1")
    expect(byId.eq).toHaveBeenCalledWith("user_id", "user-1")
    expect(byId.eq).toHaveBeenCalledWith("role", "team_member")
  })

})

describe("retry intervention payload", () => {
  it("includes message_id so the API can reuse the same row", () => {
    const body = buildInterventionRequestBody(
      "conv-1",
      "Fe de erratas",
      "user-1",
      "agent-1",
      { site_id: "site-1", message_id: "msg-existing" }
    )

    expect(body.message_id).toBe("msg-existing")
    expect(body.conversation_id).toBe("conv-1")
    expect(body.conversationId).toBe("conv-1")
  })

  it("exposes message_id from an API error body", () => {
    const error = new InterventionRequestError("timeout", {
      message_id: "msg-from-api",
      conversation_id: "conv-1",
    })
    expect(interventionErrorMessageId(error)).toBe("msg-from-api")
    expect(shouldMarkInterventionFailedFromClient(error)).toBe(true)
  })

  it("does not mark failed on a generic HTTP timeout without API evidence", () => {
    expect(shouldMarkInterventionFailedFromClient(new Error("Failed to fetch"))).toBe(false)
    expect(shouldMarkInterventionFailedFromClient(new InterventionRequestError("timeout"))).toBe(false)
  })
})
