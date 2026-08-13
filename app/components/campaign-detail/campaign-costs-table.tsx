"use client"

import React from "react"
import { Button } from "@/app/components/ui/button"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Skeleton } from "@/app/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import { Pencil, Trash2 } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { formatCurrency } from "@/app/lib/formatters"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  MoneyCell,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

export function CampaignCostsTable({
  transactions,
  loading,
  total,
  onEdit,
  onDelete,
}: {
  transactions: any[]
  loading: boolean
  total: number
  onEdit: (transaction: any) => void
  onDelete: (id: string) => void
}) {
  const { t } = useLocalization()

  if (loading) {
    return (
      <div className={documentListShellClassName()}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <DocumentListHead>Category</DocumentListHead>
              <DocumentListHead>Type</DocumentListHead>
              <DocumentListHead>Date</DocumentListHead>
              <DocumentListHead align="right">Amount</DocumentListHead>
              <DocumentListHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3].map((i) => (
              <TableRow key={i} className="hover:bg-transparent">
                <TableCell className="py-3.5"><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell className="py-3.5"><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell className="py-3.5"><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell className="py-3.5"><Skeleton className="ml-auto h-4 w-16" /></TableCell>
                <TableCell className="py-3.5"><Skeleton className="ml-auto h-4 w-6" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (transactions.length === 0) {
    return <p className="text-sm text-muted-foreground py-3">No expenses yet.</p>
  }

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[34%]">
              {t("campaigns.detail.costs.table.category") || "Category"}
            </DocumentListHead>
            <DocumentListHead className="w-[16%]">
              {t("campaigns.detail.costs.table.type") || "Type"}
            </DocumentListHead>
            <DocumentListHead className="w-[18%]">
              {t("campaigns.detail.costs.table.date") || "Date"}
            </DocumentListHead>
            <DocumentListHead className="w-[20%]" align="right">
              {t("campaigns.detail.costs.table.amount") || "Amount"}
            </DocumentListHead>
            <DocumentListHead className="w-[12%]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((cost, index) => {
            const typeKey = cost.type === "fixed" ? "fixed" : "variable"
            return (
              <DocumentListRow key={cost.id || index} accent="none" className="cursor-default">
                <TableCell className="py-3.5">
                  <EntityCell
                    name={cost.category || (t("campaigns.detail.costs.uncategorized") || "Uncategorized")}
                    secondary={cost.description || null}
                    secondaryMono={false}
                  />
                </TableCell>
                <TableCell className="py-3.5">
                  <StatusDot
                    status={typeKey === "fixed" ? "completed" : "pending"}
                    label={t(`campaigns.detail.costs.type.${typeKey}`) || (typeKey === "fixed" ? "Fixed" : "Variable")}
                  />
                </TableCell>
                <TableCell className="py-3.5 text-sm text-muted-foreground">
                  {cost.date || "—"}
                </TableCell>
                <TableCell className="py-3.5">
                  <MoneyCell amountLabel={formatCurrency(Number(cost.amount) || 0)} />
                </TableCell>
                <TableCell className="py-3.5 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <span className="sr-only">{t("common.openMenu") || "Open menu"}</span>
                        <span className="text-base leading-none">⋮</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(cost)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        {t("common.edit") || "Edit"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(cost.id)}
                        className="text-red-600"
                      >
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
        <tfoot>
          <tr className="bg-muted/30">
            <TableCell className="py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {t("campaigns.detail.costs.table.total") || "Total"}
            </TableCell>
            <TableCell colSpan={2} />
            <TableCell className="py-3">
              <MoneyCell amountLabel={formatCurrency(total)} />
            </TableCell>
            <TableCell />
          </tr>
        </tfoot>
      </Table>
    </div>
  )
}
