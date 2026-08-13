"use client"

import React, { useMemo, useState } from "react"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { ChevronDown, ChevronRight, ClipboardList, ExternalLink, Pencil, Trash2 } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { formatCurrency } from "@/app/lib/formatters"
import { AccountingAccount } from "@/app/types"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  MoneyCell,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"
import { journalSourceActionKey, journalSourceHref } from "../journal-source"

type JournalLine = {
  id?: string
  account_code?: string
  debit?: number
  credit?: number
}

function lineTotals(entry: { journal_lines?: JournalLine[] }) {
  const lines = entry.journal_lines || []
  const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0)
  const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0)
  return { debit, credit }
}

function formatEntryDate(value: string) {
  try {
    return format(new Date(value), "MMM d, yyyy")
  } catch {
    return value
  }
}

function sortedLines(lines: JournalLine[]) {
  return [...lines].sort((left, right) => {
    const leftDebit = Number(left.debit || 0)
    const rightDebit = Number(right.debit || 0)
    if (leftDebit > 0 && rightDebit <= 0) return -1
    if (rightDebit > 0 && leftDebit <= 0) return 1
    return (left.account_code || "").localeCompare(right.account_code || "")
  })
}

function uniqueNames(names: string[]) {
  const seen = new Set<string>()
  return names.filter((name) => {
    if (!name || seen.has(name)) return false
    seen.add(name)
    return true
  })
}

function compactNames(names: string[]) {
  const unique = uniqueNames(names)
  if (unique.length <= 2) return unique.join(", ")
  return `${unique.slice(0, 2).join(", ")} +${unique.length - 2}`
}

function accountName(code: string, accountsByCode: Map<string, AccountingAccount>) {
  return accountsByCode.get(code)?.label || code
}

function flowPreview(lines: JournalLine[], accountsByCode: Map<string, AccountingAccount>) {
  const debits = compactNames(
    lines.filter((line) => Number(line.debit || 0) > 0).map((line) => accountName(line.account_code || "", accountsByCode))
  )
  const credits = compactNames(
    lines.filter((line) => Number(line.credit || 0) > 0).map((line) => accountName(line.account_code || "", accountsByCode))
  )
  if (debits && credits) return `${debits} → ${credits}`
  return debits || credits || null
}

