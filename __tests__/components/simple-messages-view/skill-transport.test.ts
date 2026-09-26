import { sendAssistantMessage, sendRobotMessage } from "@/app/components/simple-messages-view/hooks/message-send-handlers"
import { markRobotInstanceErrorIfUnanswered, postWithRetry } from "@/app/components/simple-messages-view/hooks/send-message-reliability"

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

  it("shows the assistant's concrete validation error for oversized skills", async () => {
    (postWithRetry as jest.Mock).mockResolvedValueOnce({ success: false, status: 400,
      error: { message: "Selected skills are too large for a single assistant turn (48 KB max)." } })
    const toast = jest.fn()
    await sendAssistantMessage({ messageToSend: "hello", siteId: "site", selectedActivity: "chat", selectedContext,
      skillSelection: selection, toast })
    expect(toast).toHaveBeenCalledWith({ title: "Error",
      description: "Selected skills are too large for a single assistant turn (48 KB max).", variant: "destructive" })
  })

  it("does not mark an existing instance as failed for a rejected skill selection", async () => {
    (postWithRetry as jest.Mock).mockResolvedValueOnce({ success: false, status: 400,
      error: { message: "Selected skills are too large for a single assistant turn (48 KB max)." } })
    const toast = jest.fn()
    await sendAssistantMessage({ messageToSend: "hello", siteId: "site", selectedActivity: "chat", selectedContext,
      activeRobotInstance: { id: "instance-a" }, skillSelection: selection, toast })
    expect(markRobotInstanceErrorIfUnanswered).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining("48 KB max") }))
  })

  it("does not send skills to a new Temporal robot workflow", async () => {
    await sendRobotMessage({ messageToSend: "hello", siteId: "site", selectedContext,
      toast: jest.fn(), setThinkingStateWithTimeout: jest.fn(), setNewMakinaThinking: jest.fn(),
      clearThinkingState: jest.fn(), clearNewMakinaThinking: jest.fn() })
    expect(postWithRetry).toHaveBeenCalledWith("/api/workflow/startRobot", expect.objectContaining({ activity: "robot", message: "hello" }))
    const payload = (postWithRetry as jest.Mock).mock.calls[0][1]
    expect(payload).not.toHaveProperty("skill_mode")
    expect(payload).not.toHaveProperty("skill_slugs")
  })

  it("does not send skills to an existing Temporal robot workflow", async () => {
    await sendRobotMessage({ messageToSend: "hello", siteId: "site", selectedContext,
      activeRobotInstance: { id: "robot", status: "running" }, toast: jest.fn(),
      setThinkingStateWithTimeout: jest.fn(), setNewMakinaThinking: jest.fn(),
      clearThinkingState: jest.fn(), clearNewMakinaThinking: jest.fn() })
    expect(postWithRetry).toHaveBeenCalledWith("/api/workflow/promptRobot", expect.objectContaining({ instance_id: "robot", message: "hello" }), expect.anything())
    const payload = (postWithRetry as jest.Mock).mock.calls[0][1]
    expect(payload).not.toHaveProperty("skill_mode")
    expect(payload).not.toHaveProperty("skill_slugs")
  })
})