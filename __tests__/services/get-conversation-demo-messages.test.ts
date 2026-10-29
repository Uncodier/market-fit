import { createClient } from "@/lib/supabase/client"
import { createDemoMockClient } from "@/lib/demo-data/mock-client"
import { getDemoData } from "@/lib/demo-data"
import { getConversationMessages } from "@/app/services/getConversationMessages.client"

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))

describe("demo conversation history through the lazy client", () => {
  it("supports cancellation after maybeSingle without treating the promise as a query builder", async () => {
    const client = createDemoMockClient("demo-saas-en-123")
    const controller = new AbortController()
    const query = client.from("conversations").select("custom_data")
      .eq("id", "conv-saas-1").maybeSingle().abortSignal(controller.signal)
    const { data } = await query
    expect(data.id).toBe("conv-saas-1")
    controller.abort()
    await expect(Promise.resolve(query)).rejects.toMatchObject({ name: "AbortError" })
  })

  it.each(["demo-saas-en-123", "demo-ecom-es-456", "demo-habituall"])(
    "loads seeded history for %s with the production message reader",
    async siteId => {
      const client = createDemoMockClient(siteId)
      jest.mocked(createClient).mockReturnValue(client as ReturnType<typeof createClient>)
      const seed = await getDemoData(siteId)
      if (!seed) throw new Error(`Missing demo seed: ${siteId}`)
      const seededMessages = seed.messages as Array<{ id: string; conversation_id: string; content: string }>
      const conversations = (seed.conversations as Array<{ id: string }>).filter(conversation =>
        seededMessages.some(message => message.conversation_id === conversation.id),
      )
      expect(conversations.length).toBeGreaterThan(0)
      for (const conversation of conversations) {
        const messages = await getConversationMessages(conversation.id)
        expect(messages.length).toBeGreaterThan(0)
        const expected = seededMessages.filter(message => message.conversation_id === conversation.id)
        expect(messages.every(message => expected.some(row => row.id === message.id && row.content === message.text))).toBe(true)
        expect(messages.every(message => Number.isFinite(message.timestamp.getTime()))).toBe(true)
      }
      if (siteId === "demo-saas-en-123") {
        expect((await getConversationMessages("conv-saas-1")).map(message => message.id))
          .toEqual(["msg-saas-1", "msg-saas-2", "msg-saas-3", "msg-saas-4"])
      }
    },
  )

  it("excludes pending messages from history and preserves nullable status rows", async () => {
    const client = createDemoMockClient("demo-saas-en-123")
    jest.mocked(createClient).mockReturnValue(client as ReturnType<typeof createClient>)
    await client.from("conversations").insert({ id: "demo-status-regression", custom_data: { source: "website_chat" } })
    const rows = [
      { id: "demo-pending", custom_data: { status: "pending" } },
      { id: "demo-completed", custom_data: { status: "completed" } },
      { id: "demo-null", custom_data: null },
      { id: "demo-missing", custom_data: {} },
    ].map((row, index) => ({ ...row, conversation_id: "demo-status-regression", role: "assistant",
      content: row.id, created_at: new Date(index * 1000).toISOString() }))
    await client.from("messages").insert(rows)
    const { data: history } = await client.from("messages").select("*")
      .eq("conversation_id", "demo-status-regression")
      .or("custom_data->>status.neq.pending,custom_data->>status.is.null")
    expect(history.map((row: { id: string }) => row.id)).toEqual(["demo-completed", "demo-null", "demo-missing"])
    expect((await getConversationMessages("demo-status-regression")).map(message => message.id))
      .toEqual(rows.map(row => row.id))
  })
})