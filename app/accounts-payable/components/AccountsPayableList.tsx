"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { MoreHorizontal, CreditCard, Users } from "@/app/components/ui/icons"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { DocumentListHead, DocumentListRow, EntityCell, MoneyCell, StatusDot, documentListShellClassName } from "@/app/components/documents/document-list"
import { SupplierBillPaymentDialog } from "./SupplierBillPaymentDialog"
import { formatCurrency } from "@/app/lib/formatters"
import { isDateOnly } from "@/lib/finance/due-date"
import { payableStatus, payableTotals, type PayableAccount, type PayableBalance } from "../summary"

const STATUS_KEYS = {
  overdue: "controlCenter.table.overdue",
  current: "operations.payables.current",
  no_due_date: "operations.payables.noDueDate",
}

function Balances({ balances }: { balances: PayableBalance[] }) {
  const { t, locale } = useLocalization()
  return <div className="space-y-1">
    {balances.map(({ currency, amount }) => (
      <MoneyCell key={currency} amountLabel={currency === "Unknown"
        ? t("operations.payables.unknownCurrency", {
          amount: amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        })
        : formatCurrency(amount, currency)} />
    ))}
  </div>
}

export function AccountsPayableList({ accounts, siteId, today, orderFilter }: {
  accounts: PayableAccount[]
  siteId: string
  today: string
  orderFilter: "active" | "cancelled"
}) {
  const { t, locale } = useLocalization()
  const permissions = useOptionalPermissions()
  const router = useRouter()
  const [accountToPay, setAccountToPay] = useState<PayableAccount | null>(null)
  const invoiceCount = accounts.reduce((sum, account) => sum + account.invoiceCount, 0)
  const canUpdate = !siteId.startsWith("demo-") && permissions?.can("update") !== false
  const dateLabel = (value?: string | null) => isDateOnly(value)
    ? new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
      .format(new Date(`${value}T00:00:00Z`))
    : t("notSet")
  const invoiceLabel = (count: number) => t(count === 1
    ? "operations.payables.invoiceCount" : "operations.payables.invoicesCount", { count })

  return <>
    {accounts.length === 0 ? (
      <EmptyCard icon={<CreditCard size={24} className="text-muted-foreground" />}
        title={t("operations.payables.emptyTitle")}
        description={t("operations.payables.emptyDescription")} />
    ) : (
      <div className={documentListShellClassName()}>
        <Table aria-label={t("operations.payables.tableAria")} className="min-w-[920px]">
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <TableRow className="hover:bg-transparent">
              <DocumentListHead className="w-[28%]">{t("operations.payables.supplier")}</DocumentListHead>
              <DocumentListHead className="w-[12%]">{t("common.status")}</DocumentListHead>
              <DocumentListHead className="w-[17%]">{t("operations.payables.oldestDueDate")}</DocumentListHead>
              <DocumentListHead className="w-[17%]" align="right">{t("operations.payables.openInvoices")}</DocumentListHead>
              <DocumentListHead className="w-[17%]" align="right">{t("operations.payables.amountDue")}</DocumentListHead>
              <DocumentListHead className="w-[9%]" align="right">{t("actions")}</DocumentListHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map(account => {
              const status = payableStatus(account, today)
              const href = `/companies/${account.vendorId}`
              const name = account.name === "Unknown supplier" ? t("operations.payables.unknownSupplier") : account.name
              return <DocumentListRow key={account.vendorId} accent={status === "overdue" ? "due" : "none"}
                onClick={() => router.push(href)}>
                <TableCell className="py-3.5">
                  <Link href={href} onClick={event => event.stopPropagation()} className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <EntityCell name={name} secondary={account.email || account.phone} secondaryMono={false} />
                  </Link>
                </TableCell>
                <TableCell className="py-3.5">
                  <StatusDot status={status === "overdue" ? "pending" : status === "current" ? "active" : "draft"} label={t(STATUS_KEYS[status])} />
                </TableCell>
                <TableCell className="py-3.5">
                  <div className="text-sm text-muted-foreground whitespace-nowrap">
                    {dateLabel(account.earliestDueDate)}
                    {account.oldestInvoiceDate ? <span className="block text-xs text-muted-foreground">{t("operations.payables.oldestInvoice", { date: dateLabel(account.oldestInvoiceDate) })}</span> : null}
                  </div>
                </TableCell>
                <TableCell className="py-3.5 text-right">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    {invoiceLabel(account.invoiceCount)}
                  </p>
                </TableCell>
                <TableCell className="py-3.5"><Balances balances={account.balances} /></TableCell>
                <TableCell className="py-3.5 text-right" onClick={event => event.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("operations.payables.actionsFor", { name })}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => router.push(href)}>
                        <Users className="h-4 w-4 mr-2" />{t("operations.payables.viewSupplier")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled={!canUpdate} onSelect={() => { if (canUpdate) setAccountToPay(account) }}>
                        <CreditCard className="h-4 w-4 mr-2" />{t("operations.payables.settleBalance")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </DocumentListRow>
            })}
          </TableBody>
          <tfoot>
            <tr className="bg-muted/30">
              <TableCell className="py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{t("subscriptions.table.total")}</TableCell>
              <TableCell colSpan={2} />
              <TableCell className="py-3 text-right"><p className="text-sm font-medium">{invoiceLabel(invoiceCount)}</p></TableCell>
              <TableCell className="py-3"><Balances balances={payableTotals(accounts)} /></TableCell>
              <TableCell />
            </tr>
          </tfoot>
        </Table>
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
          <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{accounts.length}</span> {t(accounts.length === 1 ? "operations.payables.suppliersSingular" : "operations.payables.suppliers")}</p>
        </div>
      </div>
    )}
    {accountToPay ? <SupplierBillPaymentDialog key={`${siteId}:${accountToPay.vendorId}:${orderFilter}`} account={accountToPay} siteId={siteId} orderFilter={orderFilter}
      onClose={() => setAccountToPay(null)} /> : null}
  </>
}