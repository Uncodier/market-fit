import { buildConversationListItems } from "@/app/services/conversations/conversation-list-items"
import { getUserData } from "@/app/services/user-service"

jest.mock("@/app/services/user-service", () => ({
  getUserData: jest.fn(),
}))

function resolvedQuery(data: unknown[], error: unknown = null) {
  const query: any = {
    select: jest.fn(),
    in: jest.fn(),
    or: jest.fn(),
  }
  query.select.mockReturnValue(query)
  query.in.mockReturnValue(query)
  query.or.mockReturnValue(query)
  query.then = (
    resolve: (value: { data: unknown[]; error: unknown }) => unknown,
    reject: (reason: unknown) => unknown
  ) => Promise.resolve({ data, error }).then(resolve, reject)
  return query
}

describe("buildConversationListItems", () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it("uses the bounded latest message and preserves moderation flags", async () => {
    jest.mocked(getUserData).mockResolvedValue({
      name: "Alex Owner",
      avatar_url: null,
    })

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "agents") {
          return resolvedQuery([{ id: "agent-1", name: "Sales Agent" }])
        }
        if (table === "leads") {
          return resolvedQuery([
            {
              id: "lead-1",
              name: "Taylor",
              company: { name: "Acme" },
              assignee_id: "user-1",
              status: "qualified",
            },
          ])
        }
        if (table === "messages") {
          return resolvedQuery([
            {
              conversation_id: "conversation-1",
              custom_data: { status: "accepted" },
            },
          ])
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    const result = await buildConversationListItems(supabase, [
      {
        id: "conversation-1",
        title: "Untitled Conversation",
        agent_id: "agent-1",
        lead_id: "lead-1",
        last_message_at: "2026-09-15T12:00:00.000Z",
        created_at: "2026-09-15T11:00:00.000Z",
        custom_data: null,
        channel: "website_chat",
        status: "active",
        latest_message: [
          {
            content: "Most recent message",
            created_at: "2026-09-15T12:00:00.000Z",
          },
        ],
      },
    ])

    expect(result).toEqual([
      expect.objectContaining({
        id: "conversation-1",
        title: "Chat with Taylor (Acme)",
        agentName: "Alex Owner",
        leadStatus: "qualified",
        lastMessage: "Most recent message",
        channel: "web",
        status: "pending",
        hasAcceptedMessage: true,
      }),
    ])
  })

  it("rejects moderation lookup errors instead of returning partial data", async () => {
    const moderationError = {
      code: "57014",
      message: "canceling statement due to statement timeout",
    }
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "messages") return resolvedQuery([], moderationError)
        return resolvedQuery([])
      }),
    }
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined)

    await expect(
      buildConversationListItems(supabase, [
        {
          id: "conversation-1",
          title: "Conversation",
          agent_id: null,
          lead_id: null,
          last_message_at: null,
          created_at: "2026-09-15T11:00:00.000Z",
          custom_data: null,
          channel: "web",
          status: "active",
          latest_message: [],
        },
      ])
    ).rejects.toBe(moderationError)

    consoleError.mockRestore()
  })
})
