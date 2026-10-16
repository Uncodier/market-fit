import {
  buildPublishRouting,
  getPublishChannelAvailability,
  getTestRecipient,
  togglePublishDestination,
} from "@/app/components/agents/imprenta-publish-routing"

const site = {
  settings: {
    channels: {
      connections: [
        {
          id: "sms-channel",
          type: "sms",
          status: "connected",
          zavu_sender_id: "snd_shared",
          metadata: {
            phone_number: "+14155550100",
            phone_number_id: "pn_1",
            capabilities: ["sms", "voice"],
            regulatory_status: "approved",
          },
        },
        {
          id: "voice-channel",
          type: "voice",
          status: "connected",
          zavu_sender_id: "snd_shared",
          metadata: {
            phone_number: "+14155550100",
            phone_number_id: "pn_1",
            capabilities: ["sms", "voice"],
            regulatory_status: "approved",
          },
        },
      ],
    },
  },
}

describe("Imprenta publish routing", () => {
  it("uses the selected second WhatsApp connection instead of the first", () => {
    const routing = buildPublishRouting(["whatsapp:connection:wa-2"], { settings: { channels: { connections: [
      { id: "wa-1", type: "whatsapp", status: "connected", zavu_sender_id: "sender-one" },
      { id: "wa-2", type: "whatsapp", status: "connected", zavu_sender_id: "sender-two" },
    ] } } })
    expect(routing.channelRouting.whatsapp).toMatchObject({ connection_id: "wa-2", sender_id: "sender-two" })
    expect(routing.publishOverride).toEqual({ channel: "whatsapp", connection_id: "wa-2" })
    expect(routing.bulkMessageOverride).toEqual({ channel: "whatsapp", connection_id: "wa-2" })
  })

  it("preserves two accounts of the same channel as separate delivery routes", () => {
    const routing = buildPublishRouting(["whatsapp:connection:wa-1", "whatsapp:connection:wa-2"])
    expect(routing.deliveryChannels).toEqual(["whatsapp"])
    expect(routing.publishOverride.delivery_routes).toEqual([
      { channel: "whatsapp", connection_id: "wa-1" }, { channel: "whatsapp", connection_id: "wa-2" },
    ])
    expect(routing.bulkMessageOverride.delivery_routes).toEqual(routing.publishOverride.delivery_routes)
    expect(routing.channelRouting).toEqual({})
  })

  it("preserves account-specific mail/newsletter modes alongside exact social IDs", () => {
    const routing = buildPublishRouting(["mail:connection:email-2", "newsletter:connection:email-1", "facebook:social:fb-2"])
    expect(routing.publishOverride).toEqual({
      social_accounts: ["fb-2"], social_account_targets: [{ id: "fb-2", network: "facebook" }], delivery_routes: [
        { channel: "email", connection_id: "email-2", audience_email_mode: "mail" },
        { channel: "email", connection_id: "email-1", audience_email_mode: "newsletter" },
      ],
    })
  })

  it("never substitutes another connection for a missing explicit ID", () => {
    const routing = buildPublishRouting(["sms:connection:missing"], site)
    expect(routing.publishOverride.connection_id).toBe("missing")
    expect(routing.channelRouting).toEqual({})
  })

  it("uses specific voice targets and retains conversational-call exclusivity", () => {
    expect(togglePublishDestination(["mail:connection:email-1", "facebook:social:fb-1"], "voice-agent-call:connection:voice-2"))
      .toEqual(["facebook:social:fb-1", "voice-agent-call:connection:voice-2"])
    expect(buildPublishRouting(["voice-agent-call:connection:voice-2"]).publishOverride)
      .toEqual({ channel: "voice", connection_id: "voice-2", voice_mode: "agent_call" })
  })

  it("uses connected account IDs instead of platform names", () => {
    const routing = buildPublishRouting(["tiktok", "instagram", "blog"], {
      settings: { social_media: [
        { id: "tt-account", network: "tiktok", isActive: 1 },
        { id: "ig-account", platform: "instagram", isActive: true },
      ] },
    })
    expect(routing.publishOverride.social_accounts).toEqual(["tt-account", "ig-account"])
  })

  it("leaves unresolved selectors for authoritative server validation without dropping destinations", () => {
    const routing = buildPublishRouting(["instagram", "tiktok"], {
      settings: { social_media: [
        { id: "old-ig", platform: "instagram", isActive: false },
        { id: "tt-one", platform: "tiktok", isActive: true },
        { id: "tt-two", platform: "tiktok", isActive: true },
      ] },
    })
    expect(routing.publishOverride.social_accounts).toEqual(["instagram", "tiktok"])
  })

  it("normalizes Twitter aliases and deduplicates IDs", () => {
    const routing = buildPublishRouting(["twitter", "x"], {
      settings: { social_media: [{ id: "x-account", network: "x", isActive: true }] },
    })
    expect(routing.publishOverride.social_accounts).toEqual(["x-account"])
  })

  it("discovers SMS and Voice from channel connections", () => {
    expect(getPublishChannelAvailability(site)).toMatchObject({
      sms: true,
      voice: true,
    })
  })

  it("keeps simultaneous SMS and Voice routes without collapsing them", () => {
    const routing = buildPublishRouting(["sms", "voice"], site)

    expect(routing.deliveryChannels).toEqual(["sms", "voice"])
    expect(routing.distributionModes).toMatchObject({ sms: true, voice: true })
    expect(routing.channelRouting.sms).toMatchObject({ sender_id: "snd_shared" })
    expect(routing.channelRouting.voice).toMatchObject({ sender_id: "snd_shared" })
    expect(routing.bulkMessageOverride).not.toHaveProperty("channel")
  })

  it("uses a deterministic override for one selected channel", () => {
    expect(buildPublishRouting(["sms"], site).bulkMessageOverride).toMatchObject({ channel: "sms" })
    expect(buildPublishRouting(["newsletter"], site).bulkMessageOverride).toMatchObject({
      channel: "email",
      audience_email_mode: "newsletter",
    })
  })

  it.each([
    ["voice", "tts"],
    ["voice-agent-call", "agent_call"],
  ] as const)(
    "maps %s to voice with its explicit mode",
    (destination, voiceMode) => {
      const routing = buildPublishRouting([destination], site)

      expect(routing.deliveryChannels).toEqual(["voice"])
      expect(routing.voiceMode).toBe(voiceMode)
      expect(routing.channelRouting.voice).toMatchObject({
        sender_id: "snd_shared",
      })
      expect(routing.publishOverride).toEqual({
        channel: "voice",
        voice_mode: voiceMode,
      })
    }
  )

  it("resolves legacy conflicting voice selections deterministically", () => {
    const routing = buildPublishRouting(["voice", "voice-agent-call"], site)

    expect(routing.deliveryChannels).toEqual(["voice"])
    expect(routing.voiceMode).toBe("agent_call")
    expect(routing.publishOverride).toEqual({
      channel: "voice",
      voice_mode: "agent_call",
    })
  })

  it("keeps the voice destinations mutually exclusive when toggled", () => {
    expect(togglePublishDestination(["voice", "sms"], "voice-agent-call")).toEqual([
      "voice-agent-call",
    ])
    expect(togglePublishDestination(["voice-agent-call", "sms"], "voice")).toEqual([
      "sms",
      "voice",
    ])
  })

  it("keeps conversational calls exclusive from other delivery channels", () => {
    const routing = buildPublishRouting(
      ["sms", "voice-agent-call", "linkedin"],
      site
    )

    expect(routing.deliveryChannels).toEqual(["voice"])
    expect(routing.publishOverride).toMatchObject({
      channel: "voice",
      voice_mode: "agent_call",
      social_accounts: ["linkedin"],
    })
  })

  it("does not confuse lead IDs with test destinations", () => {
    expect(getTestRecipient(["sms"], {
      lead_id: "lead_1",
      phone: "+14155550100",
    })).toBe("+14155550100")
    expect(getTestRecipient(["sms", "voice"], {
      phone: "+14155550100",
    })).toBeUndefined()
  })

  it("uses the phone recipient for a voice agent call", () => {
    const routing = buildPublishRouting(["voice-agent-call"], site)

    expect(getTestRecipient(routing.deliveryChannels, {
      email: "lead@example.com",
      phone: "+14155550100",
    })).toBe("+14155550100")
  })
})
