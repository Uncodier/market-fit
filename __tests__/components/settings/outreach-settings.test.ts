import { activitiesSchema, normalizeActivitySettings } from "@/app/components/settings/activity-settings"
import { getUsableOutreachAccounts } from "@/app/components/settings/outreach-accounts"
import { getOutreachTimezone, isValidOutreachTimezone, normalizeOutreachSettings, validateOutreachSettings } from "@/lib/outreach-settings"
import { adaptSiteToForm } from "@/app/components/settings/data-adapter"
import { getSiteFormDefaults } from "@/app/components/settings/site-form-defaults"
import { channelsSchema } from "@/app/components/settings/channel-form-schema"

const emailId = "11111111-1111-4111-8111-111111111111"
const whatsappId = "22222222-2222-4222-8222-222222222222"
const smsId = "33333333-3333-4333-8333-333333333333"
const configured = {
  status: "active" as const,
  channel_accounts: { email: [emailId, "agent_email"], whatsapp: [whatsappId], sms: [smsId], telegram: ["telegram-id"], voice: ["voice-id"], "custom-chat_v2": ["custom-id"] },
  segment_ids: ["segment-a", "segment-b"], all_segments: false,
  daily_message_limit: 65, max_unanswered_messages: 3, weekdays: [0, 1, 5],
}

