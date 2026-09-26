import { sendAssistantMessage, sendRobotMessage } from "@/app/components/simple-messages-view/hooks/message-send-handlers"
import { postWithRetry } from "@/app/components/simple-messages-view/hooks/send-message-reliability"

jest.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "user" } } }) } }) }))
jest.mock("@/app/services/context-service", () => ({ contextService: { getContextData: async () => ({ records: [], recordContextOmittedIds: [] }) } }))
jest.mock("@/app/components/simple-messages-view/hooks/send-message-reliability", () => ({
  postWithRetry: jest.fn().mockResolvedValue({ success: true }),
  createRequestId: () => "request-1",
  persistUserActionLog: jest.fn(),
  markRobotInstanceErrorIfUnanswered: jest.fn(),
}))

const selectedContext = { records: [], assets: [], personas: [] } as any
const selection = { skill_mode: "required" as const, skill_slugs: ["my-skill"] }

describe("skill transport", () => {
  beforeEach(() => (postWithRetry as jest.Mock).mockClear())

  it("sends structured selection on assistant requests", async () => {
    await sendAssistantMessage({ messageToSend: "hello", siteId: "site", selectedActivity: "chat", selectedContext,
      skillSelection: selection, toast: jest.fn() })
    expect(postWithRetry).toHaveBeenCalledWith("/api/robots/instance/assistant", expect.objectContaining(selection), expect.anything())
  })

  it("sends structured selection on new robot workflow", async () => {
    await sendRobotMessage({ messageToSend: "hello", siteId: "site", selectedContext, skillSelection: selection,
      toast: jest.fn(), setThinkingStateWithTimeout: jest.fn(), setNewMakinaThinking: jest.fn(),
      clearThinkingState: jest.fn(), clearNewMakinaThinking: jest.fn() })
    expect(postWithRetry).toHaveBeenCalledWith("/api/workflow/startRobot", expect.objectContaining(selection))
  })

  it("sends structured selection on existing robot workflow", async () => {
    await sendRobotMessage({ messageToSend: "hello", siteId: "site", selectedContext, skillSelection: selection,
      activeRobotInstance: { id: "robot", status: "running" }, toast: jest.fn(),
      setThinkingStateWithTimeout: jest.fn(), setNewMakinaThinking: jest.fn(),
      clearThinkingState: jest.fn(), clearNewMakinaThinking: jest.fn() })
    expect(postWithRetry).toHaveBeenCalledWith("/api/workflow/promptRobot", expect.objectContaining(selection), expect.anything())
  })
})