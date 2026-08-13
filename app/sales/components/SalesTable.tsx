"use client"

import React from "react"
import { Button } from "@/app/components/ui/button"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Printer, CreditCard, ShoppingCart } from "@/app/components/ui/icons"
import { Pagination } from "@/app/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { useLocalization } from "@/app/context/LocalizationContext"
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut"
import { format } from "date-fns"
import { Sale } from "@/app/types"
import { cn } from "@/lib/utils"
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

interface SalesTableProps {
  sales: Sale[]
  currentPage: number
  itemsPerPage: number
  totalSales: number
  segments: Array<{ id: string; name: string }>
  onPageChange: (page: number) => void
  onItemsPerPageChange: (value: string) => void
  onSaleClick: (sale: Sale) => void
  onPrintSale: (sale: Sale) => void
  onRegisterPayment: (sale: Sale) => void
}

function saleRef(sale: Sale) {
  if (sale.invoiceNumber) return `#${sale.invoiceNumber}`
  if (sale.referenceCode) return `#${sale.referenceCode}`
  return `#${sale.id.slice(0, 8).toUpperCase()}`
}

function formatSaleDate(dateString: string) {
  try {
    return format(new Date(dateString), "MMM d, yyyy")
  } catch {
    return dateString
  }
}

export function SalesTable({
  sales,
  currentPage,
  itemsPerPage,
  totalSales,
  segments,
  onPageChange,
  onItemsPerPageChange,
  onSaleClick,
  onPrintSale,
  onRegisterPayment,
}: SalesTableProps) {
  const { t } = useLocalization()
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage
  const totalPages = Math.ceil(totalSales / itemsPerPage)

  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return null
    const segment = segments.find((s) => s.id === segmentId)
    return segment?.name || null
  }

  const totalAmount = sales.reduce((sum, sale) => sum + (sale.amount || 0), 0)
  const totalAmountDue = sales.reduce((sum, sale) => sum + (sale.amount_due || 0), 0)

  if (sales.length === 0) {
    return (
      <EmptyCard
        icon={<ShoppingCart className="h-16 w-16 text-muted-foreground" />}
        title={t("sales.table.empty.title") || "No sales found"}
        description={t("sales.table.empty.desc") || "It seems like you haven't made any sales yet."}
      />
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className={documentListShellClassName()}>
      <Table className="min-w-[760px]">
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[34%]">{t("sales.table.customer") || "Customer"}</DocumentListHead>
            <DocumentListHead className="w-[14%]">{t("sales.table.status") || "Status"}</DocumentListHead>
            <DocumentListHead className="w-[12%]">{t("sales.table.source") || "Source"}</DocumentListHead>
            <DocumentListHead className="w-[14%]">{t("sales.table.date") || "Date"}</DocumentListHead>
            <DocumentListHead className="w-[16%]" align="right">{t("sales.table.amount") || "Amount"}</DocumentListHead>
            <DocumentListHead className="w-[10%]" align="right">{t("sales.table.actions") || "Actions"}</DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((sale) => {
            const customer = sale.leadName || t("sales.table.anonymousCustomer") || "Anonymous Customer"
            const sourceKey = normalizeSource(sale.source, sale.channel)
            const statusLabel = t(`sales.status.${sale.status}`) || sale.status
            const sourceLabel = t(`sales.source.${sourceKey}`) || sourceKey
            const due = sale.amount_due || 0
            const amount = sale.amount || 0
            const cancelled = sale.status === "cancelled" || sale.status === "refunded"
            const dueLabel =
              !cancelled && due > 0
                ? `${formatCurrency(due)} ${t("sales.table.due") || "due"}`
                : null
            const paidLabel =
              !cancelled && due <= 0
                ? t("sales.table.paid") || "Paid"
                : cancelled
                  ? statusLabel
                  : null
            const productLine = [sale.productName, sale.title].filter(Boolean).find((value) => value && !String(value).startsWith("Order -"))
            const meta = [productLine, getSegmentName(sale.segmentId)].filter(Boolean).join(" · ") || null

            return (
              <DocumentListRow
                key={sale.id}
                onClick={() => onSaleClick(sale)}
                accent={documentRowAccent(sale.status, due)}
              >
                <TableCell className="py-3.5">
                  <EntityCell name={customer} secondary={saleRef(sale)} meta={meta} />
                </TableCell>
                <TableCell className="py-3.5">
                  <StatusDot status={sale.status} label={statusLabel} />
                </TableCell>
                <TableCell className="py-3.5">
                  <SourceLabel source={sourceKey} label={sourceLabel} />
                </TableCell>
                <TableCell className="py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                  {formatSaleDate(sale.saleDate)}
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
                  <div className="flex justify-end gap-0.5">
                      {due > 0 && !cancelled && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-600 hover:text-amber-700 dark:text-amber-400"
                              onClick={() => onRegisterPayment(sale)}
                            >
                              <CreditCard className="h-4 w-4" />
                              <span className="sr-only">{t("sales.table.registerPayment") || "Register payment"}</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t("sales.table.registerPayment") || "Register payment"}</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                            onClick={() => onPrintSale(sale)}
                          >
                            <Printer className="h-4 w-4" />
                            <span className="sr-only">{t("sales.table.print") || "Print"}</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("sales.table.print") || "Print"}</TooltipContent>
                      </Tooltip>
                    </div>
                </TableCell>
              </DocumentListRow>
            )
          })}
        </TableBody>
        <tfoot>
          <tr className="bg-muted/30">
            <TableCell className="py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {t("sales.table.total") || "Total"}
            </TableCell>
            <TableCell colSpan={3} />
            <TableCell className="py-3">
              <MoneyCell
                amountLabel={formatCurrency(totalAmount)}
                dueLabel={totalAmountDue > 0 ? `${formatCurrency(totalAmountDue)} ${t("sales.table.due") || "due"}` : null}
              />
            </TableCell>
            <TableCell />
          </tr>
        </tfoot>
      </Table>
      <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {t("sales.table.showing") || "Showing"}{" "}
            <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + 1, totalSales)}</span>{" "}
            {t("sales.table.to") || "to"}{" "}
            <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + itemsPerPage, totalSales)}</span>{" "}
            {t("sales.table.of") || "of"}{" "}
            <span className="font-medium text-foreground">{totalSales}</span>{" "}
            {t("sales.table.sales") || "sales"}
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
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
      </div>
    </div>
    </TooltipProvider>
  )
}

export function SalesTableSkeleton() {
  return (
    <div className={documentListShellClassName()}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: 6 }).map((_, index) => (
              <DocumentListHead key={index} align={index >= 4 ? "right" : "left"}>
                <Skeleton className={cn("h-3 w-16", index >= 4 && "ml-auto")} />
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
              <TableCell className="py-3.5"><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell className="py-3.5">
                <div className="flex flex-col items-end gap-1.5">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </TableCell>
              <TableCell className="py-3.5">
                <div className="flex justify-end gap-1">
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
