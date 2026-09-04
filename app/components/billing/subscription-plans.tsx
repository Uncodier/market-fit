"use client"

import { Button } from "../ui/button"
import { cn } from "@/lib/utils"
import { useLocalization } from "@/app/context/LocalizationContext"

export type BillingPlan = "commission" | "starter" | "startup" | "enterprise"

const PLAN_ORDER: Record<BillingPlan, number> = {
  commission: 0,
  starter: 1,
  startup: 2,
  enterprise: 3,
}

const PLANS: Array<{
  id: BillingPlan
  titleKey: string
  titleFallback: string
  price: string
  period: string
  detail: (t: (key: string) => string) => string
}> = [
  {
    id: "commission",
    titleKey: "billing.plan.erp.title",
    titleFallback: "ERP",
    price: "$0",
    period: "/month",
    detail: (t) => `1 ${t("billing.plan.creditsPerMonth") || "credit/month"} + 0 accounts`,
  },
  {
    id: "starter",
    titleKey: "billing.plan.starter.title",
    titleFallback: "Starter",
    price: "$23",
    period: "/month",
    detail: (t) => `20 ${t("billing.plan.creditsPerMonth") || "credits/month"} + 1 account`,
  },
  {
    id: "startup",
    titleKey: "billing.plan.startup.title",
    titleFallback: "Startup",
    price: "$99",
    period: "/month",
    detail: (t) => `100 ${t("billing.plan.creditsPerMonth") || "credits/month"} + 3 accounts`,
  },
  {
    id: "enterprise",
    titleKey: "billing.plan.enterprise.title",
    titleFallback: "Enterprise",
    price: "$500",
    period: "/month",
    detail: (t) => `500 ${t("billing.plan.creditsPerMonth") || "credits/month"} + 10 accounts`,
  },
]

interface SubscriptionPlansProps {
  currentPlan: BillingPlan
  isSaving: boolean
  onChangePlan: (plan: BillingPlan) => void
}

export function SubscriptionPlans({ currentPlan, isSaving, onChangePlan }: SubscriptionPlansProps) {
  const { t } = useLocalization()

  return (
    <div className="divide-y rounded-lg border">
      {PLANS.map((plan) => {
        const isCurrent = plan.id === currentPlan
        const action =
          PLAN_ORDER[plan.id] > PLAN_ORDER[currentPlan]
            ? "upgrade"
            : PLAN_ORDER[plan.id] < PLAN_ORDER[currentPlan]
              ? "downgrade"
              : "current"

        return (
          <div
            key={plan.id}
            className={cn(
              "flex items-center justify-between gap-4 px-4 py-3",
              isCurrent && "bg-muted/40"
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
              </div>
              <p className="text-xs text-muted-foreground">{plan.detail(t)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-sm tabular-nums">
                <span className="font-medium">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </span>
              {isCurrent ? (
                <span className="w-[88px]" />
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-[88px]"
                  disabled={isSaving}
                  onClick={() => onChangePlan(plan.id)}
                >
                  {isSaving
                    ? t("billing.form.processing") || "..."
                    : action === "upgrade"
                      ? t("billing.form.upgrade") || "Upgrade"
                      : t("billing.form.downgrade") || "Downgrade"}
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