export function JournalEntriesTable({
  entries,
  accounts,
  currency,
  onOpen,
  onOpenSource,
  onDelete,
}: {
  entries: any[]
  accounts: AccountingAccount[]
  currency: string
  onOpen: (entry: any) => void
  onOpenSource: (entry: any) => void
  onDelete: (id: string) => void
}) {
  const { t } = useLocalization()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const accountsByCode = useMemo(
    () => new Map(accounts.map((account) => [account.code, account])),
    [accounts]
  )
  const pageDebit = entries.reduce((sum, entry) => sum + lineTotals(entry).debit, 0)
  const pageCredit = entries.reduce((sum, entry) => sum + lineTotals(entry).credit, 0)

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (entries.length === 0) {
    return (
      <EmptyCard
        icon={<ClipboardList className="h-12 w-12 text-muted-foreground" />}
        title={t("accounting.noEntries") || "No journal entries found in this period."}
        description={t("accounting.noEntriesDesc") || "Entries will appear here after you sync or create a journal entry."}
      />
    )
  }

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[760px]">
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[36%]">{t("accounting.memo") || "Memo"}</DocumentListHead>
            <DocumentListHead className="w-[14%]">{t("accounting.source") || "Source"}</DocumentListHead>
            <DocumentListHead className="w-[18%]" align="right">{t("accounting.debit") || "Debit"}</DocumentListHead>
            <DocumentListHead className="w-[18%]" align="right">{t("accounting.credit") || "Credit"}</DocumentListHead>
            <DocumentListHead className="w-[14%]" align="right">{t("accounting.actions") || "Actions"}</DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const lines = sortedLines(entry.journal_lines || [])
            const { debit, credit } = lineTotals(entry)
            const unbalanced = Math.abs(debit - credit) > 0.01
            const source = entry.source_type || "manual"
            const sourceLabel = t(`accounting.filter.${source}`) || source
            const sourceHref = journalSourceHref(entry)
            const sourceAction = journalSourceActionKey(entry.source_type)
            const expanded = expandedIds.has(entry.id)
            const preview = flowPreview(lines, accountsByCode)

            return (
              <React.Fragment key={entry.id}>
                <DocumentListRow
                  onClick={() => onOpen(entry)}
                  accent={unbalanced ? "due" : "none"}
                >
                  <TableCell className="py-3.5">
                    <div className="flex min-w-0 items-center gap-1">
                      {lines.length > 0 ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground"
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleExpanded(entry.id)
                          }}
                        >
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span className="sr-only">
                            {expanded
                              ? (t("accounting.hideLines") || "Hide lines")
                              : (t("accounting.showLines") || "Show lines")}
                          </span>
                        </Button>
                      ) : null}
                      <EntityCell
                        name={entry.memo || (t("accounting.untitledEntry") || "Untitled entry")}
                        secondary={formatEntryDate(entry.entry_date)}
                        meta={preview}
                        secondaryMono={false}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <StatusDot status={source} label={sourceLabel} />
                  </TableCell>
                  <TableCell className="py-3.5">
                    <MoneyCell amountLabel={formatCurrency(debit, currency)} />
                  </TableCell>
                  <TableCell className="py-3.5">
                    <MoneyCell amountLabel={formatCurrency(credit, currency)} />
                  </TableCell>
                  <TableCell className="py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                        onClick={() => onOpen(entry)}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">
                          {entry.source_type === "manual"
                            ? (t("common.edit") || "Edit")
                            : (t("accounting.viewEntry") || "View Journal Entry")}
                        </span>
                      </Button>
                      {sourceHref ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                          onClick={() => onOpenSource(entry)}
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span className="sr-only">
                            {t(sourceAction.key) || sourceAction.fallback}
                          </span>
                        </Button>
                      ) : null}
                      {entry.source_type === "manual" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-600 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                          onClick={() => onDelete(entry.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">{t("common.delete") || "Delete"}</span>
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </DocumentListRow>
                {expanded
                  ? lines.map((line, index) => {
                      const code = line.account_code || ""
                      const lineDebit = Number(line.debit || 0)
                      const lineCredit = Number(line.credit || 0)
                      return (
                        <TableRow key={line.id || `${entry.id}-${code}-${index}`} className="bg-muted/20 hover:bg-muted/20">
                          <TableCell className="py-2.5 pl-14">
                            <div className="min-w-0 space-y-0.5">
                              <p className="truncate text-sm leading-tight text-foreground">
                                {accountName(code, accountsByCode)}
                              </p>
                              <p className="truncate font-mono text-[11px] leading-tight text-muted-foreground">{code}</p>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5" />
                          <TableCell className="py-2.5 text-right">
                            {lineDebit > 0 ? (
                              <span className="text-sm tabular-nums text-foreground">{formatCurrency(lineDebit, currency)}</span>
                            ) : null}
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            {lineCredit > 0 ? (
                              <span className="text-sm tabular-nums text-foreground">{formatCurrency(lineCredit, currency)}</span>
                            ) : null}
                          </TableCell>
                          <TableCell className="py-2.5" />
                        </TableRow>
                      )
                    })
                  : null}
              </React.Fragment>
            )
          })}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between gap-4 border-t border-border/60 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{entries.length}</span>
          {" "}
          {entries.length === 1
            ? (t("accounting.entry") || "entry")
            : (t("accounting.entries") || "entries")}
        </p>
        <p className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            {t("accounting.debit") || "Debit"}{" "}
            <span className="font-medium tabular-nums text-foreground">{formatCurrency(pageDebit, currency)}</span>
          </span>
          <span>
            {t("accounting.credit") || "Credit"}{" "}
            <span className="font-medium tabular-nums text-foreground">{formatCurrency(pageCredit, currency)}</span>
          </span>
        </p>
      </div>
    </div>
  )
}

export function JournalEntriesTableSkeleton() {
  return (
    <div className={documentListShellClassName()}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <DocumentListHead>Memo</DocumentListHead>
            <DocumentListHead>Source</DocumentListHead>
            <DocumentListHead align="right">Debit</DocumentListHead>
            <DocumentListHead align="right">Credit</DocumentListHead>
            <DocumentListHead align="right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, index) => (
            <TableRow key={index} className="hover:bg-transparent">
              <TableCell className="py-3.5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="ml-auto h-4 w-16" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="ml-auto h-4 w-16" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="ml-auto h-8 w-8" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
