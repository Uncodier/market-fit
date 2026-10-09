"use client"

import { Button } from "../ui/button"
import { Check } from "../ui/icons"
import { cn } from "@/lib/utils"
import { useLocalization } from "@/app/context/LocalizationContext"
import { type BillingInterval, formatPrice, subscriptionPrice } from "@/lib/billing-pricing"
import { getMemberLimit, type LicensePlan } from "@/lib/license-entitlements"

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
  detail: (t: (key: string, params?: Record<string, string | number>) => string) => string
}> = [
  {
    id: "commission",
    titleKey: "billing.plan.erp.title",
    titleFallback: "Toolbox",
    monthlyPrice: 0,
    detail: (t) => t("billing.plan.erp.allowances", { credits: 1, socialAccounts: 1 }) || "1 credit/month + 1 social account",
  },
  {
    id: "engine",
    titleKey: "billing.plan.engine.title",
    titleFallback: "Starter",
    monthlyPrice: 23,
    detail: (t) => t("billing.plan.engine.allowances", { credits: 20, agentChannels: 1, socialAccounts: 3 }) || "20 credits/month + 1 agent channel, 3 social accounts",
  },
  {
    id: "foundry",
    titleKey: "billing.plan.foundry.title",
    titleFallback: "Pro",
    monthlyPrice: 99,
    detail: (t) => t("billing.plan.foundry.allowances", { credits: 100, agentChannels: 3, socialAccounts: 6 }) || "100 credits/month + 3 agent channels, 6 social accounts",
  },
  {
    id: "enterprise",
    titleKey: "billing.plan.enterprise.title",
    titleFallback: "Enterprise",
    monthlyPrice: 500,
    detail: (t) => t("billing.plan.enterprise.allowances", { credits: 500, agentChannels: 10, socialAccounts: 10 }) || "500 credits/month + 10 agent channels, 10 social accounts",
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
        const planTitle = t(plan.titleKey) || plan.titleFallback
        const intervalLabel = interval === 'year'
          ? t("billing.interval.year") || "year"
          : t("billing.interval.month") || "month"
        const intervalAdjective = interval === 'year'
          ? t("billing.interval.annual") || "annual"
          : t("billing.interval.monthly") || "monthly"
        const memberSummary = memberLimit === null
          ? t("billing.plan.membersUnlimited", { count: 10 }) || "More than 10 members per site · includes owner and pending invitations"
          : memberLimit === 1
            ? t("billing.plan.memberSingle", { count: memberLimit }) || `${memberLimit} member per site · includes owner and pending invitations`
            : t("billing.plan.members", { count: memberLimit }) || `${memberLimit} members per site · includes owner and pending invitations`
        const action =
          PLAN_ORDER[plan.id] > PLAN_ORDER[currentPlan]
            ? "upgrade"
            : PLAN_ORDER[plan.id] < PLAN_ORDER[currentPlan]
              ? "downgrade"
              : "switch"
        const actionLabel = action === "switch"
          ? t("billing.plan.switchLabel", { plan: planTitle, interval: intervalAdjective }) || `Switch ${planTitle} ${intervalAdjective}`
          : action === "upgrade"
            ? t("billing.plan.upgradeLabel", { plan: planTitle, interval: intervalAdjective }) || `Upgrade to ${planTitle} ${intervalAdjective}`
            : t("billing.plan.downgradeLabel", { plan: planTitle, interval: intervalAdjective }) || `Downgrade to ${planTitle} ${intervalAdjective}`

        return (
          <div
            key={plan.id}
            data-plan={plan.id}
            data-required-plan={isRequired || undefined}
            className={cn(
              "flex flex-wrap items-center justify-between gap-4 px-4 py-3",
              isCurrent && "bg-muted/40",
              isRequired && "bg-primary/5"
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{planTitle}</p>
                {isCurrent && (
                  <span className="text-xs text-muted-foreground">
                    {t("billing.plan.currentBadge") || "Current"}
                  </span>
                )}
                {isRequired && <span className="text-xs font-medium text-primary">{t("billing.plan.minimumRequired") || "Minimum required plan"}</span>}
              </div>
              <p className="text-xs text-muted-foreground">{plan.detail(t)}</p>
              <p className="text-xs text-muted-foreground">
                {memberSummary}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="text-right text-sm tabular-nums">
                <span className="font-medium">{formatPrice(price.total)}</span>
                <span className="text-muted-foreground">/{intervalLabel}</span>
                {interval === 'year' && <p className="text-xs text-muted-foreground">
                  {t("billing.interval.monthlyEquivalent", { price: formatPrice(price.monthlyEquivalent) }) || `${formatPrice(price.monthlyEquivalent)}/month equivalent`}
                  <br />{t("billing.interval.annualSavings", { percent: 10 }) || "Billed annually · save 10%"}
                </p>}
              </div>
              {isCurrent ? (
                <span className="flex w-[88px] items-center justify-center text-primary" role="img" aria-label={t("billing.plan.selected") || "Selected plan"}>
                  <Check size={20} strokeWidth={2.5} />
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-[88px]"
                  disabled={isSaving || (blockedPaidChanges && plan.id !== 'commission')}
                  aria-label={actionLabel}
                  onClick={() => onChangePlan(plan.id)}
                >
                  {isSaving
                    ? t("billing.form.processing") || "..."
                    : action === "upgrade"
                      ? t("billing.form.upgrade") || "Upgrade"
                      : action === "switch" ? t("billing.actions.switch") || "Switch" : t("billing.form.downgrade") || "Downgrade"}
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
