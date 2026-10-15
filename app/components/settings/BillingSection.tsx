"use client"

import Link from "next/link"
import { Button } from "../ui/button"
import { SectionCard, SectionCardHeader, SectionCardContent } from "../ui/section-card"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { normalizeSalePaymentFeePlan, salePaymentFeePercent } from "@/lib/sale-payment-fees"

export function BillingSection() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const billing = currentSite?.billing
  const plan = currentSite?.billing_read_status === 'unavailable' ? null : normalizeSalePaymentFeePlan(billing?.plan)
  const paymentFeePercent = salePaymentFeePercent(plan)
  return (
    <SectionCard id="subscription-plan">
      <SectionCardHeader title="Subscription & Billing" />
      <SectionCardContent className="space-y-4">
        <p className="text-sm">{plan ? <>Current plan: {plan} · {plan !== 'commission' ? (billing?.billing_interval === 'year' ? 'Annual billing' : 'Monthly billing') : 'Free plan'}</> : t("billing.salePaymentFee.planUnavailable") || 'Current plan unavailable'}</p>
        <p className="text-sm">
          {t(plan ? "billing.salePaymentFee.label" : "billing.salePaymentFee.defaultLabel", { percent: paymentFeePercent }) || (plan
            ? `Card payment fee: ${paymentFeePercent}% · processing included`
            : `Default card payment fee: ${paymentFeePercent}% · processing included · current plan unavailable`)}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("billing.salePaymentFee.notice", { percent: salePaymentFeePercent('enterprise') }) || `Rates are for standard card payments. ${salePaymentFeePercent('enterprise')}% is not guaranteed to cover processing costs for international payments, currency conversion or small payments.`}
        </p>
        <p className="text-sm text-muted-foreground">Choose monthly or annual billing on the billing page. Annual plans save 10%; credits remain monthly. Changes require confirmation in Stripe.</p>
        <Button asChild variant="outline"><Link href="/billing">Manage billing</Link></Button>
      </SectionCardContent>
    </SectionCard>
  )
}
