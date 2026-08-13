"use client"

import React from "react"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { FileText, Pause, Pencil, Play } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { AccountingAccount, AccountType } from "@/app/types"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

const ACCOUNT_TYPE_ORDER: AccountType[] = ["asset", "liability", "equity", "income", "expense"]

const TYPE_TOTAL: Record<AccountType, { key: string; fallback: string }> = {
  asset: { key: "accounting.totalAssets", fallback: "Total Assets" },
  liability: { key: "accounting.totalLiabilities", fallback: "Total Liabilities" },
  equity: { key: "accounting.totalEquity", fallback: "Total Equity" },
  income: { key: "accounting.totalIncome", fallback: "Total Income" },
  expense: { key: "accounting.totalExpenses", fallback: "Total Expenses" },
}

function groupAccounts(accounts: AccountingAccount[]) {
  return ACCOUNT_TYPE_ORDER
    .map((type) => ({
      type,
      accounts: accounts.filter((account) => account.type === type),
    }))
    .filter((group) => group.accounts.length > 0)
}

function GroupFooter({ label, count }: { label: string; count: number }) {
  return (
    <TableRow className="bg-muted/30 hover:bg-muted/30">
      <TableCell className="py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </TableCell>
      <TableCell colSpan={2} />
      <TableCell className="py-3 text-right">
        <span className="text-[15px] font-semibold tabular-nums tracking-tight">{count}</span>
      </TableCell>
    </TableRow>
  )
}

function AccountRow({
  account,
  onEdit,
  onToggleActive,
}: {
  account: AccountingAccount
  onEdit: (account: AccountingAccount) => void
  onToggleActive: (account: AccountingAccount) => void
}) {
  const { t } = useLocalization()
  const typeLabel = t(`accounting.filter.${account.type}`) || account.type
  const statusLabel = account.active
    ? (t("accounting.active") || "Active")
    : (t("accounting.inactive") || "Inactive")

  return (
    <DocumentListRow
      onClick={() => onEdit(account)}
      accent={account.active ? "none" : "cancelled"}
    >
      <TableCell className="py-3.5">
        <EntityCell
          name={account.label}
          secondary={account.code}
          meta={account.system ? (t("accounting.system") || "System") : null}
        />
      </TableCell>
      <TableCell className="py-3.5">
        <StatusDot status={account.type} label={typeLabel} />
      </TableCell>
      <TableCell className="py-3.5">
        <StatusDot status={account.active ? "active" : "inactive"} label={statusLabel} />
      </TableCell>
      <TableCell className="py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
            onClick={() => onEdit(account)}
          >
            <Pencil className="h-4 w-4" />
            <span className="sr-only">{t("common.edit") || "Edit"}</span>
          </Button>
          {!account.system ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
              onClick={() => onToggleActive(account)}
            >
              {account.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span className="sr-only">
                {account.active
                  ? (t("accounting.deactivate") || "Deactivate")
                  : (t("accounting.activate") || "Activate")}
              </span>
            </Button>
          ) : null}
        </div>
      </TableCell>
    </DocumentListRow>
  )
}

export function ChartOfAccountsTable({
  accounts,
  onEdit,
  onToggleActive,
}: {
  accounts: AccountingAccount[]
  onEdit: (account: AccountingAccount) => void
  onToggleActive: (account: AccountingAccount) => void
}) {
  const { t } = useLocalization()
  const groups = groupAccounts(accounts)
  const activeCount = accounts.filter((account) => account.active).length

  if (accounts.length === 0) {
    return (
      <EmptyCard
        icon={<FileText className="h-12 w-12 text-muted-foreground" />}
        title={t("accounting.noAccountsFound") || "No accounts found matching this filter."}
      />
    )
  }

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[680px]">
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[42%]">{t("accounting.accountName") || "Account Name"}</DocumentListHead>
            <DocumentListHead className="w-[18%]">{t("accounting.type") || "Type"}</DocumentListHead>
            <DocumentListHead className="w-[22%]">{t("accounting.status") || "Status"}</DocumentListHead>
            <DocumentListHead className="w-[18%]" align="right">{t("accounting.actions") || "Actions"}</DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => {
            const total = TYPE_TOTAL[group.type]
            return (
              <React.Fragment key={group.type}>
                {group.accounts.map((account) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    onEdit={onEdit}
                    onToggleActive={onToggleActive}
                  />
                ))}
                <GroupFooter
                  label={t(total.key) || total.fallback}
                  count={group.accounts.length}
                />
              </React.Fragment>
            )
          })}
        </TableBody>
        {groups.length > 1 ? (
          <tfoot>
            <tr className="bg-muted/30">
              <TableCell className="py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {t("accounting.totals") || "Totals"}
              </TableCell>
              <TableCell colSpan={2} />
              <TableCell className="py-3 text-right">
                <span className="text-[15px] font-semibold tabular-nums tracking-tight">{accounts.length}</span>
              </TableCell>
            </tr>
          </tfoot>
        ) : null}
      </Table>
      <div className="flex items-center justify-between gap-4 border-t border-border/60 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{accounts.length}</span>
          {" "}
          {accounts.length === 1
            ? (t("accounting.account") || "account")
            : (t("accounting.accounts") || "accounts")}
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{activeCount}</span>
          {" "}
          {t("accounting.active") || "Active"}
        </p>
      </div>
    </div>
  )
}

export function ChartOfAccountsTableSkeleton() {
  return (
    <div className={documentListShellClassName()}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <DocumentListHead>Account</DocumentListHead>
            <DocumentListHead>Type</DocumentListHead>
            <DocumentListHead>Status</DocumentListHead>
            <DocumentListHead align="right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, index) => (
            <TableRow key={index} className="hover:bg-transparent">
              <TableCell className="py-3.5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="ml-auto h-8 w-8" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
