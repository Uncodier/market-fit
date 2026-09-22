"use client"

import Link from "next/link"
import { format } from "date-fns"
import { Button } from "@/app/components/ui/button"
import { EntityAvatar } from "@/app/components/documents/document-list"
import { Mail, Plus, User } from "@/app/components/ui/icons"
import { formatCurrency } from "@/app/lib/formatters"
import type { SubscriptionDetail } from "../actions"

function formatDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : format(date, "MMM d, yyyy")
}

export function SubscriptionIdentityHeader({
  subscription,
  currency,
  onCreateInvoice,
}: {
  subscription: SubscriptionDetail
  currency: string
  onCreateInvoice: () => void
}) {
  const planName = subscription.catalog_item?.name || "Subscription"
  const customerName = subscription.lead?.name || "Unknown customer"
  const amountLabel = `${formatCurrency(Number(subscription.amount) || 0, currency)} per cycle`
  const startLabel = formatDate(subscription.start_date)
  const nextBillingLabel = formatDate(subscription.next_billing_date)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <EntityAvatar name={planName} className="h-11 w-11 text-sm" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold leading-tight" title={planName}>
              {planName}
            </h1>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {customerName} · {amountLabel}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground/80">
              {startLabel ? `Started ${startLabel}` : "Start date unavailable"}
              {" · "}
              {nextBillingLabel ? `Next billing ${nextBillingLabel}` : "No next billing date"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            disabled={!subscription.lead?.email}
            onClick={() => window.open(`mailto:${subscription.lead.email}`, "_blank")}
          >
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Email
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-8">
            <Link href={`/leads/${subscription.lead.id}`}>
              <User className="mr-1.5 h-3.5 w-3.5" />
              View customer
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={onCreateInvoice}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New invoice
          </Button>
        </div>
      </div>
    </div>
  )
}
