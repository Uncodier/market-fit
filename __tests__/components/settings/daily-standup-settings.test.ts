import { activitiesSchema, mergeActivitySettings, normalizeActivitySettings } from "@/app/components/settings/activity-settings"
import { dailyStandupSettingsSchema, DAILY_STANDUP_REPORT_SECTIONS, normalizeDailyStandupSettings } from "@/app/components/settings/daily-standup-settings"
import { getSiteFormDefaults } from "@/app/components/settings/site-form-defaults"
import type { SiteSettings } from "@/app/context/site-types"

const key = "daily_resume_and_stand_up"
const defaults = { status: "inactive", weekdays: [1, 5], report_sections: [...DAILY_STANDUP_REPORT_SECTIONS] }

describe("Daily Standup settings contract", () => {
  it.each([undefined, null, {}, "inactive", "default", { status: "inactive" }, { status: "default" }])("defaults legacy %p to inactive, Monday/Friday and all nine sections", legacy => {
    expect(normalizeActivitySettings({ [key]: legacy })[key]).toEqual(defaults)
    expect(activitiesSchema.parse({ [key]: legacy })[key]).toEqual(defaults)
  })

  it.each(["active", { status: "active" }])("retains explicit active in status-only %p", legacy => {
    expect(normalizeDailyStandupSettings(legacy)).toEqual({ ...defaults, status: "active" })
    expect(dailyStandupSettingsSchema.parse(legacy)).toEqual({ ...defaults, status: "active" })
  })

  it("defaults independently only when the selection is missing", () => {
    expect(dailyStandupSettingsSchema.parse({ weekdays: [] })).toEqual({ ...defaults, weekdays: [] })
    expect(dailyStandupSettingsSchema.parse({ report_sections: [] })).toEqual({ ...defaults, report_sections: [] })
    expect(normalizeDailyStandupSettings({ weekdays: [] })).toEqual({ ...defaults, weekdays: [] })
    expect(normalizeDailyStandupSettings({ report_sections: [] })).toEqual({ ...defaults, report_sections: [] })
  })

  it("preserves empty inactive selections, unknown fields and neighboring activities through normalization and schema", () => {
    const initial = {
      [key]: { status: "inactive", weekdays: [], report_sections: [], extension: { version: 3 } },
      local_lead_generation: { status: "inactive", radius: 5 },
      future_activity: { config: [1, 2] },
    }
    const normalized = normalizeActivitySettings(initial)
    const parsed = activitiesSchema.parse(normalized)
    expect(parsed).toEqual(normalized)
    expect(parsed).toMatchObject(initial)
    expect(getSiteFormDefaults({ activities: parsed }).activities).toEqual(parsed)
  })

  it.each([
    { weekdays: [] }, { report_sections: [] }, { weekdays: [], report_sections: [] },
  ])("requires a weekday and report section when active: %p", selection => {
    const result = dailyStandupSettingsSchema.safeParse({ status: "active", ...selection })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.map(issue => issue.path[0])).toEqual(Object.keys(selection))
  })

  it.each([
    { weekdays: [-1] }, { weekdays: [7] }, { weekdays: [1.5] }, { weekdays: ["1"] },
    { weekdays: null }, { weekdays: "Monday" }, { report_sections: ["social_media"] },
    { report_sections: null }, { report_sections: "sales" },
  ])("does not silently restore defaults for malformed selections: %p", selection => {
    const normalized = normalizeDailyStandupSettings({ status: "active", ...selection })
    expect(normalized).toMatchObject(selection)
    expect(dailyStandupSettingsSchema.safeParse(normalized).success).toBe(false)
  })

  it("accepts all numeric weekdays and exactly the nine supported sections", () => {
    const configured = { status: "active", weekdays: [0, 1, 2, 3, 4, 5, 6], report_sections: [...DAILY_STANDUP_REPORT_SECTIONS] }
    expect(dailyStandupSettingsSchema.parse(configured)).toEqual(configured)
  })

  it.each(["inactive", { status: "inactive" }])("merges status-only %p without resetting custom or empty selections", update => {
    for (const selection of [
      { weekdays: [0, 6], report_sections: ["records", "orders"] },
      { weekdays: [], report_sections: [] },
    ]) {
      const existing = normalizeActivitySettings({
        [key]: { status: "inactive", ...selection, extension: { keep: true } },
        future_activity: { enabled: true },
      })
      const merged = mergeActivitySettings(existing, { [key]: update })
      expect(merged).toEqual(existing)
      expect(activitiesSchema.parse(merged)).toEqual(existing)
    }
  })

  it("supports legacy and extended settings in the site context type", () => {
    const settings: SiteSettings["activities"][] = [
      { [key]: "active" }, { [key]: { status: "inactive" } },
      { [key]: { status: "active", weekdays: [0, 6], report_sections: ["inventory"], extension: { keep: true } } },
    ]
    expect(settings.map(value => normalizeActivitySettings(value)[key].status)).toEqual(["active", "inactive", "active"])
  })
})