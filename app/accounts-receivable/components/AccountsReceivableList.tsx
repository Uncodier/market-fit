"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { Button } from "@/app/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { MoreHorizontal, CreditCard, Users } from "@/app/components/ui/icons"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { DocumentListHead, DocumentListRow, EntityCell, MoneyCell, StatusDot, documentListShellClassName } from "@/app/components/documents/document-list"
import { LeadPaymentDialog } from "@/app/leads/components/LeadPaymentDialog"
import { formatCurrency } from "@/app/lib/formatters"
import { formatDueDate } from "@/lib/finance/due-date"
import { receivableStatus, receivableTotals, type ReceivableAccount, type ReceivableBalance } from "../summary"

const STATUS_LABELS = { overdue: "Overdue", current: "Not overdue", no_due_date: "No due date" }

function Balances({ balances }: { balances: ReceivableBalance[] }) {
  return <div className="space-y-1">
    {balances.map(({ currency, amount }) => (
      <MoneyCell key={currency} amountLabel={currency === "Unknown"
        ? `${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (unknown currency)`
        : formatCurrency(amount, currency)} />
    ))}
  </div>
}

export function AccountsReceivableList({ accounts, siteId, today }: {
  accounts: ReceivableAccount[]
  siteId: string
  today: string
}) {
  const permissions = useOptionalPermissions()
  const router = useRouter()
  const [accountToPay, setAccountToPay] = useState<ReceivableAccount | null>(null)
  const invoiceCount = accounts.reduce((sum, account) => sum + account.invoiceCount, 0)
  const canUpdate = !siteId.startsWith("demo-") && permissions?.can("update") !== false

  return <>
    {accounts.length === 0 ? (
      <EmptyCard icon={<CreditCard size={24} className="text-muted-foreground" />}
        title="No accounts receivable found"
        description="Leads with open invoice balances will appear here. Try changing your search or filters." />
    ) : (
      <div className={documentListShellClassName()}>
        <Table aria-label="Accounts receivable" className="min-w-[920px]">
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <TableRow className="hover:bg-transparent">
              <DocumentListHead className="w-[28%]">Customer</DocumentListHead>
              <DocumentListHead className="w-[12%]">Status</DocumentListHead>
              <DocumentListHead className="w-[17%]">Oldest due date</DocumentListHead>
              <DocumentListHead className="w-[17%]" align="right">Open invoices</DocumentListHead>
              <DocumentListHead className="w-[17%]" align="right">Amount due</DocumentListHead>
              <DocumentListHead className="w-[9%]" align="right">Actions</DocumentListHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map(account => {
              const status = receivableStatus(account, today)
              const href = `/leads/${account.leadId}`
              return <DocumentListRow key={account.leadId} accent={status === "overdue" ? "due" : "none"}
                onClick={() => router.push(href)}>
                <TableCell className="py-3.5">
                  <Link href={href} onClick={event => event.stopPropagation()} className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <EntityCell name={account.name} secondary={account.email || account.phone} secondaryMono={false} />
                  </Link>
                </TableCell>
                <TableCell className="py-3.5">
                  <StatusDot status={status === "overdue" ? "pending" : status === "current" ? "active" : "draft"} label={STATUS_LABELS[status]} />
                </TableCell>
                <TableCell className="py-3.5">
                  <div className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDueDate(account.earliestDueDate)}
                    {account.oldestInvoiceDate ? <span className="block text-xs text-muted-foreground">Oldest invoice: {formatDueDate(account.oldestInvoiceDate)}</span> : null}
                  </div>
                </TableCell>
                <TableCell className="py-3.5 text-right">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    {account.invoiceCount} {account.invoiceCount === 1 ? "invoice" : "invoices"}
                  </p>
                </TableCell>
                <TableCell className="py-3.5"><Balances balances={account.balances} /></TableCell>
                <TableCell className="py-3.5 text-right" onClick={event => event.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${account.name}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => router.push(href)}>
                        <Users className="h-4 w-4 mr-2" />View lead
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled={!canUpdate} onSelect={() => { if (canUpdate) setAccountToPay(account) }}>
                        <CreditCard className="h-4 w-4 mr-2" />Settle balance / Add payment
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </DocumentListRow>
            })}
          </TableBody>
          <tfoot>
            <tr className="bg-muted/30">
              <TableCell className="py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Total</TableCell>
              <TableCell colSpan={2} />
              <TableCell className="py-3 text-right"><p className="text-sm font-medium">{invoiceCount} {invoiceCount === 1 ? "invoice" : "invoices"}</p></TableCell>
              <TableCell className="py-3"><Balances balances={receivableTotals(accounts)} /></TableCell>
              <TableCell />
            </tr>
          </tfoot>
        </Table>
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
          <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{accounts.length}</span> {accounts.length === 1 ? "lead" : "leads"}</p>
        </div>
      </div>
    )}
    {accountToPay ? <LeadPaymentDialog leadId={accountToPay.leadId} leadName={accountToPay.name}
      open onOpenChange={open => { if (!open) setAccountToPay(null) }} /> : null}
  </>
}