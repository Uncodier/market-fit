import { mergeActivitySettings, normalizeActivitySettings } from "@/app/components/settings/activity-settings"

it.each(["active", "inactive", "default"])("merges legacy %s status patches without losing typed activity parameters or extensions", status => {
  const existing = {
    icp_lead_generation: { all_lists: false, list_ids: [], target_leads: 900, research_enabled: true, custom: { keep: true } },
    leads_follow_up: { status: "inactive", all_segments: true, weekdays: [0], channel_accounts: { sms: ["saved"] }, daily_message_limit: 80, custom: 42 },
    daily_resume_and_stand_up: { status: "inactive", weekdays: [6], report_sections: ["tasks"], custom: true },
    email_sync: { status: "default", custom: "keep" },
    future_activity: { status: "inactive", parameters: [1, 2] },
  }
  const patches = Object.fromEntries(Object.keys(existing).map(key => [key, status]))
  const expected = Object.fromEntries(Object.entries(existing).map(([key, value]) => [key, { ...value, status }]))
  expect(mergeActivitySettings(existing, patches)).toEqual(normalizeActivitySettings(expected))
})

it("preserves legacy statuses when parameter-only object patches are applied", () => {
  const previous = { email_sync: "inactive", leads_follow_up: "active", supervise_conversations: "active", future_activity: "inactive" }
  const patches = Object.fromEntries(Object.keys(previous).map(key => [key, { custom: 42 }]))
  const merged = mergeActivitySettings(previous, patches)
  for (const [key, status] of Object.entries(previous)) expect((merged as any)[key]).toMatchObject({ status, custom: 42 })
})