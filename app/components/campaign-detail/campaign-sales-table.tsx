"use client"

import React from "react"
import { Button } from "@/app/components/ui/button"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import { Pencil, Trash2 } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { formatCurrency } from "@/app/lib/formatters"
import { format } from "date-fns"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  MoneyCell,
  SourceLabel,
  StatusDot,
  documentListShellClassName,
  documentRowAccent,
  normalizeSource,
} from "@/app/components/documents/document-list"

function formatSaleDate(dateString: string) {
  try {
    return format(new Date(dateString), "MMM d, yyyy")
  } catch {
    return dateString
  }
}

export function CampaignSalesTable({
  sales,
  onEdit,
  onDelete,
}: {
  sales: any[]
  onEdit: (sale: any) => void
  onDelete: (id: string) => void
}) {
  const { t } = useLocalization()
  const totalAmount = sales.reduce((sum, sale) => sum + (sale.amount || 0), 0)

  if (sales.length === 0) {
    return <p className="text-sm text-muted-foreground py-3">No sales yet.</p>
  }

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[720px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[32%]">
              {t("campaigns.detail.sales.table.sale") || "Sale"}
            </DocumentListHead>
            <DocumentListHead className="w-[14%]">
              {t("campaigns.detail.sales.table.status") || "Status"}
            </DocumentListHead>
            <DocumentListHead className="w-[12%]">
              {t("campaigns.detail.sales.table.source") || "Source"}
            </DocumentListHead>
            <DocumentListHead className="w-[16%]">
              {t("campaigns.detail.sales.table.date") || "Date"}
            </DocumentListHead>
            <DocumentListHead className="w-[16%]" align="right">
              {t("campaigns.detail.sales.table.amount") || "Amount"}
            </DocumentListHead>
            <DocumentListHead className="w-[10%]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((sale) => {
            const sourceKey = normalizeSource(sale.source)
            const status = sale.status || "pending"
            const statusLabel = t(`sales.status.${status}`) || status
            const sourceLabel = t(`sales.source.${sourceKey}`) || sourceKey
            const cancelled = status === "cancelled" || status === "refunded"
            const payment = sale.paymentMethod?.replace(/_/g, " ")

            return (
              <DocumentListRow
                key={sale.id}
                accent={documentRowAccent(status, 0)}
                className="cursor-default"
              >
                <TableCell className="py-3.5">
                  <EntityCell
                    name={sale.title || sale.productName || "Untitled sale"}
                    secondary={sale.productName && sale.title ? sale.productName : null}
                    secondaryMono={false}
                    meta={payment ? payment : null}
                  />
                </TableCell>
                <TableCell className="py-3.5">
                  <StatusDot status={status} label={statusLabel} />
                </TableCell>
                <TableCell className="py-3.5">
                  <SourceLabel source={sourceKey} label={sourceLabel} />
                </TableCell>
                <TableCell className="py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                  {formatSaleDate(sale.saleDate)}
                </TableCell>
                <TableCell className="py-3.5">
                  <MoneyCell
                    amountLabel={formatCurrency(sale.amount || 0)}
                    cancelled={cancelled}
                  />
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
                      <DropdownMenuItem onClick={() => onEdit(sale)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        {t("common.edit") || "Edit"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(sale.id)}
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
              {t("campaigns.detail.sales.table.total") || "Total"}
            </TableCell>
            <TableCell colSpan={3} />
            <TableCell className="py-3">
              <MoneyCell amountLabel={formatCurrency(totalAmount)} />
            </TableCell>
            <TableCell />
          </tr>
        </tfoot>
      </Table>
    </div>
  )
}
