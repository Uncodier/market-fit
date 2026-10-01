import { activitiesSchema, mergeActivitySettings, normalizeActivitySettings, validatedActivityUpdates } from "@/app/components/settings/activity-settings"
import { getSiteFormDefaults } from "@/app/components/settings/site-form-defaults"
import { isValidActivityStartTime, optionalActivityStartTimeSchema } from "@/lib/activity-start-time"
import { normalizeOutreachSettings, validateOutreachSettings } from "@/lib/outreach-settings"
import type { SiteSettings } from "@/app/context/site-types"

const keys = ["daily_resume_and_stand_up", "leads_follow_up", "leads_initial_cold_outreach"] as const
const invalidTimes = ["", "9:00", "09:0", "24:00", "23:60", "-1:00", "09:00:00", " 09:00", "09:00 ", "09:00\n", "09:00\r\n", "noon", null, 900, true, {}, []]

describe.each(keys)("%s optional start time", key => {
  it.each([undefined, "inactive", { status: "inactive" }])("leaves the time absent for legacy %p instead of imposing 09:00", legacy => {
    const normalized = normalizeActivitySettings({ [key]: legacy })
    expect(normalized[key].start_time).toBeUndefined()
    expect(activitiesSchema.parse(normalized)[key].start_time).toBeUndefined()
    expect(getSiteFormDefaults({ activities: normalized }).activities?.[key]?.start_time).toBeUndefined()
    expect(JSON.parse(JSON.stringify(normalized))[key]).not.toHaveProperty("start_time")
  })

  it.each(["00:00", "09:00", "12:30", "23:59"])("preserves %s through normalization, schemas, defaults and status-only merges", start_time => {
    const initial = { [key]: { status: "inactive", start_time, extension: { keep: true } }, future_activity: { keep: 2 } }
    const normalized = normalizeActivitySettings(initial)
    expect(activitiesSchema.parse(normalized)).toMatchObject(initial)
    expect(getSiteFormDefaults({ activities: normalized }).activities).toMatchObject(initial)
    for (const update of ["inactive", { status: "inactive" }, { weekdays: [0, 6] }]) {
      const merged = mergeActivitySettings(normalized, { [key]: update })
      expect(merged[key]).toMatchObject({ start_time, extension: { keep: true } })
      expect(merged).toMatchObject({ future_activity: { keep: 2 } })
    }
  })

  it.each(invalidTimes)("preserves and rejects invalid nonmissing time %p even while inactive", start_time => {
    const normalized = normalizeActivitySettings({ [key]: { status: "inactive", start_time } })
    expect(normalized[key].start_time).toEqual(start_time)
    const result = activitiesSchema.safeParse(normalized)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(issue => issue.path.join(".") === `${key}.start_time`)).toBe(true)
    expect(isValidActivityStartTime(start_time)).toBe(false)
    expect(optionalActivityStartTimeSchema.safeParse(start_time).success).toBe(false)
    if (key === "leads_follow_up") {
      const outreach = normalizeOutreachSettings({ status: "inactive", start_time })
      expect(outreach.start_time).toEqual(start_time)
      expect(validateOutreachSettings(outreach, key)).toEqual([expect.objectContaining({ field: "start_time" })])
    }
  })

  it("retains saved time on omission and reliably overwrites it with an explicit fixed reset", () => {
    const existing = { [key]: { status: "inactive", start_time: "14:45", weekdays: [0, 6] } }
    expect(mergeActivitySettings(existing, { [key]: {} })[key].start_time).toBe("14:45")
    const patch = { [key]: { start_time: undefined, weekdays: [1, 5] } }
    const merged = mergeActivitySettings(existing, patch)
    expect(merged[key].start_time).toBe("14:45")
    expect(validatedActivityUpdates(merged, patch)).toEqual({ [key]: { weekdays: [1, 5] } })
    expect(mergeActivitySettings(existing, { [key]: { start_time: "09:00" } })[key]).toMatchObject({ start_time: "09:00", weekdays: [0, 6] })
  })
})

it("types both site settings start times without adding defaults to other activities", () => {
  const activities: SiteSettings["activities"] = {
    daily_resume_and_stand_up: { start_time: "08:15" }, leads_follow_up: { start_time: "17:45" },
  }
  const normalized = normalizeActivitySettings(activities)
  expect(normalized.daily_resume_and_stand_up.start_time).toBe("08:15")
  expect(normalized.leads_follow_up.start_time).toBe("17:45")
  expect(normalized.icp_lead_generation).not.toHaveProperty("start_time")
  expect(normalized.leads_initial_cold_outreach.start_time).toBeUndefined()
})

describe.each(keys)("%s execution time mode", key => {
  it.each([null, "", "wrong"])("rejects invalid mode %j", start_time_mode => {
    expect(activitiesSchema.safeParse(normalizeActivitySettings({ [key]: { start_time_mode } })).success).toBe(false)
  })
  it("requires a custom time and allows resetting even an invalid stale time", () => {
    expect(activitiesSchema.safeParse(normalizeActivitySettings({ [key]: { start_time_mode: "custom" } })).success).toBe(false)
    const existing = { [key]: { start_time_mode: "custom", start_time: "invalid", extension: true } }
    const patch = { [key]: { start_time_mode: "business_opening" } }
    const merged = mergeActivitySettings(existing, patch)
    const parsed = activitiesSchema.parse(merged)
    expect(parsed[key]).toMatchObject({ start_time_mode: "business_opening", start_time: "invalid", extension: true })
    expect(validatedActivityUpdates(parsed, patch)).toEqual(patch)
    expect(getSiteFormDefaults({ activities: merged }).activities?.[key]?.start_time_mode).toBe("business_opening")
  })
})