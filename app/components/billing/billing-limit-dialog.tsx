"use client"

import { useRouter } from "next/navigation"
import { Button } from "../ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog"
import { AlertTriangle } from "../ui/icons"
import type { BillingLimitPayload } from "@/lib/billing-limit-errors"
import { licensePlanLabel } from "@/lib/license-entitlements"
import { useLocalization } from "@/app/context/LocalizationContext"

interface BillingLimitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payload: BillingLimitPayload | null
}

export function BillingLimitDialog({ open, onOpenChange, payload }: BillingLimitDialogProps) {
  const { t } = useLocalization()
  const router = useRouter()
  const isCredits = payload?.kind === "credits"
  const isMembers = payload?.kind === "members"
  const canUpgrade = !isMembers || (payload?.canUpgrade === true && !!payload.siteId && !!payload.requiredPlan)
  const hasCounts =
    typeof payload?.current === "number" && typeof payload?.limit === "number"

  const title = isMembers
    ? t('billing.limit.membersTitle') || "Upgrade your member license"
    : isCredits
      ? t('billing.limit.creditsTitle') || "Credit limit reached"
      : t('billing.limit.accountsTitle') || "Account limit reached"
  const requiredPlanKey = payload?.requiredPlan === 'commission' ? 'erp' : payload?.requiredPlan
  const requiredLabel = payload?.requiredPlan
    ? t(`billing.plan.${requiredPlanKey}.title`) || licensePlanLabel(payload.requiredPlan)
    : t('billing.limit.higherPlan') || "a higher plan"
  const memberSeats = hasCounts
    ? t('billing.limit.memberSeats', { current: payload.current!, limit: payload.limit! }) || `This site uses ${payload.current} of ${payload.limit} member seats.`
    : t('billing.limit.moreMemberSeats') || "This site needs more member seats."
  const memberAction = canUpgrade
    ? t('billing.limit.upgradeMembers', { plan: requiredLabel }) || `Upgrade to ${requiredLabel} to continue.`
    : t('billing.limit.askOwner', { plan: requiredLabel }) || `Ask the site owner to upgrade to ${requiredLabel}, then retry your invitation.`
  const description = isMembers
    ? t('billing.limit.membersDescription', { seats: memberSeats, action: memberAction }) || `${memberSeats} Member seats include the owner, active members, and pending invitations. ${memberAction}`
    : isCredits
    ? t('billing.limit.creditsDescription') || "This action needs more credits than your current balance. Buy extra credits or upgrade your plan to continue."
    : hasCounts
      ? t('billing.limit.accountsDescription', { current: payload.current!, limit: payload.limit! }) || `You have ${payload.current} connected accounts and your plan allows ${payload.limit}. Upgrade plan or get an account add-on.`
      : t('billing.limit.moreAccounts') || "Your plan does not include more connected accounts. Upgrade plan or get an account add-on."

  const handleUpgrade = () => {
    if (!canUpgrade) return
    onOpenChange(false)
    const query = isMembers ? new URLSearchParams({ siteId: payload!.siteId!, requiredPlan: payload!.requiredPlan! }) : null
    router.push(query ? `/billing?${query.toString()}` : isCredits ? "/billing" : "/billing#addons")
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('billing.actions.close') || "Close"}</AlertDialogCancel>
          {canUpgrade && <Button type="button" onClick={handleUpgrade}>
            {isCredits
              ? t('billing.actions.buyCredits') || "Buy credits"
              : t('billing.actions.upgradePlan') || "Upgrade plan"}
          </Button>}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
