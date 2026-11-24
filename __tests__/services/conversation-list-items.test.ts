import { buildConversationListItems } from "@/app/services/conversations/conversation-list-items"
import type { ConversationListRow } from "@/app/services/conversations/conversation-list-query"

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

  it.each([
    ['assistant', { status: 'accepted' }, true],
    ['team_member', { status: 'accepted', dispatch_owner: 'chat_intervention' }, false],
    ['team_member', { status: 'pending', command_status: 'pending' }, false],
  ] as const)("uses the bounded latest message and derives proposal moderation flags: %s %j", async (role, custom_data, proposal) => {
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === 'profiles') return resolvedQuery([{ id: 'user-1', name: 'Alex Owner' }])
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
              role, custom_data,
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
        status: proposal ? "pending" : "active",
        hasAcceptedMessage: proposal,
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
    ).rejects.toMatchObject({ status: 503 })
  })

  it('batches distinct assignees once per page without caching hidden names across actors', async () => {
    const rows = [1, 2, 3].map(i => ({ id: `c${i}`, lead_id: `l${i}` } as ConversationListRow))
    const leads = [1, 2, 3].map(i => ({ id: `l${i}`, assignee_id: i === 1 ? 'a' : 'b' }))
    const profiles = resolvedQuery([{ id: 'b', name: 'Visible name' }])
    const from = jest.fn((table: string) => table === 'profiles' ? profiles : resolvedQuery(table === 'leads' ? leads : []))
    const first = await buildConversationListItems({ from }, rows)
    expect(from.mock.calls.filter(([table]) => table === 'profiles')).toHaveLength(1)
    expect(profiles.select).toHaveBeenCalledWith('id, name')
    expect(profiles.in).toHaveBeenCalledWith('id', ['a', 'b'])
    expect(first.map(row => row.agentName)).toEqual(['Team Member', 'Visible name', 'Visible name'])
    const second = await buildConversationListItems({ from: (table: string) => resolvedQuery(table === 'leads' ? leads : []) }, rows)
    expect(second.every(row => row.agentName === 'Team Member')).toBe(true)
    await expect(buildConversationListItems({ from: (table: string) => table === 'profiles'
      ? resolvedQuery([], { code: '42501' }) : resolvedQuery(table === 'leads' ? leads : []) }, rows)).rejects.toMatchObject({ status: 403 })
  })

  it('uses the joined lead under RLS and does not re-query a hidden relation', async () => {
    const from = jest.fn(() => resolvedQuery([]))
    const base = { id: 'one', lead_id: 'lead', title: 'Conversation' } as ConversationListRow
    const result = await buildConversationListItems({ from }, [
      { ...base, leads: { name: 'Visible', company: { name: 'Shop' }, status: 'qualified', assignee_id: null } },
      { ...base, id: 'two', lead_id: 'other', leads: null },
    ])
    expect(from).not.toHaveBeenCalledWith('leads')
    expect(from).not.toHaveBeenCalledWith('profiles')
    expect(result.map(item => item.leadName)).toEqual(['Visible (Shop)', undefined])
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

  it("shows the participant plus canonical post while preserving meaningful custom titles", async () => {
    const supabase = { from: jest.fn(() => resolvedQuery([])) }
    const base: ConversationListRow = {
      id: "comment-1", title: "Instagram comments", agent_id: null, lead_id: null, channel: "instagram",
      status: "active", created_at: "2026-10-01T00:00:00Z", last_message_at: null,
      custom_data: { source: "comment", comment_grouping_version: 1, network: "instagram",
        outstand_post_id: "post-1", publisher_account_id: "owned", publisher_username: "publisher",
        author_id: "reader", author_name: "Reader", post_title: "Spring collection" },
    }
    const items = await buildConversationListItems(supabase, [base,
      { ...base, id: "comment-2", title: "Urgent comments" },
      { ...base, id: "comment-3", custom_data: { ...base.custom_data, outstand_post_id: "post-2", post_title: "Autumn collection" } },
      { ...base, id: "legacy", custom_data: { ...base.custom_data, comment_grouping_version: undefined } },
    ])
    expect(items.map(item => [item.title, item.participantName, item.subtitle])).toEqual([
      ["Reader", "Reader", "Spring collection"],
      ["Urgent comments", "Reader", "Spring collection"],
      ["Reader", "Reader", "Autumn collection"],
      ["Instagram contact", "Instagram contact", "Comments · post context in messages"],
    ])
  })
})
