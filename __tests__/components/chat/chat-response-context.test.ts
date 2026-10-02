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

  it("uses exact comment IDs, never the nearest question, for feedback context", () => {
    const metadata = { source: "comment", outstand_post_id: "post", platform_comment_id: "comment-1" }
    const messages = [
      message({ id: "original", role: "user", text: "Original comment", metadata }),
      message({ id: "nearby", role: "user", text: "Nearby comment", metadata: { ...metadata, platform_comment_id: "comment-2" } }),
      message({ role: "assistant", text: "Answer", metadata: { ...metadata, reply_to_message_id: "original", reply_to_comment_id: "comment-1" } }),
    ]
    expect(findPromptForChatResponse(messages, 2)).toBe("Original comment")
    messages[2].metadata = { source: "comment" }
    expect(findPromptForChatResponse(messages, 2)).toBeUndefined()
    messages[2].metadata = undefined
    expect(findPromptForChatResponse(messages, 2)).toBeUndefined()
  })

  it("uses exact fetched parent previews absent from the visible page", () => {
    const response = message({ role: "assistant", text: "Answer", metadata: {
      source: "comment", reply_to_message_id: "outside-page", reply_to_comment_id: "comment-1",
    }, replyContext: { availability: "available", messageId: "outside-page", commentId: "comment-1", text: "Original comment" } })
    expect(findPromptForChatResponse([response], 0)).toBe("Original comment")
  })
})
