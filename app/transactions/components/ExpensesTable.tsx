"use client"

import React from "react"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Pagination } from "@/app/components/ui/pagination"
import { CreditCard, MoreHorizontal, Pencil, Trash2 } from "@/app/components/ui/icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
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

export type ExpenseRow = {
  id: string
  date: string
  category?: string | null
  description?: string | null
  type?: string | null
  amount?: number | null
  currency?: string | null
  accounting_state?: string | null
  campaign?: { id?: string; title?: string } | null
}

function expenseAccent(expense: ExpenseRow): "due" | "cancelled" | "none" {
  if (expense.accounting_state && expense.accounting_state !== "posted") return "due"
  return "none"
}

interface ExpensesTableProps {
  expenses: ExpenseRow[]
  categoryLabels: Record<string, string>
  page: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
  onOpen: (id: string) => void
  onEdit: (expense: ExpenseRow) => void
  onDelete: (id: string) => void
  onPublish: (expense: ExpenseRow) => void
  onUnpublish: (expense: ExpenseRow) => void
}

export function ExpensesTable({
  expenses,
  categoryLabels,
  page,
  pageSize,
  totalCount,
  onPageChange,
  onOpen,
  onEdit,
  onDelete,
  onPublish,
  onUnpublish,
}: ExpensesTableProps) {
  const { t } = useLocalization()
  const totalPages = Math.ceil(totalCount / pageSize)
  const indexOfFirstItem = (page - 1) * pageSize
  const pageTotal = expenses.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)

  if (expenses.length === 0) {
    return (
      <EmptyCard
        icon={<CreditCard size={24} className="text-muted-foreground" />}
        title={t("expenses.empty.title") || "No expenses found"}
        description={t("expenses.empty.description") || "Expenses will appear here once they are added."}
      />
    )
  }

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[760px]">
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[34%]">{t("expenses.table.category") || "Category"}</DocumentListHead>
            <DocumentListHead className="w-[16%]">{t("expenses.table.type") || "Type"}</DocumentListHead>
            <DocumentListHead className="w-[16%]">{t("expenses.table.date") || "Date"}</DocumentListHead>
            <DocumentListHead className="w-[20%]" align="right">{t("expenses.table.amount") || "Amount"}</DocumentListHead>
            <DocumentListHead className="w-[14%]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => {
            const category = categoryLabels[expense.category || ""] || expense.category || (t("expenses.table.uncategorized") || "Uncategorized")
            const typeLabel = t(`expenses.type.${expense.type}`) || expense.type || "—"
            const posted = expense.accounting_state === "posted"
            const dateLabel = expense.date ? format(new Date(expense.date), "MMM d, yyyy") : "—"

            return (
              <DocumentListRow
                key={expense.id}
                onClick={() => onOpen(expense.id)}
                accent={expenseAccent(expense)}
              >
                <TableCell className="py-3.5">
                  <EntityCell
                    name={category}
                    secondary={expense.description || null}
                    secondaryMono={false}
                    meta={expense.campaign?.title || null}
                  />
                </TableCell>
                <TableCell className="py-3.5">
                  <StatusDot status={posted ? "completed" : "draft"} label={typeLabel} />
                </TableCell>
                <TableCell className="py-3.5 text-sm text-muted-foreground">
                  {dateLabel}
                </TableCell>
                <TableCell className="py-3.5">
                  <MoneyCell
                    amountLabel={formatCurrency(Number(expense.amount) || 0, expense.currency || "USD")}
                    paidLabel={posted ? (t("expenses.table.posted") || "Posted") : (t("expenses.table.unposted") || "Unposted")}
                  />
                </TableCell>
                <TableCell className="py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">{t("common.openMenu") || "Open menu"}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(expense)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        {t("common.edit") || "Edit"}
                      </DropdownMenuItem>
                      {!posted && (
                        <DropdownMenuItem onClick={() => onPublish(expense)}>
                          {t("common.publish") || "Publish"}
                        </DropdownMenuItem>
                      )}
                      {posted && (
                        <DropdownMenuItem onClick={() => onUnpublish(expense)}>
                          {t("common.cancel") || "Cancel"}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="text-red-600" onClick={() => onDelete(expense.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t("common.delete") || "Delete"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </DocumentListRow>
            )
          })}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + 1, totalCount)}</span>
          {" – "}
          <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + expenses.length, totalCount)}</span>
          {" of "}
          <span className="font-medium text-foreground">{totalCount}</span>
          {" "}
          {t("expenses.table.expenses") || "expenses"}
          {" · "}
          <span className="font-medium text-foreground">{formatCurrency(pageTotal)}</span>
        </p>
        {totalPages > 1 && (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
        )}
      </div>
    </div>
  )
}

export function ExpensesTableSkeleton() {
  return (
    <div className={documentListShellClassName()}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: 5 }).map((_, index) => (
              <DocumentListHead key={index} align={index === 3 ? "right" : "left"}>
                <Skeleton className={cn("h-3 w-16", index === 3 && "ml-auto")} />
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
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="ml-auto h-5 w-16" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="ml-auto h-8 w-8 rounded-md" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
