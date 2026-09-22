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
