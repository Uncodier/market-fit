import {
  getTopConversation,
  hasValidConversationSelection,
} from "@/app/chat/get-top-conversation"
import { ConversationListItem } from "@/app/types/chat"

function conversation(
  overrides: Partial<ConversationListItem> & Pick<ConversationListItem, "id">
): ConversationListItem {
  return {
    title: overrides.title ?? `Conversation ${overrides.id}`,
    agentId: "agent-1",
    agentName: "Agent",
    timestamp: new Date("2026-08-13T12:00:00.000Z"),
    ...overrides,
  }
}

describe("getTopConversation", () => {
  it("returns undefined when the list is empty", () => {
    expect(getTopConversation([])).toBeUndefined()
  })

  it("returns the first pending conversation when any exist", () => {
    const conversations = [
      conversation({ id: "active-1", status: "active" }),
      conversation({ id: "pending-1", status: "pending" }),
      conversation({ id: "pending-2", status: "pending" }),
    ]

    expect(getTopConversation(conversations)?.id).toBe("pending-1")
  })

  it("returns the first conversation when none are pending", () => {
    const conversations = [
      conversation({ id: "active-1", status: "active" }),
      conversation({ id: "active-2", status: "closed" }),
    ]

    expect(getTopConversation(conversations)?.id).toBe("active-1")
  })
})

describe("hasValidConversationSelection", () => {
  it("is false when nothing is selected", () => {
    expect(hasValidConversationSelection()).toBe(false)
    expect(hasValidConversationSelection("")).toBe(false)
  })

  it("is false for temporary new conversations", () => {
    expect(hasValidConversationSelection("new-123")).toBe(false)
  })

  it("is true for a real conversation id", () => {
    expect(hasValidConversationSelection("conv-1")).toBe(true)
  })
})
