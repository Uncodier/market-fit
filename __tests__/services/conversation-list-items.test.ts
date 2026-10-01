import { buildConversationListItems } from "@/app/services/conversations/conversation-list-items"
import { getUserData } from "@/app/services/user-service"
import type { ConversationListRow } from "@/app/services/conversations/conversation-list-query"

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

  it("uses DM metadata without creating a fake lead and preserves linked/manual names", async () => {
    const supabase = { from: jest.fn((table: string) => resolvedQuery(table === 'leads'
      ? [{ id: 'lead-1', name: 'CRM name' }] : [])) }
    const base: ConversationListRow = {
      id: 'dm-1', title: 'Instagram direct message', agent_id: 'agent-1', lead_id: null,
      channel: 'instagram', status: 'active', created_at: '2026-09-30T00:00:00Z', last_message_at: null,
      custom_data: { source: 'outstand_dm', participant_display_name: 'Taylor' },
    }
    const items = await buildConversationListItems(supabase, [
      base,
      { ...base, id: 'dm-2', custom_data: { source: 'outstand_dm', participant_username: 'taylor' } },
      { ...base, id: 'dm-3', lead_id: 'lead-1' },
      { ...base, id: 'dm-4', title: 'Manual subject', lead_id: 'lead-1' },
      { ...base, id: 'dm-5', custom_data: { source: 'outstand_dm', outstand_participant_id: '123456', outstand_social_account_id: 'owned' } },
    ])
    expect(items.map(item => [item.title, item.participantName, item.leadName])).toEqual([
      ['Taylor', 'Taylor', undefined], ['@taylor', '@taylor', undefined],
      ['CRM name', 'CRM name', 'CRM name'], ['Manual subject', 'CRM name', 'CRM name'],
      ['Instagram contact', 'Instagram contact', undefined],
    ])
  })
})
