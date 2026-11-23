import { z } from "zod"

// The browser can learn whether current verification and consent exist, never their evidence.
const status = z.object({
  connector_id: z.string().uuid(), revision: z.number().int().positive().max(2_147_483_647),
  direct_revision: z.number().int().positive().max(2_147_483_647),
  attested: z.boolean(), enabled: z.boolean(),
  // Older servers do not report setup intent. Absence is not a pending grant.
  setup_pending: z.boolean().optional(),
  unsupported_reason: z.literal("shared_makinari_project").optional(),
}).refine(value => !value.enabled || (value.attested && !value.setup_pending && !value.unsupported_reason))
export type DirectPolicyStatus = z.infer<typeof status>

export const directPolicyUpdate = z.object({
  site_id: z.string().uuid(), expected_revision: z.number().int().positive().max(2_147_483_646),
  expected_direct_revision: z.number().int().positive().max(2_147_483_646), enabled: z.boolean(),
}).strict()
export type DirectPolicyUpdate = z.infer<typeof directPolicyUpdate>

export function directPolicyStatus(id: string, change?: Omit<DirectPolicyUpdate, "site_id">, requireSetupState = false) {
  return status.refine(value => value.connector_id === id && (!requireSetupState || value.setup_pending !== undefined) && (!change ||
    (value.revision === change.expected_revision && value.direct_revision === change.expected_direct_revision + 1 &&
      value.enabled === change.enabled && !value.setup_pending)))
}