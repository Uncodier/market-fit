"use client"

import { Button } from "../ui/button"
import { cn } from "@/lib/utils"
import { useLocalization } from "@/app/context/LocalizationContext"
import { type BillingInterval, formatPrice, subscriptionPrice } from "@/lib/billing-pricing"
import { getMemberLimit, type LicensePlan } from "@/lib/license-entitlements"
import { requiresSubscriptionManagement } from './subscription-transitions'

export type BillingPlan = "commission" | "engine" | "foundry" | "enterprise"

const PLAN_ORDER: Record<BillingPlan, number> = {
  commission: 0,
  engine: 1,
  foundry: 2,
  enterprise: 3,
}

const PLANS: Array<{
  id: BillingPlan
  titleKey: string
  titleFallback: string
  monthlyPrice: number
  detail: (t: (key: string) => string) => string
}> = [
  {
    id: "commission",
    titleKey: "billing.plan.erp.title",
    titleFallback: "Toolbox",
    monthlyPrice: 0,
    detail: (t) => `1 ${t("billing.plan.creditsPerMonth") || "credit/month"} + 1 social account`,
  },
  {
    id: "engine",
    titleKey: "billing.plan.engine.title",
    titleFallback: "Starter",
    monthlyPrice: 23,
    detail: (t) => `20 ${t("billing.plan.creditsPerMonth") || "credits/month"} + 1 agent channel, 3 social accounts`,
  },
  {
    id: "foundry",
    titleKey: "billing.plan.foundry.title",
    titleFallback: "Pro",
    monthlyPrice: 99,
    detail: (t) => `100 ${t("billing.plan.creditsPerMonth") || "credits/month"} + 3 agent channels, 6 social accounts`,
  },
  {
    id: "enterprise",
    titleKey: "billing.plan.enterprise.title",
    titleFallback: "Enterprise",
    monthlyPrice: 500,
    detail: (t) => `500 ${t("billing.plan.creditsPerMonth") || "credits/month"} + 10 agent channels, 10 social accounts`,
  },
]

interface SubscriptionPlansProps {
  currentPlan: BillingPlan
  currentInterval?: BillingInterval
  billingInterval?: BillingInterval
  isSaving: boolean
  blockedPaidChanges?: boolean
  requiredPlan?: LicensePlan
  onChangePlan: (plan: BillingPlan) => void
}

export function SubscriptionPlans({ currentPlan, currentInterval = 'month', billingInterval = 'month', isSaving, blockedPaidChanges = false, requiredPlan, onChangePlan }: SubscriptionPlansProps) {
  const { t } = useLocalization()

  return (
    <div className="divide-y rounded-lg border">
      {PLANS.map((plan) => {
        const interval = plan.id === 'commission' ? 'month' : billingInterval
        const price = subscriptionPrice(plan.monthlyPrice, interval)
        const isCurrent = plan.id === currentPlan && (plan.id === 'commission' || interval === currentInterval)
        const isRequired = plan.id === requiredPlan
        const memberLimit = getMemberLimit(plan.id)
        const managed = plan.id !== 'commission' && requiresSubscriptionManagement(currentPlan, plan.id, currentInterval, interval)
        const action =
          PLAN_ORDER[plan.id] > PLAN_ORDER[currentPlan]
            ? "upgrade"
            : PLAN_ORDER[plan.id] < PLAN_ORDER[currentPlan]
              ? "downgrade"
              : "switch"

        return (
          <div
            key={plan.id}
            data-plan={plan.id}
            data-required-plan={isRequired || undefined}
            className={cn(
              "flex flex-wrap items-center justify-between gap-4 px-4 py-3",
              isCurrent && "bg-muted/40",
              isRequired && "bg-primary/5 ring-1 ring-inset ring-primary"
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{t(plan.titleKey) || plan.titleFallback}</p>
                {isCurrent && (
                  <span className="text-xs text-muted-foreground">
                    {t("billing.plan.currentBadge") || "Current"}
                  </span>
                )}
                {isRequired && <span className="text-xs font-medium text-primary">Minimum required plan</span>}
              </div>
              <p className="text-xs text-muted-foreground">{plan.detail(t)}</p>
              <p className="text-xs text-muted-foreground">
                {memberLimit === null ? "More than 10 members" : `${memberLimit} ${memberLimit === 1 ? "member" : "members"}`} per site · includes owner and pending invitations
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="text-right text-sm tabular-nums">
                <span className="font-medium">{formatPrice(price.total)}</span>
                <span className="text-muted-foreground">/{interval === 'year' ? 'year' : 'month'}</span>
                {interval === 'year' && <p className="text-xs text-muted-foreground">{formatPrice(price.monthlyEquivalent)}/month equivalent<br />Billed annually · save 10%</p>}
              </div>
              {isCurrent ? (
                <span className="w-[88px]" />
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-[88px]"
                  disabled={isSaving || (blockedPaidChanges && plan.id !== 'commission')}
                  aria-label={`${managed ? 'Manage' : action === 'switch' ? 'Switch' : action === 'upgrade' ? 'Upgrade to' : 'Downgrade to'} ${plan.titleFallback} ${interval === 'year' ? 'annual' : 'monthly'}${managed ? ' in Stripe' : ''}`}
                  onClick={() => onChangePlan(plan.id)}
                >
                  {isSaving
                    ? t("billing.form.processing") || "..."
                    : managed ? "Manage" : action === "upgrade"
                      ? t("billing.form.upgrade") || "Upgrade"
                      : action === "switch" ? "Switch" : t("billing.form.downgrade") || "Downgrade"}
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
