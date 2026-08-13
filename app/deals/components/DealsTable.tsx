"use client"

import React from "react"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Briefcase } from "@/app/components/ui/icons"
import { Deal } from "@/app/deals/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { formatCurrency } from "@/app/lib/formatters"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  MoneyCell,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

interface DealsTableProps {
  deals: Deal[]
  currentPage: number
  itemsPerPage: number
  totalDeals: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (value: string) => void
  onDealClick: (deal: Deal) => void
}

function formatTaskDate(dateString: string | null) {
  if (!dateString) return ""
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ""
  const now = new Date()
  const isThisYear = date.getFullYear() === now.getFullYear()
  const isThisMonth = isThisYear && date.getMonth() === now.getMonth()
  if (isThisMonth) return format(date, "MMM d")
  if (isThisYear) return format(date, "MMM")
  return format(date, "MMM yyyy")
}

function isPastDate(value?: string | null) {
  if (!value) return false
  const date = new Date(value)
  if (isNaN(date.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  return date < today
}

function dealAccent(deal: Deal): "due" | "cancelled" | "none" {
  if (deal.stage === "closed_lost" || deal.status === "lost") return "cancelled"
  const overdueTask = isPastDate(deal.next_task?.scheduled_date)
  const pastClose = deal.status === "open" && isPastDate(deal.expected_close_date)
  if (overdueTask || pastClose) return "due"
  return "none"
}

function stageLabel(stage: string) {
  return stage.replace(/_/g, " ")
}

export function DealsTable({
  deals,
  currentPage,
  itemsPerPage,
  totalDeals,
  onPageChange,
  onItemsPerPageChange,
  onDealClick,
}: DealsTableProps) {
  const { t } = useLocalization()
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage
  const totalPages = Math.ceil(totalDeals / itemsPerPage)

  if (deals.length === 0) {
    return (
      <EmptyCard
        icon={<Briefcase className="h-6 w-6 text-muted-foreground" />}
        title={t("deals.table.noDeals") || "No deals found."}
        description={t("deals.empty.desc") || "Get started by creating a new deal."}
      />
    )
  }

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[860px]">
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[32%]">{t("deals.table.name") || "Deal"}</DocumentListHead>
            <DocumentListHead className="w-[14%]">{t("deals.table.stage") || "Stage"}</DocumentListHead>
            <DocumentListHead className="w-[22%]">{t("deals.table.nextActivity") || "Next activity"}</DocumentListHead>
            <DocumentListHead className="w-[12%]">{t("deals.table.score") || "Score"}</DocumentListHead>
            <DocumentListHead className="w-[20%]" align="right">{t("deals.table.amount") || "Amount"}</DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.map((deal) => {
            const company = deal.companies?.name || deal.company?.name || null
            const closeMeta = deal.expected_close_date
              ? `${t("deals.table.closes") || "Closes:"} ${format(new Date(deal.expected_close_date), "MMM d, yyyy")}`
              : (t("deals.table.noCloseDate") || "No close date")
            const nextLabel = deal.next_task
              ? [deal.next_task.title, deal.next_task.scheduled_date ? formatTaskDate(deal.next_task.scheduled_date) : null]
                  .filter(Boolean)
                  .join(" · ")
              : (t("deals.table.notScheduled") || "Not scheduled")
            const score = deal.qualification_score
            const paidRatio = typeof score === "number" ? Math.min(1, Math.max(0, score / 100)) : null

            return (
              <DocumentListRow
                key={deal.id}
                onClick={() => onDealClick(deal)}
                accent={dealAccent(deal)}
              >
                <TableCell className="py-3.5">
                  <EntityCell
                    name={deal.name}
                    secondary={company}
                    secondaryMono={false}
                    meta={closeMeta}
                  />
                </TableCell>
                <TableCell className="py-3.5">
                  <StatusDot status={deal.stage} label={stageLabel(deal.stage)} />
                </TableCell>
                <TableCell className="py-3.5 text-sm text-muted-foreground">
                  <span className={cn(!deal.next_task && "text-muted-foreground/70")}>{nextLabel}</span>
                </TableCell>
                <TableCell className="py-3.5">
                  {typeof score === "number" ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-sm tabular-nums font-medium">{score}</span>
                      <span className="h-1 w-14 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-rose-500"
                          )}
                          style={{ width: `${Math.max(6, Math.round((paidRatio || 0) * 100))}%` }}
                        />
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t("deals.table.unscored") || "Unscored"}</span>
                  )}
                </TableCell>
                <TableCell className="py-3.5">
                  <MoneyCell
                    amountLabel={formatCurrency(deal.amount || 0, deal.currency || "USD")}
                    cancelled={deal.stage === "closed_lost" || deal.status === "lost"}
                  />
                </TableCell>
              </DocumentListRow>
            )
          })}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
        <div className="flex items-center gap-4">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + 1, totalDeals)}</span>
            {" – "}
            <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + deals.length, totalDeals)}</span>
            {" of "}
            <span className="font-medium text-foreground">{totalDeals}</span>
            {" "}
            {t("deals.table.dealsCount") || "deals"}
          </p>
          <Select value={itemsPerPage.toString()} onValueChange={onItemsPerPageChange}>
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={itemsPerPage.toString()} />
            </SelectTrigger>
            <SelectContent side="top">
              {[5, 10, 20, 50].map((value) => (
                <SelectItem key={value} value={value.toString()}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {totalPages > 1 && (
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
        )}
      </div>
    </div>
  )
}
