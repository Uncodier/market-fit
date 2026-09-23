import { deleteAgentMailInbox } from "@/app/components/settings/agentmail-inbox-api"
import { apiClient } from "@/app/services/api-client-service"

jest.mock("@/app/services/api-client-service", () => ({
  apiClient: {
    delete: jest.fn(),
  },
}))

const deleteMock = apiClient.delete as jest.MockedFunction<typeof apiClient.delete>

describe("deleteAgentMailInbox", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("uses the AgentMail DELETE resource endpoint", async () => {
    deleteMock.mockResolvedValue({ success: true })

    await deleteAgentMailInbox("support@example.com")

    expect(deleteMock).toHaveBeenCalledWith(
      "/api/integrations/agentmail/inboxes/support%40example.com",
    )
  })

  it("allows local cleanup when the remote inbox no longer exists", async () => {
    deleteMock.mockResolvedValue({
      success: false,
      status: 404,
      error: { message: "Inbox not found" },
    })

    await expect(deleteAgentMailInbox("missing-inbox")).resolves.toBeUndefined()
  })

  it("surfaces other deletion failures", async () => {
    deleteMock.mockResolvedValue({
      success: false,
      status: 500,
      error: { message: "AgentMail unavailable" },
    })

    await expect(deleteAgentMailInbox("inbox-1")).rejects.toThrow(
      "AgentMail unavailable",
    )
  })
})
