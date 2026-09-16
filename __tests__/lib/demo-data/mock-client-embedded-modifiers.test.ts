import { createDemoMockClientImpl } from "@/lib/demo-data/mock-client-impl"
import {
  buildConversationListSelect,
  limitEmbeddedConversationMessages,
} from "@/app/services/conversations/conversation-list-query"

describe("demo query embedded modifiers", () => {
  it("limits an embedded relation without limiting parent conversations", async () => {
    const client = await createDemoMockClientImpl("demo-ecom-es-456")
    const query = limitEmbeddedConversationMessages(
      client
        .from("conversations")
        .select(
          buildConversationListSelect({
            includeInitiationData: false,
            useInnerLead: false,
          })
        )
        .eq("site_id", "demo-ecom-es-456")
        .eq("is_archived", false),
      false
    ).limit(20)

    const { data, error } = await query

    expect(error).toBeNull()
    expect(data.length).toBeGreaterThan(1)
    expect(
      data.every((conversation: any) => conversation.latest_message.length <= 1)
    ).toBe(true)
  })
})
