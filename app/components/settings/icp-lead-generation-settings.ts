import { z } from "zod"

export const ICP_TARGET_LEADS_DEFAULT = 150
export const ICP_TARGET_LEADS_MAX = 3000
export const ICP_TARGET_LEADS_ERROR = "Enter a whole number from 1 to 3,000 found leads per run."
export const ICP_LIST_IDS_MAX = 1000

const listIdsSchema = z.array(z.string().uuid("Use valid mining list UUIDs."))
  .max(ICP_LIST_IDS_MAX, "Select at most 1,000 mining lists.")
  .transform(ids => [...new Set(ids.map(id => id.toLowerCase()))])

export const icpLeadGenerationSettingsSchema = z.preprocess(
  value => value == null || ["active", "inactive", "default"].includes(value as string) ? {} : value,
  z.object({
    // Mining is always active, including when loading a legacy inactive status.
    status: z.unknown().transform(() => "active" as const),
    target_leads: z.number({ invalid_type_error: ICP_TARGET_LEADS_ERROR })
      .int(ICP_TARGET_LEADS_ERROR).min(1, ICP_TARGET_LEADS_ERROR)
      .max(ICP_TARGET_LEADS_MAX, ICP_TARGET_LEADS_ERROR).default(ICP_TARGET_LEADS_DEFAULT),
    research_enabled: z.boolean({ invalid_type_error: "Choose whether to enable additional deep research." }).default(false),
    all_lists: z.boolean({ invalid_type_error: "Choose whether to use all pending lists." }).default(true),
    list_ids: listIdsSchema.default([]),
  }).passthrough().default({}),
)

export type IcpLeadGenerationSettings = z.output<typeof icpLeadGenerationSettingsSchema>

export function normalizeIcpLeadGenerationSettings(value: unknown): IcpLeadGenerationSettings {
  const data = value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<IcpLeadGenerationSettings> : {}
  const listIds = listIdsSchema.safeParse(data.list_ids === undefined ? [] : data.list_ids)
  return {
    ...data,
    status: "active",
    // Keep invalid saved values visible for validation; never silently change a run target.
    target_leads: data.target_leads === undefined ? ICP_TARGET_LEADS_DEFAULT : data.target_leads,
    research_enabled: data.research_enabled === undefined ? false : data.research_enabled,
    all_lists: data.all_lists === undefined ? true : data.all_lists,
    // Canonicalize valid selections, but retain malformed values so saves fail visibly.
    list_ids: listIds.success ? listIds.data : data.list_ids!,
  }
}