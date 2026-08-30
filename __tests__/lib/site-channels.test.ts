import {
  getChannelDescription,
  getChannelLabel,
  getEnabledSiteChannels,
  normalizeChannel,
} from "@/lib/site-channels"

describe("site-channels", () => {
  it("normalizes website_chat to web", () => {
    expect(normalizeChannel("website_chat")).toBe("web")
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
})
