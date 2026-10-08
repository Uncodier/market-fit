import { z } from 'zod'
import { LICENSE_PLANS, getMemberLimit, requiredMemberPlan } from '@/lib/license-entitlements'

export const memberLicenseSchema = z.object({
  siteId: z.string().uuid(),
  plan: z.enum(LICENSE_PLANS),
  current: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  limit: z.number().int().positive().nullable(),
  requiredPlan: z.enum(LICENSE_PLANS),
}).superRefine((license, ctx) => {
  if (license.limit !== getMemberLimit(license.plan) ||
      license.requiredPlan !== requiredMemberPlan(license.current + 1) ||
      (license.total !== undefined && license.total < license.current)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid member license' })
  }
})

export const publicMemberLicenseSchema = memberLicenseSchema.and(z.object({ canUpgrade: z.boolean() }))