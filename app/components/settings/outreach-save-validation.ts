import { OUTREACH_ACTIVITY_KEYS, getOutreachTimezone, isValidOutreachTimezone, validateOutreachSettings } from "@/lib/outreach-settings"
import { normalizeActivitySettings } from "./activity-settings"
import { getUsableOutreachAccounts } from "./outreach-accounts"
import { fetchOutreachSegments } from "./outreach-segments"
import { icpLeadGenerationSettingsSchema } from "./icp-lead-generation-settings"
import { dailyStandupSettingsSchema } from "./daily-standup-settings"

export async function validateActivitiesForSave(activities: unknown, channels: unknown, siteId: string, businessHours?: unknown) {
  const normalized = normalizeActivitySettings(activities)
  normalized.daily_resume_and_stand_up = dailyStandupSettingsSchema.parse(normalized.daily_resume_and_stand_up)
  normalized.icp_lead_generation = icpLeadGenerationSettingsSchema.parse(normalized.icp_lead_generation)
  const accounts = getUsableOutreachAccounts(channels)
  const needsSegments = OUTREACH_ACTIVITY_KEYS.some(key => normalized[key].status === "active" && (!normalized[key].all_segments || normalized[key].segment_ids.length > 0))
  if (OUTREACH_ACTIVITY_KEYS.some(key => normalized[key].status === "active") && !isValidOutreachTimezone(getOutreachTimezone(businessHours))) {
    throw new Error("Set a valid business-hours timezone in Context before enabling outreach.")
  }
  const segmentIds = needsSegments ? (await fetchOutreachSegments(siteId)).map(segment => segment.id) : undefined
  for (const key of OUTREACH_ACTIVITY_KEYS) {
    const errors = validateOutreachSettings(normalized[key], key, accounts, segmentIds)
    if (errors.length) throw new Error(`${key === "leads_follow_up" ? "Leads Follow Up" : "Leads Initial Cold Outreach"}: ${errors[0].message}`)
  }
  return normalized
}