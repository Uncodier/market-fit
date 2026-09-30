import { activitiesSchema, mergeActivitySettings, normalizeActivitySettings } from "@/app/components/settings/activity-settings"
import { icpLeadGenerationSettingsSchema, normalizeIcpLeadGenerationSettings } from "@/app/components/settings/icp-lead-generation-settings"
import { validateActivitiesForSave } from "@/app/components/settings/outreach-save-validation"
import { listId } from "./icp-mining-list-fixtures"

jest.mock("@/app/components/settings/outreach-segments", () => ({ fetchOutreachSegments: jest.fn() }))
jest.mock("@/lib/supabase/client", () => ({ createClient: () => { throw new Error("No list availability reads during saves") } }))

describe("ICP mining list selection contract", () => {
  it.each([true, false])("canonicalizes and deduplicates UUIDs with all_lists=%s without dropping unknown keys", async all_lists => {
    const input = { all_lists, list_ids: [listId(2).toUpperCase(), listId(1), listId(2)], extension: { future: true } }
    const expected = { ...input, list_ids: [listId(2), listId(1)] }
    expect(normalizeIcpLeadGenerationSettings(input)).toMatchObject(expected)
    expect(icpLeadGenerationSettingsSchema.parse(input)).toMatchObject(expected)
    const normalized = normalizeActivitySettings({ icp_lead_generation: input, future_activity: { keep: true } })
    expect(activitiesSchema.parse(normalized)).toMatchObject({ icp_lead_generation: expected, future_activity: { keep: true } })
    expect((await validateActivitiesForSave(normalized, {}, "site-a")).icp_lead_generation).toMatchObject(expected)
    expect(input.list_ids).toEqual([listId(2).toUpperCase(), listId(1), listId(2)])
  })

  it("allows explicit empty and stale selections with no lookup or fallback, including partial merges", async () => {
    const previous = { icp_lead_generation: { all_lists: false, list_ids: [listId(1)], extension: "keep" } }
    const merged = mergeActivitySettings(previous, { icp_lead_generation: { list_ids: [] } })
    expect(merged.icp_lead_generation).toMatchObject({ all_lists: false, list_ids: [], extension: "keep" })
    for (const list_ids of [[], [listId(999)]]) {
      const saved = await validateActivitiesForSave({ icp_lead_generation: { all_lists: false, list_ids } }, {}, "site-a")
      expect(saved.icp_lead_generation).toMatchObject({ all_lists: false, list_ids })
    }
  })

  it.each(["false", "true", 0, 1, null])("rejects invalid all_lists=%p instead of widening scope", async all_lists => {
    const input = { icp_lead_generation: { all_lists, list_ids: [] } }
    expect(normalizeActivitySettings(input).icp_lead_generation.all_lists).toBe(all_lists)
    expect(activitiesSchema.safeParse(input).success).toBe(false)
    await expect(validateActivitiesForSave(input, {}, "site-a")).rejects.toThrow("all pending lists")
  })

  it.each([null, "", listId(1), {}, [null], [3], ["not-a-uuid"], [` ${listId(1)}`], [listId(1), "invalid"]])("rejects malformed list_ids=%p without removing entries", async list_ids => {
    const input = { icp_lead_generation: { all_lists: false, list_ids } }
    expect(normalizeActivitySettings(input).icp_lead_generation.list_ids).toEqual(list_ids)
    expect(activitiesSchema.safeParse(input).success).toBe(false)
    await expect(validateActivitiesForSave(input, {}, "site-a")).rejects.toThrow()
  })

  it("allows 1,000 distinct UUIDs, deduplicates, and blocks larger selections without truncation", async () => {
    const ids = Array.from({ length: 1000 }, (_, index) => listId(index))
    expect(icpLeadGenerationSettingsSchema.parse({ list_ids: ids }).list_ids).toEqual(ids)
    expect(icpLeadGenerationSettingsSchema.safeParse({ list_ids: [...ids, ids[0].toUpperCase()] }).success).toBe(false)
    const list_ids = [...ids, listId(1001)]
    const input = { icp_lead_generation: { all_lists: false, list_ids } }
    expect(normalizeActivitySettings(input).icp_lead_generation.list_ids).toEqual(list_ids)
    await expect(validateActivitiesForSave(input, {}, "site-a")).rejects.toThrow("at most 1,000")
  })
})