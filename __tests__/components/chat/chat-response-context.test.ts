import { findPromptForChatResponse } from "@/app/components/chat/chat-response-context"
import { ChatMessage } from "@/app/types/chat"

function message(partial: Partial<ChatMessage> & Pick<ChatMessage, "role" | "text">): ChatMessage {
  return {
    timestamp: new Date("2026-09-15T12:00:00.000Z"),
    ...partial,
  }
}

describe("findPromptForChatResponse", () => {
  it("uses the closest earlier human message by timestamp", () => {
    const messages = [
      message({ role: "team_member", text: "Latest ask", timestamp: new Date("2026-09-15T12:02:00.000Z") }),
      message({ role: "user", text: "Older ask", timestamp: new Date("2026-09-15T12:01:00.000Z") }),
      message({ role: "assistant", text: "Answer", timestamp: new Date("2026-09-15T12:03:00.000Z") }),
    ]

    expect(findPromptForChatResponse(messages, 2)).toBe("Latest ask")
  })

  it("ignores later messages even when the source array is not chronological", () => {
    const messages = [
      message({ role: "visitor", text: "Future ask", timestamp: new Date("2026-09-15T12:04:00.000Z") }),
      message({ role: "assistant", text: "Answer", timestamp: new Date("2026-09-15T12:03:00.000Z") }),
      message({ role: "team_member", text: "Actual ask", timestamp: new Date("2026-09-15T12:02:00.000Z") }),
    ]

    expect(findPromptForChatResponse(messages, 1)).toBe("Actual ask")
  })
})
