"use client"

import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { CreditCard } from "@/app/components/ui/icons"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  MoneyCell,
  documentListShellClassName,
} from "@/app/components/documents/document-list"
import { formatCurrency } from "@/app/lib/formatters"
import type { SubscriptionInvoice } from "../actions"

interface PaymentRow {
  id: string
  invoiceId: string
  invoiceTitle: string
  invoiceNumber: string | null
  date: string
  amount: number
  method: string
  notes?: string
  currency: string
}

function formatPaymentDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : format(date, "MMM d, yyyy")
}

function formatPaymentMethod(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function invoiceReference(payment: PaymentRow) {
  return payment.invoiceNumber
    ? `#${payment.invoiceNumber}`
    : `#${payment.invoiceId.slice(0, 8).toUpperCase()}`
}

export function SubscriptionPaymentsTable({
  invoices,
}: {
  invoices: SubscriptionInvoice[]
}) {
  const router = useRouter()
  const payments: PaymentRow[] = invoices
    .flatMap((invoice) =>
      invoice.payments.map((payment) => ({
        ...payment,
        invoiceId: invoice.id,
        invoiceTitle: invoice.title,
        invoiceNumber: invoice.invoiceNumber,
        currency: invoice.currency,
      }))
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (payments.length === 0) {
    return (
      <EmptyCard
        icon={<CreditCard className="h-12 w-12 text-muted-foreground" />}
        title="No payments yet"
        description="Payments registered against this subscription's invoices will appear here."
      />
    )
  }

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[660px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[38%]">Invoice</DocumentListHead>
            <DocumentListHead className="w-[22%]">Method</DocumentListHead>
            <DocumentListHead className="w-[20%]">Date</DocumentListHead>
            <DocumentListHead className="w-[20%]" align="right">Amount</DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <DocumentListRow
              key={`${payment.invoiceId}-${payment.id}`}
              onClick={() => router.push(`/sales/${payment.invoiceId}`)}
            >
              <TableCell className="py-3.5">
                <EntityCell
                  name={payment.invoiceTitle}
                  secondary={invoiceReference(payment)}
                  meta={payment.notes || null}
                />
              </TableCell>
              <TableCell className="py-3.5 text-sm text-muted-foreground">
                {formatPaymentMethod(payment.method)}
              </TableCell>
              <TableCell className="py-3.5 text-sm text-muted-foreground">
                {formatPaymentDate(payment.date)}
              </TableCell>
              <TableCell className="py-3.5">
                <MoneyCell
                  amountLabel={formatCurrency(payment.amount, payment.currency)}
                  paidLabel="Paid"
                />
              </TableCell>
            </DocumentListRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
