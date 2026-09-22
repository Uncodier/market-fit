"use client"

import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Receipt } from "@/app/components/ui/icons"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  MoneyCell,
  StatusDot,
  documentListShellClassName,
  documentRowAccent,
} from "@/app/components/documents/document-list"
import { formatCurrency } from "@/app/lib/formatters"
import type { SubscriptionInvoice } from "../actions"

function formatInvoiceDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : format(date, "MMM d, yyyy")
}

function invoiceReference(invoice: SubscriptionInvoice) {
  return invoice.invoiceNumber
    ? `#${invoice.invoiceNumber}`
    : `#${invoice.id.slice(0, 8).toUpperCase()}`
}

export function SubscriptionInvoicesTable({
  invoices,
}: {
  invoices: SubscriptionInvoice[]
}) {
  const router = useRouter()

  if (invoices.length === 0) {
    return (
      <EmptyCard
        icon={<Receipt className="h-12 w-12 text-muted-foreground" />}
        title="No invoices yet"
        description="Create the first invoice for this subscription."
      />
    )
  }

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[660px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[38%]">Invoice</DocumentListHead>
            <DocumentListHead className="w-[18%]">Status</DocumentListHead>
            <DocumentListHead className="w-[20%]">Date</DocumentListHead>
            <DocumentListHead className="w-[24%]" align="right">Amount</DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => {
            const cancelled = invoice.status === "cancelled" || invoice.status === "refunded"
            const dueLabel =
              !cancelled && invoice.amountDue > 0
                ? `${formatCurrency(invoice.amountDue, invoice.currency)} due`
                : null

            return (
              <DocumentListRow
                key={invoice.id}
                onClick={() => router.push(`/sales/${invoice.id}`)}
                accent={documentRowAccent(invoice.status, invoice.amountDue)}
              >
                <TableCell className="py-3.5">
                  <EntityCell
                    name={invoice.title}
                    secondary={invoiceReference(invoice)}
                  />
                </TableCell>
                <TableCell className="py-3.5">
                  <StatusDot
                    status={invoice.status}
                    label={invoice.status.replace(/_/g, " ")}
                  />
                </TableCell>
                <TableCell className="py-3.5 text-sm text-muted-foreground">
                  {formatInvoiceDate(invoice.saleDate)}
                </TableCell>
                <TableCell className="py-3.5">
                  <MoneyCell
                    amountLabel={formatCurrency(invoice.amount, invoice.currency)}
                    dueLabel={dueLabel}
                    paidLabel={!cancelled && invoice.amountDue <= 0 ? "Paid" : null}
                    cancelled={cancelled}
                    paidRatio={
                      invoice.amount > 0
                        ? Math.max(0, (invoice.amount - invoice.amountDue) / invoice.amount)
                        : 1
                    }
                  />
                </TableCell>
              </DocumentListRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
