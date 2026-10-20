import {
  getChannelDescription,
  getChannelLabel,
  getChannelRoutingMetadata,
  getEnabledSiteChannels,
  type SiteChannelSource,
  normalizeChannel,
  leadHasChannel
} from "@/lib/site-channels"

describe("site-channels", () => {
  it("normalizes website_chat to web and twitter to x", () => {
    expect(normalizeChannel("website_chat")).toBe("web")
    expect(normalizeChannel("twitter")).toBe("x")
    expect(normalizeChannel(undefined)).toBe("web")
  })

  it("returns labels and descriptions for new channels", () => {
    expect(getChannelLabel("messenger")).toBe("Messenger")
    expect(getChannelLabel("instagram")).toBe("Instagram")
    expect(getChannelLabel("telegram")).toBe("Telegram")
    expect(getChannelLabel("sms")).toBe("SMS")
    expect(getChannelLabel("voice")).toBe("Voice")
    expect(getChannelDescription("messenger")).toBe("Send via Messenger")
  })

  it("includes legacy and connection channels without duplicates", () => {
    const channels = getEnabledSiteChannels({
      tracking: { enable_chat: true },
      settings: {
        channels: {
          email: { enabled: true, status: "synced" },
          whatsapp: { enabled: true, status: "active" },
          connections: [
            { type: "whatsapp", status: "connected" },
            { type: "messenger", status: "connected" },
            { type: "instagram", status: "connected" },
            { type: "telegram", status: "pending" },
            { type: "sms", status: "connected" },
          ],
        },
      },
    })

    expect(channels).toEqual(["whatsapp", "messenger", "instagram", "sms", "email", "web"])
  })

  it("includes active social media accounts as channels", () => {
    const channels = getEnabledSiteChannels({
      settings: {
        social_media: [
          { network: "facebook", isActive: true },
          { platform: "linkedin", isActive: true },
          { network: "twitter", isActive: true }, // Should normalize to "x"
          { network: "youtube", isActive: 1 },
          { network: "tiktok", isActive: true }, // Not a communication channel
          { network: "instagram", isActive: false },
        ]
      }
    })

    expect(channels).toEqual(["facebook", "linkedin", "x", "youtube"])
  })

  it("ignores disconnected connections and includes agent channels", () => {
    const channels = getEnabledSiteChannels({
      settings: {
        channels: {
          agent_email: { status: "active" },
          agent_whatsapp: { status: "active" },
          website: { enable_chat: true },
          connections: [
            { type: "voice", status: "disconnected" },
            { type: "telegram", status: "connected" },
          ],
        },
      },
    })

    expect(channels).toEqual(["whatsapp", "telegram", "email", "web"])
  })

  it("exposes stable routing metadata for connected channels", () => {
    const site = {
      settings: {
        channels: {
          connections: [
            {
              id: "connection-1",
              type: "sms",
              status: "connected",
              zavu_sender_id: "snd_1",
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

    expect(getChannelRoutingMetadata(site, "sms")).toEqual({
      channel: "sms",
      connection_id: "connection-1",
      sender_id: "snd_1",
      phone_number_id: "pn_1",
      phone_number: "+14155550100",
      capabilities: ["sms", "voice"],
      regulatory_status: "approved",
    })
    expect(getChannelRoutingMetadata(site, "voice")).toBeUndefined()
  })

  it.each([{ enabled: false }, { license_suspended: true }, { _license: { manually_disabled: true } },
    { status: "disabled", enabled: false, license_suspended: false, _license: { manually_disabled: true } }])("never offers or routes a disabled connection: %p", flags => {
    const connections: NonNullable<NonNullable<NonNullable<SiteChannelSource["settings"]>["channels"]>["connections"]> = [
      { id: "disabled", type: "whatsapp", status: "connected", ...flags },
    ]
    const site = { settings: { channels: { connections } } }
    expect(getEnabledSiteChannels(site)).toEqual([])
    expect(getChannelRoutingMetadata(site, "whatsapp")).toBeUndefined()
    expect(getChannelRoutingMetadata(site, "whatsapp", "disabled")).toBeUndefined()
    site.settings.channels.connections.push({ id: "active", type: "whatsapp", status: "connected" })
    expect(getEnabledSiteChannels(site)).toEqual(["whatsapp"])
    expect(getChannelRoutingMetadata(site, "whatsapp")?.connection_id).toBe("active")
    expect(getChannelRoutingMetadata(site, "whatsapp", "disabled")).toBeUndefined()
  })

  it("uses Voice compatibility only for Voice connections, not other types or missing types", () => {
    const site: SiteChannelSource = { settings: { channels: { connections: [
      { id: "email", type: "email", status: "synced" },
      { id: "wa", type: "whatsapp", status: "active" },
      { id: "unknown", status: "connected" },
      { id: "voice", type: "voice", status: "active" },
      { id: "voice-synced", type: "voice", status: "synced" },
    ] } } }
    expect(getEnabledSiteChannels(site)).toEqual(["voice"])
    expect(getChannelRoutingMetadata(site, "voice")?.connection_id).toBe("voice")
    expect(getChannelRoutingMetadata(site, "voice", "voice-synced")?.connection_id).toBe("voice-synced")
    expect(getChannelRoutingMetadata(site, "web")).toBeUndefined()
  })

  it("honors explicitly disabled legacy agent channels without changing active legacy status support", () => {
    expect(getEnabledSiteChannels({ settings: { channels: {
      agent_email: { status: "active", enabled: false },
      agent_whatsapp: { status: "active", enabled: false },
    } } })).toEqual([])
  })

  describe("leadHasChannel", () => {
    it("returns true for web always", () => {
      expect(leadHasChannel({}, "web")).toBe(true)
    })

    it("checks email and phone correctly", () => {
      expect(leadHasChannel({ email: "test@example.com" }, "email")).toBe(true)
      expect(leadHasChannel({}, "email")).toBe(false)
      
      expect(leadHasChannel({ phone: "123" }, "whatsapp")).toBe(true)
      expect(leadHasChannel({ phone: "123" }, "sms")).toBe(true)
      expect(leadHasChannel({ phone: "123" }, "voice")).toBe(true)
      expect(leadHasChannel({}, "whatsapp")).toBe(false)
    })

    it("checks social networks correctly", () => {
      const lead = {
        social_networks: {
          instagram: "insta",
          facebook: "fb",
          telegram: "tg",
          linkedin: "in",
          twitter: "tw"
        }
      }
      expect(leadHasChannel(lead, "instagram")).toBe(true)
      expect(leadHasChannel(lead, "messenger")).toBe(true)
      expect(leadHasChannel(lead, "telegram")).toBe(true)
      expect(leadHasChannel(lead, "facebook")).toBe(true)
      expect(leadHasChannel(lead, "linkedin")).toBe(true)
      expect(leadHasChannel(lead, "x")).toBe(true)
      expect(leadHasChannel(lead, "youtube")).toBe(false)
      expect(leadHasChannel(lead, "threads")).toBe(false)
    })
    
    it("handles messenger via messenger key", () => {
      expect(leadHasChannel({ social_networks: { messenger: "msg" } }, "messenger")).toBe(true)
    })
    
    it("handles telegram via phone", () => {
      expect(leadHasChannel({ phone: "123" }, "telegram")).toBe(true)
    })
  })
})
