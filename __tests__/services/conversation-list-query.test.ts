import {
  buildConversationListSelect,
  limitEmbeddedConversationMessages,
} from "@/app/services/conversations/conversation-list-query"
import { createClient } from "@supabase/supabase-js"

function createQueryRecorder() {
  const query = {
    order: jest.fn(),
    limit: jest.fn(),
    or: jest.fn(),
  }
  query.order.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  query.or.mockReturnValue(query)
  return query
}

describe("conversation list query", () => {
  it("selects a bounded latest-message relation instead of full histories", () => {
    const select = buildConversationListSelect({
      includeInitiationData: false,
      useInnerLead: false,
    })
    const query = createQueryRecorder()

    limitEmbeddedConversationMessages(query, false)

    expect(select).toContain("latest_message:messages")
    expect(select).not.toContain("first_message:messages")
    expect(select).not.toContain("user_id")
    expect(select).not.toContain("messages (\n        content")
    expect(query.limit).toHaveBeenCalledWith(1, {
      referencedTable: "latest_message",
    })
  })

  it("loads only bounded initiation markers when that filter is active", () => {
    const select = buildConversationListSelect({
      includeInitiationData: true,
      useInnerLead: true,
    })
    const query = createQueryRecorder()

    limitEmbeddedConversationMessages(query, true)

    expect(select).toContain("first_message:messages")
    expect(select).toContain("visitor_messages:messages")
    expect(select).toContain("leads!inner")
    expect(query.limit).toHaveBeenCalledWith(1, {
      referencedTable: "first_message",
    })
    expect(query.limit).toHaveBeenCalledWith(1, {
      referencedTable: "visitor_messages",
    })
    expect(query.or).toHaveBeenCalledWith(
      "role.eq.visitor,role.eq.user",
      { referencedTable: "visitor_messages" }
    )
  })

  it("generates PostgREST parameters for each bounded alias", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "content-type" ? "application/json" : null,
        },
        text: async () => "[]",
        json: async () => [],
      }
    )
    const supabase = createClient(
      "https://example.supabase.co",
      "public-anon-key",
      { global: { fetch: fetchMock } }
    )
    const select = buildConversationListSelect({
      includeInitiationData: true,
      useInnerLead: false,
    })

    await limitEmbeddedConversationMessages(
      supabase.from("conversations").select(select),
      true
    )

    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]))
    expect(requestUrl.searchParams.get("latest_message.limit")).toBe("1")
    expect(requestUrl.searchParams.get("latest_message.order")).toBe(
      "created_at.desc,id.desc"
    )
    expect(requestUrl.searchParams.get("first_message.limit")).toBe("1")
    expect(requestUrl.searchParams.get("first_message.order")).toBe(
      "created_at.asc,id.asc"
    )
    expect(requestUrl.searchParams.get("visitor_messages.limit")).toBe("1")
    expect(requestUrl.searchParams.get("visitor_messages.or")).toBe(
      "(role.eq.visitor,role.eq.user)"
    )
  })
})
