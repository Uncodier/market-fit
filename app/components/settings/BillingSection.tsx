"use client"

import Link from "next/link"
import { Button } from "../ui/button"
import { SectionCard, SectionCardHeader, SectionCardContent } from "../ui/section-card"
import { useSite } from "@/app/context/SiteContext"

export function BillingSection() {
  const { currentSite } = useSite()
  const billing = currentSite?.billing
  return (
    <SectionCard id="subscription-plan">
      <SectionCardHeader title="Subscription & Billing" />
      <SectionCardContent className="space-y-4">
        <p className="text-sm">Current plan: {billing?.plan || 'commission'} · {billing?.plan && billing.plan !== 'commission' ? (billing.billing_interval === 'year' ? 'Annual billing' : 'Monthly billing') : 'Free plan'}</p>
        <p className="text-sm text-muted-foreground">Choose monthly or annual billing on the billing page. Annual plans save 10%; credits remain monthly. Changes require confirmation in Stripe.</p>
        <Button asChild variant="outline"><Link href="/billing">Manage billing</Link></Button>
      </SectionCardContent>
    </SectionCard>
  )
}
