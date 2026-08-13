"use client"

import React from "react"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { ListOrdered } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { AccountingAccount, AccountType } from "@/app/types"
import { cn } from "@/lib/utils"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  MoneyCell,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

type Amounts = Record<string, { debit: number; credit: number }>

const ACCOUNT_TYPE_ORDER: AccountType[] = ["asset", "liability", "equity", "income", "expense"]

const TYPE_TOTAL: Record<AccountType, { key: string; fallback: string }> = {
  asset: { key: "accounting.totalAssets", fallback: "Total Assets" },
  liability: { key: "accounting.totalLiabilities", fallback: "Total Liabilities" },
  equity: { key: "accounting.totalEquity", fallback: "Total Equity" },
  income: { key: "accounting.totalIncome", fallback: "Total Income" },
  expense: { key: "accounting.totalExpenses", fallback: "Total Expenses" },
}

type TrialRow = {
  code: string
  label: string
  type: AccountType
  debit: number
  credit: number
}

function trialRows(
  bsData: Amounts,
  accounts: Record<string, AccountingAccount>
): TrialRow[] {
  return Object.entries(bsData)
    .sort(([codeA], [codeB]) => codeA.localeCompare(codeB))
    .flatMap(([code, amounts]) => {
      const account = accounts[code]
      if (!account) return []
      const balance = amounts.debit - amounts.credit
      if (Math.abs(balance) < 0.005) return []
      return [{
        code,
        label: account.label,
        type: account.type,
        debit: balance > 0 ? balance : 0,
        credit: balance < 0 ? Math.abs(balance) : 0,
      }]
    })
}

function groupRows(rows: TrialRow[]) {
  return ACCOUNT_TYPE_ORDER
    .map((type) => ({
      type,
      rows: rows.filter((row) => row.type === type),
    }))
    .filter((group) => group.rows.length > 0)
}

function MoneyFooter({ amount, formatCurrency }: { amount: number; formatCurrency: (value: number) => string }) {
  if (amount <= 0) return null
  return <MoneyCell amountLabel={formatCurrency(amount)} />
}

function GroupFooter({
  label,
  debit,
  credit,
  formatCurrency,
}: {
  label: string
  debit: number
  credit: number
  formatCurrency: (value: number) => string
}) {
  return (
    <TableRow className="bg-muted/30 hover:bg-muted/30">
      <TableCell className="py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </TableCell>
      <TableCell />
      <TableCell className="py-3">
        <MoneyFooter amount={debit} formatCurrency={formatCurrency} />
      </TableCell>
      <TableCell className="py-3">
        <MoneyFooter amount={credit} formatCurrency={formatCurrency} />
      </TableCell>
    </TableRow>
  )
}

export function TrialBalanceTable({
  accounts,
  bsData,
  totalDebits,
  totalCredits,
  formatCurrency,
}: {
  accounts: Record<string, AccountingAccount>
  bsData: Amounts
  totalDebits: number
  totalCredits: number
  formatCurrency: (value: number) => string
}) {
  const { t } = useLocalization()
  const rows = trialRows(bsData, accounts)
  const groups = groupRows(rows)
  const balanced = Math.abs(totalDebits - totalCredits) <= 0.01

  if (rows.length === 0) {
    return (
      <EmptyCard
        icon={<ListOrdered className="h-12 w-12 text-muted-foreground" />}
        title={t("accounting.noTrialBalance") || "No balances to show for this period."}
      />
    )
  }

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[760px]">
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[40%]">{t("accounting.accountName") || "Account Name"}</DocumentListHead>
            <DocumentListHead className="w-[16%]">{t("accounting.type") || "Type"}</DocumentListHead>
            <DocumentListHead className="w-[22%]" align="right">{t("accounting.debitBalance") || "Debit Balance"}</DocumentListHead>
            <DocumentListHead className="w-[22%]" align="right">{t("accounting.creditBalance") || "Credit Balance"}</DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => {
            const total = TYPE_TOTAL[group.type]
            const groupDebit = group.rows.reduce((sum, row) => sum + row.debit, 0)
            const groupCredit = group.rows.reduce((sum, row) => sum + row.credit, 0)
            return (
              <React.Fragment key={group.type}>
                {group.rows.map((row) => (
                  <DocumentListRow key={row.code} className="cursor-default" accent="none">
                    <TableCell className="py-3.5">
                      <EntityCell name={row.label} secondary={row.code} />
                    </TableCell>
                    <TableCell className="py-3.5">
                      <StatusDot
                        status={row.type}
                        label={t(`accounting.filter.${row.type}`) || row.type}
                      />
                    </TableCell>
                    <TableCell className="py-3.5">
                      <MoneyFooter amount={row.debit} formatCurrency={formatCurrency} />
                    </TableCell>
                    <TableCell className="py-3.5">
                      <MoneyFooter amount={row.credit} formatCurrency={formatCurrency} />
                    </TableCell>
                  </DocumentListRow>
                ))}
                {groups.length > 1 ? (
                  <GroupFooter
                    label={t(total.key) || total.fallback}
                    debit={groupDebit}
                    credit={groupCredit}
                    formatCurrency={formatCurrency}
                  />
                ) : null}
              </React.Fragment>
            )
          })}
        </TableBody>
        <tfoot>
          <tr
            className={cn(
              "bg-muted/30",
              !balanced && "shadow-[inset_3px_0_0_0] shadow-amber-400 dark:shadow-amber-500"
            )}
          >
            <TableCell className="py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {t("accounting.totals") || "Totals"}
            </TableCell>
            <TableCell />
            <TableCell className="py-3">
              <MoneyCell amountLabel={formatCurrency(totalDebits)} />
            </TableCell>
            <TableCell className="py-3">
              <MoneyCell amountLabel={formatCurrency(totalCredits)} />
            </TableCell>
          </tr>
        </tfoot>
      </Table>
      <div className="flex items-center justify-between gap-4 border-t border-border/60 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{rows.length}</span>
          {" "}
          {rows.length === 1
            ? (t("accounting.account") || "account")
            : (t("accounting.accounts") || "accounts")}
        </p>
        <p className="text-xs text-muted-foreground">
          {balanced
            ? (t("accounting.debitsMatchCredits") || "Debits match credits")
            : (t("accounting.outOfBalance") || "Out of Balance")}
        </p>
      </div>
    </div>
  )
}
