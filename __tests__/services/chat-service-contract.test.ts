/** @jest-environment node */

import { convertMessagesToChatFormat, convertChatMessageToDbFormat, getConversation, getAgentForConversation } from "@/app/services/chat-service"
import { supabase } from "@/app/services/chat-runtime"
import type { Message } from "@/app/types/chat"

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(),
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }) },
  })),
}))

function queryResult(data: unknown) {
  const query = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error: null }),
  }
  jest.mocked(supabase.from).mockReturnValue(query as ReturnType<typeof supabase.from>)
  return query
}

describe("chat service public exports", () => {
  beforeEach(() => jest.clearAllMocks())

  it("preserves message metadata and sender information without unnecessary profile lookups", async () => {
    const row: Message = {
      id: "message-1", conversation_id: "conversation-1", visitor_id: null,
      agent_id: null, user_id: "user-1", lead_id: null, role: "team_member",
      content: "Hello", read_at: null, command_id: "command-1",
      custom_data: { user_name: "Sam", avatar_url: "/sam.png", status: "failed" },
      created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
    }
    const [message] = await convertMessagesToChatFormat([row])
    expect(message).toMatchObject({
      id: row.id, text: "Hello", sender_id: "user-1", sender_name: "Sam",
      sender_avatar: "/sam.png", command_id: "command-1", metadata: { command_status: "failed" },
    })
    expect(supabase.from).not.toHaveBeenCalled()
    expect(convertChatMessageToDbFormat(row.conversation_id, message, "user-1"))
      .toMatchObject({ conversation_id: row.conversation_id, role: "team_member", user_id: "user-1", content: "Hello" })
  })

  it("preserves embedded messages in a conversation result", async () => {
    const result = { id: "conversation-1", messages: [] }
    const query = queryResult(result)
    await expect(getConversation(result.id)).resolves.toBe(result)
    expect(query.eq).toHaveBeenCalledWith("id", result.id)
    expect(supabase.from).toHaveBeenCalledWith("conversations")
  })

  it("maps agent rows and accepts a nullable role", async () => {
    queryResult({ id: "agent-1", name: "Helper", type: "support", status: "active", role: null,
      description: null, icon: null, conversations: 2, success_rate: 90, tools: {}, activities: {}, integrations: {} })
    await expect(getAgentForConversation("agent-1")).resolves.toMatchObject({
      id: "agent-1", name: "Helper", icon: "HelpCircle", successRate: 90, description: "",
    })
  })
})