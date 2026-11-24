import { z } from "zod"

// The browser can learn whether current verification and consent exist, never their evidence.
const status = z.object({
  connector_id: z.string().uuid(), revision: z.number().int().positive().max(2_147_483_647),
  direct_revision: z.number().int().positive().max(2_147_483_647),
  attested: z.boolean(), enabled: z.boolean(),
  authority_kind: z.literal("connected_account").optional(),
  authorization_mode: z.enum(["member_policy", "host_policy"]).optional(),
  explicitly_disabled: z.boolean().optional(),
  assistant_allowed: z.boolean().optional(),
  ask_compatible: z.boolean().nullable().optional(),
  // Older servers do not report setup intent. Absence is not a pending grant.
  setup_pending: z.boolean().optional(),
  unsupported_reason: z.literal("shared_makinari_project").optional(),
}).refine(value => (value.authorization_mode === "member_policy") === (value.explicitly_disabled !== undefined)
  && (value.authorization_mode === "host_policy") === (value.assistant_allowed !== undefined))
  .refine(value => !value.authority_kind || (!value.attested && !value.setup_pending && !value.unsupported_reason))
  .refine(value => !value.enabled || ((value.attested || value.authority_kind === "connected_account") && !value.setup_pending && !value.unsupported_reason && !value.explicitly_disabled && value.assistant_allowed !== false))
export type DirectPolicyStatus = z.infer<typeof status>

export function isAskVerified(status: DirectPolicyStatus): boolean {
  return status.ask_compatible !== false && status.ask_compatible !== null &&
    (status.attested || status.authority_kind === "connected_account") && !status.unsupported_reason && !status.setup_pending
}

export const directPolicyUpdate = z.object({
  site_id: z.string().uuid(), expected_revision: z.number().int().positive().max(2_147_483_646),
  expected_direct_revision: z.number().int().positive().max(2_147_483_646), enabled: z.boolean(),
}).strict()
export type DirectPolicyUpdate = z.infer<typeof directPolicyUpdate>

export const askAccessIntent = directPolicyUpdate.pick({ enabled: true, expected_direct_revision: true }).strict()
export type AskAccessIntent = z.infer<typeof askAccessIntent>

export function askPolicyReceipt(id: string, revision: number, intent: AskAccessIntent) {
  return z.object({ connector_id: z.literal(id), revision: z.literal(revision + 1),
    direct_revision: z.literal(intent.expected_direct_revision + 1), ask_enabled: z.literal(intent.enabled) })
}

export function directPolicyStatus(id: string, change?: Omit<DirectPolicyUpdate, "site_id">, requireSetupState = false) {
  return status.refine(value => value.connector_id === id && (!requireSetupState || value.setup_pending !== undefined) && (!change ||
    (value.direct_revision === change.expected_direct_revision + 1 && !value.setup_pending &&
      (value.authorization_mode === "host_policy"
        ? !change.enabled && !value.enabled && value.assistant_allowed === false && value.revision === change.expected_revision + 1
        : value.enabled === change.enabled && value.revision === change.expected_revision))))
}