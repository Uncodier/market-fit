import { activitiesSchema, mergeActivitySettings, normalizeActivitySettings } from "@/app/components/settings/activity-settings"
import { normalizeOutreachSettings, validateOutreachSettings } from "@/lib/outreach-settings"
import { validateActivitiesForSave } from "@/app/components/settings/outreach-save-validation"
import { fetchOutreachSegments } from "@/app/components/settings/outreach-segments"

jest.mock("@/app/components/settings/outreach-segments", () => ({ fetchOutreachSegments: jest.fn() }))
const key = "invoices_due"
const channels = { connections: [{ id: "voice-id", type: "voice", status: "connected", zavu_sender_id: "sender" }] }
const configured = { status: "active", channel_accounts: { voice: ["voice-id"] }, repeat_interval_days: 3, weekdays: [1, 2, 3, 4, 5], start_time_mode: "business_opening" }

beforeEach(() => jest.clearAllMocks())

it.each([undefined, "default", "inactive", {}, { status: "default" }])("defaults invoice reminders to inactive for %j", value => {
  const normalized = normalizeActivitySettings({ [key]: value })
  expect(normalized[key]).toMatchObject({ status: "inactive", channel_accounts: {}, repeat_interval_days: 3, daily_message_limit: 30, weekdays: [1, 2, 3, 4, 5], start_time_mode: "business_opening" })
  expect(activitiesSchema.parse(normalized)[key].status).toBe("inactive")
})

it.each([null, "3", 0, -1, 1.5, 366, NaN, Infinity])("rejects invalid saved interval %j without repairing it", repeat_interval_days => {
  const normalized = normalizeActivitySettings({ [key]: { repeat_interval_days } })
  expect(activitiesSchema.safeParse(normalized).success).toBe(false)
  expect(validateOutreachSettings(normalized[key], key)).toEqual(expect.arrayContaining([expect.objectContaining({ field: "repeat_interval_days" })]))
})

it.each([1, 3, 365])("allows integer interval %s", repeat_interval_days => {
  expect(activitiesSchema.safeParse({ [key]: { ...configured, repeat_interval_days } }).success).toBe(true)
})

it("uses invoice audience, persisted channels and timezone, without loading segments", async () => {
  const normalized = await validateActivitiesForSave({ [key]: configured }, channels, "site-a", [{ timezone: "America/New_York" }])
  expect(normalized[key].status).toBe("active")
  expect(fetchOutreachSegments).not.toHaveBeenCalled()
  await expect(validateActivitiesForSave({ [key]: configured }, { connections: [] }, "site-a")).rejects.toThrow("usable channel account")
  await expect(validateActivitiesForSave({ [key]: configured }, channels, "site-a", [{ timezone: "Invalid/Timezone" }])).rejects.toThrow("timezone")
})

it.each([{ weekdays: [] }, { start_time_mode: "custom" }, { start_time_mode: "wrong" }, { start_time_mode: "custom", start_time: " 09:00" }])("rejects invalid timing %j", timing => {
  expect(activitiesSchema.safeParse({ [key]: { ...configured, ...timing } }).success).toBe(false)
})

it("preserves neighboring/unknown settings and custom timing through partial merges", () => {
  const initial = { [key]: { ...configured, extension: { version: 2 }, start_time_mode: "custom", start_time: "14:35" }, future_activity: { extension: true }, leads_follow_up: { status: "inactive", daily_message_limit: 51 } }
  const merged = mergeActivitySettings(initial, { [key]: { repeat_interval_days: 7 } })
  expect(merged[key]).toMatchObject({ ...initial[key], repeat_interval_days: 7 })
  expect((merged as Record<string, unknown>).future_activity).toEqual(initial.future_activity)
  expect(merged.leads_follow_up.daily_message_limit).toBe(51)
  expect(activitiesSchema.parse(merged)[key]).toMatchObject({ extension: { version: 2 }, start_time: "14:35", repeat_interval_days: 7 })
  expect(normalizeOutreachSettings("active", key).status).toBe("active")
})

it("does not apply lead unanswered caps to invoice collections", () => {
  expect(activitiesSchema.safeParse({ [key]: { ...configured, max_unanswered_messages: "invalid legacy field" } }).success).toBe(true)
})

it("defaults opening mode in schema but preserves legacy custom time-only settings", () => {
  expect(activitiesSchema.parse({})[key].start_time_mode).toBe("business_opening")
  const value = { status: "inactive", start_time: "14:35" }
  expect(normalizeActivitySettings({ [key]: value })[key].start_time_mode).toBeUndefined()
  expect(activitiesSchema.parse({ [key]: value })[key].start_time_mode).toBeUndefined()
})