describe("outreach settings contract", () => {
  beforeEach(() => jest.spyOn(console, "log").mockImplementation(() => {}))
  afterEach(() => jest.restoreAllMocks())

  it.each([undefined, null, "default", "inactive", {}, { status: "default" }])("defaults legacy %p to inactive without targeting or channels", value => {
    expect(normalizeOutreachSettings(value)).toEqual({
      status: "inactive", channel_accounts: { email: [], whatsapp: [] },
      segment_ids: [], all_segments: false, daily_message_limit: 30, max_unanswered_messages: 3, cooldown_mode: "progressive", weekdays: [2, 3, 4],
    })
  })

  it("preserves explicit active and empty arrays rather than adding fallback selections", () => {
    expect(normalizeOutreachSettings("active").status).toBe("active")
    expect(normalizeOutreachSettings({ ...configured, weekdays: [], segment_ids: [] })).toMatchObject({ status: "active", weekdays: [], segment_ids: [] })
  })

  it("schema defaults are inactive and preserve all configured parameters", () => {
    const defaults = activitiesSchema.parse(undefined)
    expect(defaults.leads_initial_cold_outreach).toEqual(normalizeOutreachSettings(undefined))
    expect(defaults.leads_follow_up).toEqual(normalizeOutreachSettings(undefined))
    expect(activitiesSchema.parse({ leads_follow_up: configured }).leads_follow_up).toEqual({ ...configured, cooldown_mode: "progressive" })
    expect(activitiesSchema.parse({ leads_follow_up: "default" }).leads_follow_up.status).toBe("inactive")
  })

  it.each(["sms", "telegram", "messenger", "instagram", "voice", "custom-chat_v2"])("enables %s alone and keeps empty legacy defaults", channel => {
    const value = normalizeOutreachSettings({ ...configured, channel_accounts: { [channel]: [smsId] } })
    const accounts = getUsableOutreachAccounts({ connections: [{ id: smsId, type: channel, status: "connected", zavu_sender_id: "sender" }] })
    expect(validateOutreachSettings(value, "leads_follow_up", accounts, configured.segment_ids)).toEqual([])
    expect(activitiesSchema.parse({ leads_follow_up: value }).leads_follow_up.channel_accounts).toEqual({ email: [], whatsapp: [], [channel]: [smsId] })
    expect(validateOutreachSettings(value, "leads_follow_up", [], configured.segment_ids)).toEqual([expect.objectContaining({ field: "channel_accounts" })])
  })

  it("sanitizes unsafe/prototype keys on hydration and rejects them in the form schema", () => {
    for (const key of ["__proto__", "prototype", "constructor", "toString", "SMS", "bad.path", "bad[key]", "a".repeat(65), "", "audio"]) {
      const channel_accounts = JSON.parse(JSON.stringify({ [key]: [smsId], sms: [smsId] }))
      expect(normalizeOutreachSettings({ channel_accounts }).channel_accounts).toEqual({ email: [], whatsapp: [], sms: [smsId] })
      expect(activitiesSchema.safeParse({ leads_follow_up: { ...configured, channel_accounts } }).success).toBe(false)
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it("deduplicates account arrays, ignores inherited keys and preserves arbitrary safe empty keys", () => {
    const channel_accounts = Object.assign(Object.create({ inherited: ["hidden"] }), { sms: [smsId, smsId, "", "  ", null], "custom-chat_v2": [], ["a".repeat(64)]: ["id"] })
    expect(normalizeOutreachSettings({ channel_accounts }).channel_accounts).toEqual({ email: [], whatsapp: [], sms: [smsId], "custom-chat_v2": [], ["a".repeat(64)]: ["id"] })
  })

  it("preserves custom connected channel types through the channel form schema", () => {
    const connections = [{ id: smsId, name: "Custom", type: "custom-chat_v2", status: "connected", zavu_sender_id: "sender" }]
    expect(channelsSchema.parse({ connections, email: {}, whatsapp: {} }).connections).toEqual(connections)
  })

  it("preserves disabled connection flags through parsing and never offers them as usable", () => {
    const channels = channelsSchema.parse({ email: {}, whatsapp: {}, connections: [{ id: smsId, type: "custom-chat_v2", status: "connected", zavu_sender_id: "sender", enabled: false }] })
    expect(channels.connections[0].enabled).toBe(false)
    expect(getUsableOutreachAccounts(channels)).toEqual([])
  })

  it.each([0, -1, 10001, 1.5, NaN, Infinity, "30"])("rejects invalid daily cap %p", cap => {
    const value = { ...configured, daily_message_limit: cap }
    expect(activitiesSchema.safeParse({ leads_follow_up: value }).success).toBe(false)
    expect(validateOutreachSettings(value as any, "leads_follow_up")).toEqual(expect.arrayContaining([expect.objectContaining({ field: "daily_message_limit" })]))
  })

  it("requires usable selected accounts and site segments, not merely another connected account", () => {
    const available = [{ id: "email", channel: "email" as const, label: "Mail" }]
    expect(validateOutreachSettings(configured, "leads_follow_up", available, ["other-site-segment"]).map(error => error.field)).toEqual(["channel_accounts", "segment_ids", "segment_ids"])
    const valid = { ...configured, channel_accounts: { email: ["email"], whatsapp: [] }, segment_ids: [], all_segments: true }
    expect(validateOutreachSettings(valid, "leads_follow_up", available, [])).toEqual([])
    expect(validateOutreachSettings({ ...valid, channel_accounts: { email: [], whatsapp: [] } }, "leads_follow_up", available, [])).toHaveLength(1)
  })

  it.each([0, -1, 101, 2.5, NaN])("rejects invalid maximum unanswered messages %p", max => {
    const value = { ...configured, max_unanswered_messages: max }
    expect(activitiesSchema.safeParse({ leads_follow_up: value }).success).toBe(false)
    expect(validateOutreachSettings(value, "leads_follow_up").map(error => error.field)).toContain("max_unanswered_messages")
  })
  it.each(["leads_initial_cold_outreach", "leads_follow_up"] as const)("validates fixed cooldown and defaults to progressive for %s", key => {
    expect(normalizeOutreachSettings(undefined, key).cooldown_mode).toBe("progressive")
    expect(activitiesSchema.parse({ [key]: { ...configured, cooldown_mode: "fixed", cooldown_period_days: 5 } })[key]).toMatchObject({ cooldown_mode: "fixed", cooldown_period_days: 5 })
    for (const days of [undefined, null, 0, 1.5, 366, "5"]) {
      const value = { ...configured, cooldown_mode: "fixed" as const, cooldown_period_days: days }
      expect(validateOutreachSettings(value as any, key).map(error => error.field)).toContain("cooldown_period_days")
      expect(activitiesSchema.safeParse({ [key]: value }).success).toBe(false)
    }
    expect(activitiesSchema.safeParse({ [key]: { ...configured, cooldown_mode: "unknown" } }).success).toBe(false)
  })

  it("requires weekdays only for follow-up, treats Sunday as zero, and never restores empty weekdays", () => {
    expect(validateOutreachSettings({ ...configured, weekdays: [0] }, "leads_follow_up")).toEqual([])
    expect(validateOutreachSettings({ ...configured, weekdays: [] }, "leads_follow_up")[0].field).toBe("weekdays")
    expect(validateOutreachSettings({ ...configured, weekdays: [] }, "leads_initial_cold_outreach")).toEqual([])
    expect(activitiesSchema.safeParse({ leads_follow_up: { ...configured, weekdays: [7] } }).success).toBe(false)
  })

  it("uses the first business-hours timezone or Mexico City, without accepting invalid zones", () => {
    expect(getOutreachTimezone([{ timezone: "America/New_York" }])).toBe("America/New_York")
    expect(getOutreachTimezone([{}, { timezone: "America/New_York" }])).toBe("America/Mexico_City")
    expect(getOutreachTimezone({ timezone: "Europe/London" })).toBe("Europe/London")
    expect(getOutreachTimezone([])).toBe("America/Mexico_City")
    expect(getOutreachTimezone([{ timezone: "invalid/timezone" }])).toBe("invalid/timezone")
    expect(isValidOutreachTimezone("invalid/timezone")).toBe(false)
  })

  it("round-trips activity parameters through adapters, form defaults, site changes and normalization", () => {
    const site = { id: "site-a", name: "A", settings: { activities: { leads_follow_up: configured } } } as any
    const adapted = adaptSiteToForm(site)
    expect(adapted.activities.leads_follow_up).toEqual({ ...configured, cooldown_mode: "progressive" })
    expect(getSiteFormDefaults(adapted).activities?.leads_follow_up).toEqual({ ...configured, cooldown_mode: "progressive" })
    const otherSite = adaptSiteToForm({ ...site, id: "site-b", settings: {} })
    expect(getSiteFormDefaults(otherSite).activities?.leads_follow_up).toEqual(normalizeOutreachSettings(undefined))
    expect(normalizeActivitySettings(adapted.activities).leads_follow_up).toEqual({ ...configured, cooldown_mode: "progressive" })
  })
})

describe("usable outreach accounts", () => {
  it("returns usable agent channels with raw connection IDs and no sender-ID substitution", () => {
    expect(getUsableOutreachAccounts({ connections: [
      { id: emailId, type: "email", status: "connected", name: "Sales", zavu_sender_id: "sender-email" },
      { id: whatsappId, type: "whatsapp", status: "connected", name: "Support", zavu_sender_id: "sender-wa" },
      { id: smsId, type: "sms", status: "connected", zavu_sender_id: "sender-sms" },
      { id: "custom-connection-id", type: "custom-chat_v2", name: "Custom", status: "connected", zavu_sender_id: "sender" },
    ] })).toEqual([
      { id: emailId, channel: "email", label: "Sales" },
      { id: whatsappId, channel: "whatsapp", label: "Support" },
      { id: smsId, channel: "sms", label: "SMS account (33333333)" },
      { id: "custom-connection-id", channel: "custom-chat_v2", label: "Custom" },
    ])
  })

  it.each(["email", "whatsapp", "sms", "telegram", "messenger", "instagram", "voice", "custom-chat_v2"])("rejects %s connections without unique usable IDs, senders or connected status", type => {
    const valid = { id: smsId, type, status: "connected", zavu_sender_id: "sender" }
    for (const invalid of [{ status: "pending" }, { status: "disconnected" }, { status: "active" }, { id: "" }, { id: "  " }, { id: " id " }, { id: "id\n" }, { id: "a".repeat(201) }, { id: "email" }, { id: "agent_email" }, { id: "whatsapp" }, { id: "agent_whatsapp" }, { zavu_sender_id: "" }, { zavu_sender_id: " " }, { zavu_sender_id: undefined }, { enabled: false }]) {
      expect(getUsableOutreachAccounts({ connections: [{ ...valid, ...invalid }] })).toEqual([])
    }
    expect(getUsableOutreachAccounts({ connections: [valid, valid] })).toEqual([])
    expect(getUsableOutreachAccounts({ connections: [valid, { ...valid, type: "other-channel", status: "disconnected" }] })).toEqual([])
  })

  it("never offers unsafe channel keys, fake unsupported accounts without senders or audio accounts", () => {
    for (const type of ["__proto__", "prototype", "constructor", "bad.path", "SMS", "audio"]) {
      expect(getUsableOutreachAccounts({ connections: [{ id: smsId, type, status: "connected", zavu_sender_id: "sender" }] })).toEqual([])
    }
    expect(getUsableOutreachAccounts({ connections: [{ id: smsId, type: "unsupported", status: "connected" }] })).toEqual([])
    expect(getUsableOutreachAccounts({ connections: [{ id: emailId, type: "email", status: "connected", zavu_sender_id: "sender", metadata: { emailChannelActive: false } }] })).toEqual([])
  })

  it("uses legacy IDs for configured direct accounts and excludes unsupported agent WhatsApp", () => {
    const accounts = getUsableOutreachAccounts({
      email: { enabled: true, status: "synced", email: "sales@example.com" },
      agent_email: { status: "active", username: "agent", domain: "makinari.email" },
      whatsapp: { enabled: true, status: "active", account_sid: "account", existingNumber: "+15551234567" },
      agent_whatsapp: { status: "active", country: "US", region: "NY" },
    })
    expect(accounts.map(account => account.id)).toEqual(["email", "agent_email", "whatsapp"])
    expect(getUsableOutreachAccounts({ email: { enabled: false, status: "synced", email: "sales@example.com" }, agent_email: { status: "active", inbox_id: emailId }, whatsapp: { status: "pending" } })).toEqual([])
  })

  it("includes sender identity and supports nested legacy AgentMail data", () => {
    expect(getUsableOutreachAccounts({
      connections: [{ id: emailId, type: "email", status: "connected", name: "Email Channel", zavu_sender_id: "sender", metadata: { from_address: "hi@example.com" } }],
      agent_email: { status: "active", data: { username: "agent", domain: "custom", customDomain: "example.com" } },
    }).map(account => account.label)).toEqual(["Email Channel · hi@example.com", "Agent email · agent@example.com"])
  })
})