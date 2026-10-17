"use client"

import Link from "next/link"
import { format } from "date-fns"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import {
  Calendar,
  DollarSign,
  FileText,
  Mail,
  Phone,
  Tag,
  User,
} from "@/app/components/ui/icons"
import { PropertyRow, hasPropertyValue } from "@/app/leads/components/PropertyRow"
import { formatCurrency } from "@/app/lib/formatters"
import type { SubscriptionDetail, SubscriptionInvoice } from "../actions"
import { SubscriptionDateRow } from "./SubscriptionDateRow"
import { getSubscriptionBillingDate } from "../billing-period"
import { getSubscriptionAmountError, getSubscriptionEndDateError } from "../detail-validation"

function formatDate(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : format(date, "MMM d, yyyy")
}

export function SubscriptionAboutPanel({
  subscription,
  currency,
  invoices,
  onUpdateNextBillingDate,
  onUpdateDueDate,
  onUpdateAmount,
  onUpdateEndDate,
}: {
  subscription: SubscriptionDetail
  currency: string
  invoices: SubscriptionInvoice[]
  onUpdateNextBillingDate: (value: string) => Promise<void>
  onUpdateDueDate: (value: string) => Promise<void>
  onUpdateAmount: (value: number) => Promise<void>
  onUpdateEndDate: (value: string) => Promise<void>
}) {
  const permissions = useOptionalPermissions()
  const readOnly = permissions?.can("update") === false
  const createdLabel = formatDate(subscription.created_at)
  const updatedLabel = formatDate(subscription.updated_at)
  const billingDate = new Date(subscription.next_billing_date || "")
  const billingDateValue = Number.isNaN(billingDate.getTime()) ? null : billingDate.toISOString().slice(0, 10)
  const customerName = subscription.lead?.name || ""
  const totals = invoices.reduce(
    (summary, invoice) => ({
      billed: summary.billed + invoice.amount,
      outstanding: summary.outstanding + invoice.amountDue,
    }),
    { billed: 0, outstanding: 0 }
  )

  return (
    <div className="w-full min-w-0">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        About
      </p>
      <Tabs defaultValue="info" className="w-full min-w-0">
        <TabsList className="mb-3 h-8 w-full justify-start overflow-x-auto rounded-full bg-muted/30 p-0.5">
          <TabsTrigger value="info" className="h-7 rounded-full px-3 text-xs font-medium">
            Info
          </TabsTrigger>
          <TabsTrigger value="customer" className="h-7 rounded-full px-3 text-xs font-medium">
            Customer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-0 min-w-0">
          <div className="grid min-w-0">
            <PropertyRow
              icon={<DollarSign />}
              label="Recurring"
              value={formatCurrency(Number(subscription.amount) || 0, currency)}
              readOnly
            />
            <PropertyRow
              icon={<DollarSign />}
              label="Invoiced"
              value={`${formatCurrency(totals.billed, currency)} · ${invoices.length} ${invoices.length === 1 ? "invoice" : "invoices"}`}
              readOnly
            />
            <PropertyRow
              icon={<DollarSign />}
              label="Outstanding"
              value={formatCurrency(totals.outstanding, currency)}
              readOnly
            />
            <PropertyRow
              icon={<Tag />}
              label="Plan"
              value={subscription.catalog_item?.name}
              empty={!hasPropertyValue(subscription.catalog_item?.name)}
              showEmpty
              readOnly
            />
            <PropertyRow
              icon={<DollarSign />}
              label="Amount"
              value={formatCurrency(Number(subscription.amount) || 0, currency)}
              editValue={String(subscription.amount ?? "")}
              readOnly={readOnly}
              editorLayout="stacked"
              validate={(value) => value.trim() === "" ? "Enter an amount" : getSubscriptionAmountError(Number(value))}
              onCommit={(value) => onUpdateAmount(Number(value))}
              renderEditor={(draft, setDraft) => (
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="subscription-amount" className="sr-only">Amount</Label>
                  <Input
                    id="subscription-amount"
                    type="number"
                    min="0"
                    max="999999999999"
                    step="0.01"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    aria-describedby="subscription-amount-description"
                    className="h-8 w-full min-w-0 text-sm"
                  />
                  <p id="subscription-amount-description" className="text-xs text-muted-foreground">Billing amount per cycle. Existing invoices are unchanged.</p>
                </div>
              )}
            />
            <PropertyRow
              icon={<Calendar />}
              label="Start date"
              value={formatDate(subscription.start_date)}
              empty={!hasPropertyValue(subscription.start_date)}
              showEmpty
              readOnly
            />
            <SubscriptionDateRow
              id="subscription-next-billing-date"
              label="Next billing"
              value={billingDateValue}
              onCommit={onUpdateNextBillingDate}
              readOnly={readOnly}
              description="Reschedules the next cycle and shifts the due date to preserve payment terms. Existing invoices are unchanged."
            />
            <SubscriptionDateRow
              id="subscription-end-date"
              label="End date"
              value={getSubscriptionBillingDate(subscription.end_date)}
              onCommit={onUpdateEndDate}
              readOnly={readOnly}
              allowClear
              validate={(value) => getSubscriptionEndDateError(value, subscription.start_date)}
              description="Must be on or after the start date. Clear to leave the subscription open-ended. Existing invoices are unchanged."
            />
            <SubscriptionDateRow
              id="subscription-due-date"
              label="Due date"
              value={subscription.due_date}
              onCommit={onUpdateDueDate}
              readOnly={readOnly}
              allowClear
              description="Applies to future invoices only. Clear the date to remove the default."
            />
            <PropertyRow
              icon={<FileText />}
              label="Subscription ID"
              value={subscription.id}
              copyValue={subscription.id}
              readOnly
            />
          </div>
        </TabsContent>

        <TabsContent value="customer" className="mt-0 min-w-0">
          <div className="grid min-w-0">
            <PropertyRow
              icon={<User />}
              label="Name"
              value={customerName}
              empty={!hasPropertyValue(customerName)}
              showEmpty
              readOnly
            />
            <PropertyRow
              icon={<Mail />}
              label="Email"
              value={subscription.lead?.email}
              empty={!hasPropertyValue(subscription.lead?.email)}
              showEmpty
              readOnly
            />
            <PropertyRow
              icon={<Phone />}
              label="Phone"
              value={subscription.lead?.phone}
              empty={!hasPropertyValue(subscription.lead?.phone)}
              showEmpty
              readOnly
            />
            <PropertyRow
              icon={<Tag />}
              label="Lead status"
              value={subscription.lead?.status?.replace(/_/g, " ")}
              empty={!hasPropertyValue(subscription.lead?.status)}
              showEmpty
              readOnly
            />
            <PropertyRow
              icon={<FileText />}
              label="Lead ID"
              value={subscription.lead.id}
              copyValue={subscription.lead.id}
              readOnly
            />
          </div>
          <Button asChild variant="outline" className="mt-4 w-full">
            <Link href={`/leads/${subscription.lead.id}`}>View customer</Link>
          </Button>
        </TabsContent>
      </Tabs>

      <p className="mt-6 text-[11px] text-muted-foreground">
        {createdLabel ? `Created ${createdLabel}` : ""}
        {updatedLabel ? ` · Updated ${updatedLabel}` : ""}
      </p>
    </div>
  )
}
