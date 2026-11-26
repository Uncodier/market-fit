import { z } from "zod"

export const STARTUP_TRIAL_DAYS = 15
export const STARTUP_TRIAL_CREDITS = 50
export const paidThroughSchema = z.string().datetime({ offset: true })

export const startupTrialSchema = z.object({
  success: z.literal(true),
  state: z.enum(["eligible", "active", "expired", "converted", "unavailable"]),
  started_at: z.string().datetime({ offset: true }).nullable(),
  ends_at: z.string().datetime({ offset: true }).nullable(),
  credits_remaining: z.number().finite().min(0).max(STARTUP_TRIAL_CREDITS),
  server_now: z.string().datetime({ offset: true }),
  /** Explicit offer proof is absent before the payment-history migration. */
  offer_eligible: z.boolean().optional(),
}).superRefine((trial, context) => {
  const start = trial.started_at === null ? null : Date.parse(trial.started_at)
  const end = trial.ends_at === null ? null : Date.parse(trial.ends_at)
  const now = Date.parse(trial.server_now)
  if ((start === null) !== (end === null) ||
      (start !== null && end !== null && end - start !== STARTUP_TRIAL_DAYS * 86_400_000) ||
      (["active", "expired", "converted"].includes(trial.state) && start === null) ||
      (trial.state === "eligible" && start !== null) ||
      (trial.state === "active" && (start === null || end === null || now < start || now >= end)) ||
      (trial.state === "expired" && (end === null || now < end)) ||
      (trial.offer_eligible === true && trial.state !== "eligible") ||
      (trial.state !== "active" && trial.credits_remaining !== 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid trial lifecycle" })
  }
})

export type StartupTrial = z.infer<typeof startupTrialSchema>
export type StartupTrialActivation = StartupTrial & { outcome: "started" | "already_started" }

export const temporaryWorkspaceLicenseSchema = z.object({
  plan: z.enum(["engine", "foundry", "enterprise"]),
  ends_at: paidThroughSchema,
  kind: z.enum(["late_payment", "emergency_grace"]).optional(),
})
export type TemporaryWorkspaceLicense = z.infer<typeof temporaryWorkspaceLicenseSchema>

export function activeTemporaryWorkspaceLicense(value: unknown, now = Date.now()) {
  const result = temporaryWorkspaceLicenseSchema.safeParse(value)
  return result.success && Date.parse(result.data.ends_at) > now ? result.data : undefined
}

/** Trial permissions never turn the base billing plan into a paid subscription. */
export function effectiveBillingPlan(billing: {
  plan?: string | null
  trial_started_at?: string | null
  trial_ends_at?: string | null
  trial_converted_at?: string | null
  subscription_status?: string | null
  paid_subscription_period_start?: string | null
  paid_subscription_period_end?: string | null
  temporary_workspace_license?: unknown
} | null | undefined, now = Date.now()): string {
  let plan = billing?.plan || "commission"
  const temporary = activeTemporaryWorkspaceLicense(billing?.temporary_workspace_license, now)
  if (temporary && (plan === "commission" || temporary.kind === "emergency_grace")) return temporary.plan
  if (billing?.subscription_status === 'past_due' && !(Date.parse(billing.paid_subscription_period_start ?? '') <= now &&
      now < Date.parse(billing.paid_subscription_period_end ?? ''))) plan = 'commission'
  if (plan !== "commission" || billing?.trial_converted_at) return plan
  const start = Date.parse(billing?.trial_started_at ?? "")
  const end = Date.parse(billing?.trial_ends_at ?? "")
  return Number.isFinite(now) && Number.isFinite(start) && Number.isFinite(end) &&
    end - start === STARTUP_TRIAL_DAYS * 86_400_000 && start <= now && now < end
    ? "foundry" : plan
}