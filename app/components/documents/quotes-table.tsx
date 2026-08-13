"use client"

import React from "react"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Pagination } from "@/app/components/ui/pagination"
import { ExternalLink, FileText } from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { useLocalization } from "@/app/context/LocalizationContext"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/app/lib/formatters"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  MoneyCell,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

export type QuoteListItem = {
  id: string
  entityName: string
  entityEmail?: string | null
  status: string
  validUntil?: string | null
  total: number
  currency?: string
  createdAt: string
}

function quoteAccent(status: string, validUntil?: string | null): "due" | "cancelled" | "none" {
  const key = status.toLowerCase()
  if (key === "rejected" || key === "expired") return "cancelled"
  if (key === "draft") return "due"
  if (key === "sent" && validUntil && !isNaN(new Date(validUntil).getTime()) && new Date(validUntil) < new Date()) {
    return "due"
  }
  return "none"
}

function formatDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (isNaN(date.getTime())) return null
  return format(date, "MMM d, yyyy")
}

function isPast(value?: string | null) {
  if (!value) return false
  const date = new Date(value)
  if (isNaN(date.getTime())) return false
  return date < new Date()
}

interface QuotesTableProps {
  rows: QuoteListItem[]
  page: number
  pageSize: number
  totalCount: number
  entityColumnLabel: string
  emptyTitle: string
  emptyDescription: string
  onPageChange: (page: number) => void
  onRowClick: (id: string) => void
}

export function QuotesTable({
  rows,
  page,
  pageSize,
  totalCount,
  entityColumnLabel,
  emptyTitle,
  emptyDescription,
  onPageChange,
  onRowClick,
}: QuotesTableProps) {
  const { t } = useLocalization()
  const totalPages = Math.ceil(totalCount / pageSize)
  const indexOfFirstItem = (page - 1) * pageSize
  const pageTotal = rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0)

  if (rows.length === 0) {
    return (
      <EmptyCard
        icon={<FileText size={24} className="text-muted-foreground" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={documentListShellClassName()}>
        <Table className="min-w-[780px]">
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <TableRow className="hover:bg-transparent">
              <DocumentListHead className="w-[32%]">{entityColumnLabel}</DocumentListHead>
              <DocumentListHead className="w-[14%]">{t("quotations.list.table.status") || "Status"}</DocumentListHead>
              <DocumentListHead className="w-[18%]">{t("quotations.list.table.validUntil") || "Valid Until"}</DocumentListHead>
              <DocumentListHead className="w-[22%]" align="right">{t("quotations.list.table.total") || "Total"}</DocumentListHead>
              <DocumentListHead className="w-[14%]" align="right">{t("quotations.list.table.actions") || "Actions"}</DocumentListHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const statusKey = (row.status || "").toLowerCase()
              const statusLabel = t(`status.${statusKey}`) || t(`quotations.status.${statusKey}`) || row.status || "—"
              const cancelled = statusKey === "rejected" || statusKey === "expired"
              const expiredWindow = isPast(row.validUntil) && statusKey === "sent"
              const amount = Number(row.total) || 0
              const currency = row.currency || "USD"
              const created = formatDate(row.createdAt)
              const validUntil = formatDate(row.validUntil)

              return (
                <DocumentListRow
                  key={row.id}
                  onClick={() => onRowClick(row.id)}
                  accent={quoteAccent(statusKey, row.validUntil)}
                >
                  <TableCell className="py-3.5">
                    <EntityCell
                      name={row.entityName}
                      secondary={`#${row.id.slice(0, 8).toUpperCase()}`}
                      meta={created}
                    />
                  </TableCell>
                  <TableCell className="py-3.5">
                    <StatusDot status={statusKey} label={statusLabel} />
                  </TableCell>
                  <TableCell className="py-3.5">
                    <div
                      className={cn(
                        "text-sm whitespace-nowrap",
                        expiredWindow ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                      )}
                    >
                      {validUntil || "—"}
                    </div>
                    {expiredWindow ? (
                      <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        {t("quotations.status.expired") || "Expired"}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <MoneyCell
                      amountLabel={formatCurrency(amount, currency)}
                      dueLabel={
                        expiredWindow
                          ? t("quotations.status.expired") || "Expired"
                          : statusKey === "draft"
                            ? t("status.draft") || "Draft"
                            : null
                      }
                      paidLabel={statusKey === "accepted" ? t("status.accepted") || "Accepted" : null}
                      cancelled={cancelled}
                    />
                  </TableCell>
                  <TableCell className="py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => onRowClick(row.id)}
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span className="sr-only">{t("common.open") || "Open"}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("common.open") || "Open"}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                </DocumentListRow>
              )
            })}
          </TableBody>
          <tfoot>
            <tr className="bg-muted/30">
              <TableCell className="py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {t("quotations.list.table.total") || "Total"}
              </TableCell>
              <TableCell colSpan={2} />
              <TableCell className="py-3">
                <MoneyCell amountLabel={formatCurrency(pageTotal, rows[0]?.currency || "USD")} />
              </TableCell>
              <TableCell />
            </tr>
          </tfoot>
        </Table>
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + 1, totalCount)}</span>
            {" – "}
            <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + rows.length, totalCount)}</span>
            {" of "}
            <span className="font-medium text-foreground">{totalCount}</span>
            {" "}
            {t("quotations.list.table.quotes") || "quotes"}
          </p>
          {totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

export function QuotesTableSkeleton() {
  return (
    <div className={documentListShellClassName()}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: 5 }).map((_, index) => (
              <DocumentListHead key={index} align={index >= 3 ? "right" : "left"}>
                <Skeleton className={cn("h-3 w-16", index >= 3 && "ml-auto")} />
              </DocumentListHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, index) => (
            <TableRow key={index} className="hover:bg-transparent">
              <TableCell className="py-3.5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell className="py-3.5">
                <div className="flex flex-col items-end gap-1.5">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </TableCell>
              <TableCell className="py-3.5"><Skeleton className="ml-auto h-8 w-8 rounded-md" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
