import { activitiesSchema, mergeActivitySettings, normalizeActivitySettings } from "@/app/components/settings/activity-settings"
import { icpLeadGenerationSettingsSchema } from "@/app/components/settings/icp-lead-generation-settings"
import { getSiteFormDefaults } from "@/app/components/settings/site-form-defaults"
import { validateActivitiesForSave } from "@/app/components/settings/outreach-save-validation"
import { fetchOutreachSegments } from "@/app/components/settings/outreach-segments"

jest.mock("@/app/components/settings/outreach-segments", () => ({ fetchOutreachSegments: jest.fn() }))

const defaults = { status: "active", target_leads: 150, research_enabled: false, all_lists: true, list_ids: [] }

describe("ICP mining settings contract", () => {
  it.each([undefined, null, {}, "default", "inactive", "active", { status: "inactive" }])("normalizes legacy %p to always active defaults", value => {
    expect(normalizeActivitySettings({ icp_lead_generation: value }).icp_lead_generation).toEqual(defaults)
    expect(activitiesSchema.parse({ icp_lead_generation: value }).icp_lead_generation).toEqual(defaults)
  })

  it("shares defaults across schema and form initialization", () => {
    expect(activitiesSchema.parse(undefined).icp_lead_generation).toEqual(defaults)
    expect(getSiteFormDefaults().activities?.icp_lead_generation).toEqual(defaults)
  })

  it.each([1, 150, 3000])("accepts integer target %p and either research choice without an inactive status", target_leads => {
    for (const research_enabled of [false, true]) {
      for (const status of [undefined, "inactive", "default", "active", false]) {
        expect(icpLeadGenerationSettingsSchema.parse({ status, target_leads, research_enabled })).toEqual({ ...defaults, target_leads, research_enabled })
      }
    }
  })

  it.each([0, -1, 3001, 1.5, NaN, Infinity, "150", "", null, true])("rejects invalid target %p at the schema and both save paths' validator", async target_leads => {
    const input = { icp_lead_generation: { target_leads } }
    const result = activitiesSchema.safeParse(input)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(["icp_lead_generation", "target_leads"])
    await expect(validateActivitiesForSave(input, {}, "site-a")).rejects.toThrow("whole number")
  })

  it.each(["false", "true", 0, 1, null])("rejects non-boolean research %p without coercion", async research_enabled => {
    const input = { icp_lead_generation: { research_enabled } }
    expect(activitiesSchema.safeParse(input).success).toBe(false)
    await expect(validateActivitiesForSave(input, {}, "site-a")).rejects.toThrow("additional deep research")
  })

  it("preserves unknown ICP, neighboring and future activity keys through normalization and schema parsing", () => {
    const input = {
      icp_lead_generation: { ...defaults, provider_options: { future: ["keep"] } },
      local_lead_generation: { status: "inactive", local_extension: { radius: 10 } },
      leads_follow_up: { status: "inactive", research_policy: { version: 2 } },
      future_activity: { status: "custom", payload: [1, 2] },
    }
    const untouched = JSON.parse(JSON.stringify(input))
    const normalized = normalizeActivitySettings(input)
    expect(normalized).toMatchObject(input)
    expect(activitiesSchema.parse(normalized)).toMatchObject(input)
    expect(input).toEqual(untouched)
    const merged = mergeActivitySettings(input, { icp_lead_generation: { target_leads: 3000 } })
    expect(merged).toMatchObject({ ...input, icp_lead_generation: { ...input.icp_lead_generation, target_leads: 3000 } })
    expect(input).toEqual(untouched)
  })

  it("allows ICP with inactive outreach, no channels, and no segment lookup", async () => {
    jest.mocked(fetchOutreachSegments).mockClear()
    const saved = await validateActivitiesForSave({ icp_lead_generation: { target_leads: 250, research_enabled: true } }, { connections: [] }, "site-a", [{ timezone: "invalid" }])
    expect(saved.icp_lead_generation).toEqual({ ...defaults, target_leads: 250, research_enabled: true })
    expect(saved.leads_follow_up.status).toBe("inactive")
    expect(fetchOutreachSegments).not.toHaveBeenCalled()
  })
})