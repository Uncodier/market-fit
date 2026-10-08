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

interface BillingLimitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payload: BillingLimitPayload | null
}

export function BillingLimitDialog({ open, onOpenChange, payload }: BillingLimitDialogProps) {
  const router = useRouter()
  const isCredits = payload?.kind === "credits"
  const isMembers = payload?.kind === "members"
  const canUpgrade = !isMembers || (payload?.canUpgrade === true && !!payload.siteId && !!payload.requiredPlan)
  const hasCounts =
    typeof payload?.current === "number" && typeof payload?.limit === "number"

  const title = isMembers ? "Upgrade your member license" : isCredits ? "Credit limit reached" : "Account limit reached"
  const requiredLabel = payload?.requiredPlan ? licensePlanLabel(payload.requiredPlan) : "a higher plan"
  const description = isMembers
    ? `${hasCounts ? `This site uses ${payload.current} of ${payload.limit} member seats. ` : "This site needs more member seats. "}Member seats include the owner, active members, and pending invitations. ${canUpgrade ? `Upgrade to ${requiredLabel} to continue.` : `Ask the site owner to upgrade to ${requiredLabel}, then retry your invitation.`}`
    : isCredits
    ? "This action needs more credits than your current balance. Buy extra credits or upgrade your plan to continue."
    : hasCounts
      ? `You have ${payload.current} connected accounts and your plan allows ${payload.limit}. Upgrade plan or get an account add-on.`
      : "Your plan does not include more connected accounts. Upgrade plan or get an account add-on."

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
          <AlertDialogCancel>Close</AlertDialogCancel>
          {canUpgrade && <Button type="button" onClick={handleUpgrade}>
            {isCredits ? "Buy credits" : "Upgrade plan"}
          </Button>}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
