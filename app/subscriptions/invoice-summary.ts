import type { Subscription } from "@/app/types"

export interface PendingSubscriptionInvoice {
  id: string
  title: string
  invoiceNumber: string | null
  amountDue: number
  currency: string
}

export interface SubscriptionListItem extends Subscription {
  pendingInvoices?: PendingSubscriptionInvoice[]
}

export function isOutstandingInvoice(invoice: { status: string; amountDue: number }) {
  return (invoice.status === "pending" || invoice.status === "completed") &&
    Number.isFinite(invoice.amountDue) && invoice.amountDue > 0
}

export function invoiceBalances(invoices: PendingSubscriptionInvoice[]) {
  const balances = new Map<string, number>()
  for (const invoice of invoices) {
    balances.set(invoice.currency, (balances.get(invoice.currency) || 0) + invoice.amountDue)
  }
  return Array.from(balances, ([currency, amount]) => ({ currency, amount }))
}