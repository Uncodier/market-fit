"use client"

import React from "react"
import { Button } from "@/app/components/ui/button"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { MoreHorizontal, Pencil, Trash2 } from "@/app/components/ui/icons"
import { Pagination } from "@/app/components/ui/pagination"
import { Skeleton } from "@/app/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import { useLocalization } from "@/app/context/LocalizationContext"
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut"
import { format } from "date-fns"
import { Purchase } from "@/app/types"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  MoneyCell,
  StatusDot,
  documentListShellClassName,
  documentRowAccent,
} from "@/app/components/documents/document-list"

interface BillsTableProps {
  rows: Purchase[]
  page: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}

export function BillsTable({
  rows,
  page,
  pageSize,
  totalCount,
  onPageChange,
  onOpen,
  onDelete,
}: BillsTableProps) {
  const { t } = useLocalization()
  const totalPages = Math.ceil(totalCount / pageSize)
  const indexOfFirstItem = (page - 1) * pageSize
  const totalAmount = rows.reduce((sum, row) => sum + (row.amount || 0), 0)
  const totalAmountDue = rows.reduce((sum, row) => sum + (row.amountDue || 0), 0)

  return (
    <div className="space-y-4">
      <div className={documentListShellClassName()}>
        <Table className="min-w-[720px]">
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <TableRow className="hover:bg-transparent">
              <DocumentListHead className="w-[38%]">{t("bills.field.vendor") || "Vendor"}</DocumentListHead>
              <DocumentListHead className="w-[16%]">{t("bills.field.status") || "Status"}</DocumentListHead>
              <DocumentListHead className="w-[16%]">{t("bills.field.date") || "Date"}</DocumentListHead>
              <DocumentListHead className="w-[20%]" align="right">{t("bills.field.total") || "Total"}</DocumentListHead>
              <DocumentListHead className="w-[10%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((purchase) => {
              const vendor = purchase.vendorName || t("bills.field.noVendor") || "No vendor"
              const due = purchase.amountDue || 0
              const amount = purchase.amount || 0
              const cancelled = purchase.status === "cancelled"
              const statusLabel = t(`bills.status.${purchase.status}`) || purchase.status
              const dueLabel =
                !cancelled && due > 0
                  ? `${formatCurrency(due)} ${t("bills.table.due") || "due"}`
                  : null
              const paidLabel =
                !cancelled && due <= 0
                  ? t("bills.table.paid") || "Paid"
                  : cancelled
                    ? statusLabel
                    : null
              const itemCount = purchase.items?.length || 0
              const meta =
                itemCount > 0
                  ? `${itemCount} ${itemCount === 1 ? (t("bills.table.item") || "item") : (t("bills.table.items") || "items")}`
                  : null

              return (
                <DocumentListRow
                  key={purchase.id}
                  onClick={() => onOpen(purchase.id)}
                  accent={documentRowAccent(purchase.status, due)}
                >
                  <TableCell className="py-3.5">
                    <EntityCell
                      name={vendor}
                      secondary={purchase.title}
                      meta={meta}
                    />
                  </TableCell>
                  <TableCell className="py-3.5">
                    <StatusDot status={purchase.status} label={statusLabel} />
                  </TableCell>
                  <TableCell className="py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                    {purchase.purchaseDate
                      ? format(new Date(purchase.purchaseDate), "MMM d, yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <MoneyCell
                      amountLabel={formatCurrency(amount)}
                      dueLabel={dueLabel}
                      paidLabel={paidLabel}
                      cancelled={cancelled}
                      paidRatio={amount > 0 ? Math.max(0, (amount - due) / amount) : 1}
                    />
                  </TableCell>
                  <TableCell className="py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onOpen(purchase.id)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          {t("common.open") || "Open"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => onDelete(purchase.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t("common.delete") || "Delete"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </DocumentListRow>
              )
            })}
          </TableBody>
          <tfoot>
            <tr className="bg-muted/30">
              <TableCell className="py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {t("bills.table.total") || "Total"}
              </TableCell>
              <TableCell colSpan={2} />
              <TableCell className="py-3">
                <MoneyCell
                  amountLabel={formatCurrency(totalAmount)}
                  dueLabel={totalAmountDue > 0 ? `${formatCurrency(totalAmountDue)} ${t("bills.table.due") || "due"}` : null}
                />
              </TableCell>
              <TableCell />
            </tr>
          </tfoot>
        </Table>
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {t("bills.table.showing") || "Showing"}{" "}
            <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + 1, totalCount)}</span>
            {" – "}
            <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + pageSize, totalCount)}</span>{" "}
            {t("sales.table.of") || "of"}{" "}
            <span className="font-medium text-foreground">{totalCount}</span>{" "}
            {t("bills.table.bills") || "bills"}
          </p>
          {totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
          )}
        </div>
      </div>
    </div>
  )
}

export function BillsTableSkeleton() {
  return (
    <div className={documentListShellClassName()}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: 5 }).map((_, index) => (
              <DocumentListHead key={index}>
                <Skeleton className="h-3 w-16" />
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
              <TableCell className="py-3.5"><Skeleton className="h-4 w-20" /></TableCell>
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
