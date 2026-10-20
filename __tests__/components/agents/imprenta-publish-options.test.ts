import { getPublishOptions } from "@/app/components/agents/imprenta-publish-options"

describe("publish account inventory", () => {
  it("exposes legacy site and agent accounts independently alongside new connections", () => {
    const options = getPublishOptions({ settings: { channels: {
      email: { enabled: true, status: "synced", email: "site@example.com" },
      agent_email: { status: "active", inbox_id: "agent@example.com" },
      whatsapp: { enabled: true, status: "active", existingNumber: "+15550000003" },
      connections: [
        { id: "email-2", type: "email", status: "connected", metadata: { email: "second@example.com" } },
        { id: "wa-2", type: "whatsapp", status: "connected", metadata: { phone_number: "+15550000002" } },
      ],
    } } })
    expect(options.filter((option) => option.mode === "mail").map((option) => option.key)).toEqual([
      "mail:connection:email-2", "mail:connection:legacy%3Aemail", "mail:connection:legacy%3Aagent_email",
    ])
    expect(options.filter((option) => option.mode === "whatsapp").map((option) => option.key)).toEqual([
      "whatsapp:connection:wa-2", "whatsapp:connection:legacy%3Awhatsapp",
    ])
  })

  it("disambiguates accounts even when display names and addresses are identical", () => {
    const options = getPublishOptions({ settings: { channels: { connections: [
      { id: "wa-1", type: "whatsapp", status: "connected", name: "Sales" },
      { id: "wa-2", type: "whatsapp", status: "connected", name: "Sales" },
    ] } } })
    expect(options.map((option) => option.label)).toEqual(["WhatsApp · Sales · wa-1", "WhatsApp · Sales · wa-2"])
  })

  it("does not reactivate explicitly inactive social pages or show a platform-less row", () => {
    const options = getPublishOptions({ settings: { social_media: [
      { id: "inactive", platform: "facebook", isActive: false, connectedPages: [{ id: "page", name: "Inactive" }] },
      { id: "unknown", isActive: true },
    ] } })
    expect(options).toEqual([])
  })

  it("does not expose disabled connections through exact or ID-less fallback options", () => {
    expect(getPublishOptions({ settings: { channels: { connections: [
      { id: "manual", type: "whatsapp", status: "connected", _license: { manually_disabled: true } },
      { type: "sms", status: "connected", enabled: false },
      { id: "quota", type: "email", status: "connected", license_suspended: true },
      { type: "voice", status: "active", _license: { manually_disabled: true } },
      { type: "telegram", status: "synced" },
    ] } } })).toEqual([])
  })

  it("keeps available Voice accounts and omits unavailable peers of the same channel", () => {
    const options = getPublishOptions({ settings: { channels: { connections: [
      { id: "disabled", type: "voice", status: "connected", enabled: false },
      { id: "voice", type: "voice", status: "synced" },
    ] } } })
    expect(options.map(option => option.key)).toEqual(["voice:connection:voice", "voice-agent-call:connection:voice"])
  })
})