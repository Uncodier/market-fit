import { strengthenImprentaAssistantPayload } from "@/app/api/robots/instance/assistant/imprenta-contract"
import { PublishContractValidationError, resolveImplicitPublishDestinations } from "@/app/api/robots/instance/assistant/publish-contract"
import { publishDestinationKey, parsePublishDestination, getPublishTestRecipientKinds } from "@/lib/content/publish-destinations"
import { destinationsRequireAudience } from "@/app/components/agents/imprenta-publish-context"

const node = {
  id: "node", instance_id: "instance", site_id: "site", type: "publish", prompt: null,
  settings: { publish_destinations: ["whatsapp:connection:wa-2", "mail:connection:email-2", "facebook:social:fb-2"] },
  updated_at: "2026-10-16T00:00:00.000Z",
}

describe("publish destination execution contract", () => {
  it("preserves the implicit Blog default only from trusted site URL configuration", async () => {
    const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: { url: "https://example.com" }, error: null }) }
    const supabase = { from: jest.fn(() => query) } as unknown as Parameters<typeof resolveImplicitPublishDestinations>[1]
    const saved = await resolveImplicitPublishDestinations({ ...node, settings: {} }, supabase)
    const result = strengthenImprentaAssistantPayload({ instance_node_id: node.id }, saved)
    expect(JSON.parse(String(result.context)).publish_destinations).toEqual(["blog"])
    expect(query.eq).toHaveBeenCalledWith("id", node.site_id)
    const explicitlyEmpty = { ...node, settings: { publish_destinations: [] } }
    expect(await resolveImplicitPublishDestinations(explicitlyEmpty, supabase)).toBe(explicitlyEmpty)
    query.maybeSingle.mockResolvedValueOnce({ data: { url: "" }, error: null })
    await expect(resolveImplicitPublishDestinations({ ...node, settings: {} }, supabase)).rejects.toThrow(PublishContractValidationError)
  })
  it("binds saved targets over stale context and forced tool arguments while preserving test settings", () => {
    const result = strengthenImprentaAssistantPayload({
      instance_node_id: node.id,
      context: JSON.stringify({ publish_destinations: ["whatsapp:connection:wrong"], channel_routing: { forged: true } }),
      tool_overrides: { publish: { channel: "whatsapp", connection_id: "wrong", from: "forged@example.com", is_test: true },
        sendBulkMessages: { channel: "sms", delivery_routes: [{ channel: "sms", connection_id: "wrong" }] } },
    }, node)
    const overrides = result.tool_overrides as Record<string, Record<string, unknown>>
    expect(overrides.publish).toEqual({ is_test: true, social_accounts: ["fb-2"], social_account_targets: [{ id: "fb-2", network: "facebook" }], delivery_routes: [
      { channel: "whatsapp", connection_id: "wa-2" },
      { channel: "email", connection_id: "email-2", audience_email_mode: "mail" },
    ] })
    expect(overrides.sendBulkMessages.delivery_routes).toEqual(overrides.publish.delivery_routes)
    expect(overrides.sendBulkMessages).not.toHaveProperty("channel")
    expect(JSON.parse(String(result.context))).toMatchObject({ publish_destinations: node.settings.publish_destinations, publish_channels: ["whatsapp", "email"], channel_routing: {} })
  })

  it("carries email and phone test recipients independently for mixed-channel routes", () => {
    const result = strengthenImprentaAssistantPayload({ instance_node_id: node.id,
      context: JSON.stringify({ is_test: true, test_destination: { email: "test@example.com", phone: "+15550000002" } }),
    }, node)
    expect((result.tool_overrides as Record<string, Record<string, unknown>>).publish.test_recipients)
      .toEqual({ email: "test@example.com", phone: "+15550000002" })
  })

  it.each(["voice-agent-call", "voice-agent-call:connection:voice-2"])("requires outbound greeting generation for %s, including test sends", (destination) => {
    const saved = { ...node, prompt: { text: "Ask about availability; do not claim a booking exists." },
      settings: { publish_destinations: [destination] } }
    const result = strengthenImprentaAssistantPayload({ instance_node_id: node.id,
      message: "Stale request", system_prompt: "Use the connected content.",
      context: JSON.stringify({ is_test: true }), tool_overrides: { publish: { is_test: true } },
    }, saved)
    expect(result.message).toBe(saved.prompt.text)
    expect(result.system_prompt).toContain("Use the connected content.")
    expect(result.system_prompt).toContain("outbound call")
    expect(result.system_prompt).toContain("configured Customer Support voice agent")
    expect(result.system_prompt).toContain("not the Content Creator")
    expect(result.system_prompt).toContain("ask if now is a good time")
    expect(result.system_prompt).toContain("Never use a reception greeting")
    expect(result.system_prompt).toContain("objective and additional_context are private")
    expect(result.system_prompt).toContain("including Send Test")
    const overrides = result.tool_overrides as Record<string, Record<string, unknown>>
    expect(overrides.publish).toMatchObject({ is_test: true, voice_mode: "agent_call" })
    expect(overrides.publish).not.toHaveProperty("text")
    expect(overrides.sendBulkMessages).not.toHaveProperty("message")
  })

  it("clearing a saved voice publish prompt removes stale execution intent", () => {
    const result = strengthenImprentaAssistantPayload({ instance_node_id: node.id, message: "Old private goal" },
      { ...node, prompt: { text: " " }, settings: { publish_destinations: ["voice-agent-call:connection:voice-2"] } })
    expect(result.message).toBe("Execute node")
  })

  it.each(["voice:connection:voice-2", "whatsapp:connection:wa-2", "blog"])("does not impose interactive-call rules on %s", (destination) => {
    const result = strengthenImprentaAssistantPayload({ instance_node_id: node.id, system_prompt: "Existing instructions" },
      { ...node, settings: { publish_destinations: [destination] } })
    expect(result.system_prompt).toBe("Existing instructions")
  })

  it.each([[], null, ["whatsapp:connection:%"], ["whatsapp:social:account"], [123]])("rejects invalid saved destinations %j before execution", (publish_destinations) => {
    expect(() => strengthenImprentaAssistantPayload({ instance_node_id: node.id }, { ...node, settings: { publish_destinations } }))
      .toThrow(PublishContractValidationError)
  })

  it("requires audiences and test recipients for account-specific destinations", () => {
    expect(destinationsRequireAudience(["mail:connection:email-2"])).toBe(true)
    expect(destinationsRequireAudience(["voice-agent-call:connection:voice-2"])).toBe(true)
    expect(destinationsRequireAudience(["facebook:social:fb-2"])).toBe(false)
    expect(getPublishTestRecipientKinds(["newsletter:connection:email-1", "voice-agent-call:connection:voice-2"]))
      .toEqual({ email: true, phone: true })
    expect(() => destinationsRequireAudience(["whatsapp:connection:%"])).not.toThrow()
    expect(getPublishTestRecipientKinds(["mail:connection:%"])).toEqual({ email: true, phone: false })
  })

  it("round-trips reserved legacy IDs and provider IDs with punctuation", () => {
    const key = publishDestinationKey("mail", "connection", "legacy:agent_email")
    expect(parsePublishDestination(key)).toEqual({ mode: "mail", kind: "connection", id: "legacy:agent_email" })
  })
})