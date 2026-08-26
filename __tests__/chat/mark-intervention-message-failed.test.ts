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

function createChain(result: { data?: any; error?: any } = { data: null, error: null }) {
  const chain: any = {}
  chain.select = jest.fn().mockReturnValue(chain)
  chain.eq = jest.fn().mockReturnValue(chain)
  chain.gte = jest.fn().mockReturnValue(chain)
  chain.order = jest.fn().mockReturnValue(chain)
  chain.limit = jest.fn().mockResolvedValue(result)
  chain.insert = jest.fn().mockReturnValue(chain)
  chain.update = jest.fn().mockReturnValue(chain)
  chain.single = jest.fn().mockResolvedValue(result)
  chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject)
  return chain
}

describe("markInterventionMessageFailed", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("updates a matching recent row instead of inserting", async () => {
    const lookup = createChain({
      data: [{ id: "msg-existing", created_at: "2026-08-26T09:46:00.000Z", custom_data: { channel: "whatsapp" } }],
      error: null,
    })
    const update = createChain({
      data: {
        id: "msg-existing",
        created_at: "2026-08-26T09:46:00.000Z",
        custom_data: { channel: "whatsapp", command_status: "failed" },
      },
      error: null,
    })
    fromMock.mockReturnValueOnce(lookup).mockReturnValueOnce(update)

    const result = await markInterventionMessageFailed({
      conversationId: "conv-1",
      userId: "user-1",
      content: "Fe de erratas",
      errorMessage: "timeout",
      userName: "Sergio Prado",
    })

    expect(lookup.insert).not.toHaveBeenCalled()
    expect(update.insert).not.toHaveBeenCalled()
    expect(update.update).toHaveBeenCalledWith({
      custom_data: expect.objectContaining({
        command_status: "failed",
        error_message: "timeout",
        user_name: "Sergio Prado",
        channel: "whatsapp",
      }),
    })
    expect(result?.id).toBe("msg-existing")
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
  })

  it("inserts once when no matching row exists", async () => {
    const lookup = createChain({ data: [], error: null })
    const insert = createChain({
      data: { id: "msg-new", created_at: "2026-08-26T09:51:00.000Z", custom_data: { command_status: "failed" } },
      error: null,
    })
    fromMock.mockReturnValueOnce(lookup).mockReturnValueOnce(insert)

    const result = await markInterventionMessageFailed({
      conversationId: "conv-1",
      userId: "user-1",
      content: "Hola",
      errorMessage: "network",
      userName: "Sergio Prado",
    })

    expect(insert.insert).toHaveBeenCalledWith({
      conversation_id: "conv-1",
      role: "team_member",
      user_id: "user-1",
      content: "Hola",
      custom_data: expect.objectContaining({
        command_status: "failed",
        error_message: "network",
        user_name: "Sergio Prado",
      }),
    })
    expect(result?.id).toBe("msg-new")
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
