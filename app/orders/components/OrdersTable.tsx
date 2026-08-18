"use client"

import React from "react"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Pagination } from "@/app/components/ui/pagination"
import { ExternalLink, ListOrdered } from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { useLocalization } from "@/app/context/LocalizationContext"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/app/lib/formatters"
import { OrderWithRelations } from "@/app/orders/types"
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

interface OrdersTableProps {
  orders: OrderWithRelations[]
  page: number
  pageSize: number
  totalCount: number
  searchQuery?: string
  onPageChange: (page: number) => void
  onOrderClick: (order: OrderWithRelations) => void
}

export function OrdersTable({
  orders,
  page,
  pageSize,
  totalCount,
  searchQuery,
  onPageChange,
  onOrderClick,
}: OrdersTableProps) {
  const { t } = useLocalization()
  const totalPages = Math.ceil(totalCount / pageSize)
  const indexOfFirstItem = (page - 1) * pageSize
  const pageTotal = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0)

  if (orders.length === 0) {
    return (
      <EmptyCard
        icon={<ListOrdered size={24} className="text-muted-foreground" />}
        title={t("orders.empty.title") || "No orders found"}
        description={
          t("orders.empty.description") ||
          (searchQuery
            ? "No orders match your search criteria."
            : "Orders will appear here once a checkout is completed.")
        }
      />
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={documentListShellClassName()}>
        <Table className="min-w-[860px]">
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <TableRow className="hover:bg-transparent">
              <DocumentListHead className="w-[32%]">{t("orders.table.customer") || "Customer"}</DocumentListHead>
              <DocumentListHead className="w-[14%]">{t("orders.table.status") || "Status"}</DocumentListHead>
              <DocumentListHead className="w-[12%]">{t("orders.table.source") || "Source"}</DocumentListHead>
              <DocumentListHead className="w-[16%]">{t("orders.table.created") || "Created"}</DocumentListHead>
              <DocumentListHead className="w-[16%]" align="right">{t("orders.table.total") || "Total"}</DocumentListHead>
              <DocumentListHead className="w-[10%]" align="right">{t("orders.table.actions") || "Actions"}</DocumentListHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const customer = order.leads?.name || t("orders.kanban.unknownCustomer") || "Unknown Customer"
              const sourceKey = normalizeSource(order.sales?.source)
              const sourceLabel =
                sourceKey === "pos"
                  ? t("orders.kanban.sourcePos") || "POS"
                  : t("orders.kanban.sourceOnline") || "Online"
              const amount = Number(order.total) || 0
              const due = Number(order.sales?.amount_due) || 0
              const cancelled = order.sales?.status === "cancelled"
              const unpaid = !cancelled && due > 0
              const hasNewItems = order.sale_order_items?.some((item: { status?: string }) => item.status === "new") || false
              const fulfillment =
                order.fulfillment_method && order.fulfillment_method !== "none"
                  ? t(`orders.kanban.fulfillment.${order.fulfillment_method}`) || order.fulfillment_method
                  : null
              const meta = [fulfillment, hasNewItems ? (t("orders.kanban.newItems") || "New items") : null]
                .filter(Boolean)
                .join(" · ") || null
              const statusLabel = t(`orders.status.${order.status}`) || String(order.status).replace("_", " ")
              const currency = order.currency || "USD"

              return (
                <DocumentListRow
                  key={order.id}
                  onClick={() => onOrderClick(order)}
                  accent={hasNewItems && !cancelled ? "due" : documentRowAccent(order.status, due)}
                >
                  <TableCell className="py-3.5">
                    <EntityCell
                      name={customer}
                      secondary={order.order_number ? `#${order.order_number}` : null}
                      meta={meta || order.leads?.email || null}
                    />
                  </TableCell>
                  <TableCell className="py-3.5">
                    <StatusDot status={order.status} label={statusLabel} />
                  </TableCell>
                  <TableCell className="py-3.5">
                    <SourceLabel source={sourceKey} label={sourceLabel} />
                  </TableCell>
                  <TableCell className="py-3.5">
                    <div className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(order.created_at), "MMM d, yyyy")}
                    </div>
                    <div className="text-[11px] text-muted-foreground/80">
                      {format(new Date(order.created_at), "h:mm a")}
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <MoneyCell
                      amountLabel={formatCurrency(amount, currency)}
                      dueLabel={
                        unpaid
                          ? `${formatCurrency(due, currency)} ${t("orders.table.due") || "due"}`
                          : null
                      }
                      paidLabel={!unpaid && !cancelled && order.sales ? t("orders.kanban.paid") || "Paid" : null}
                      cancelled={cancelled}
                      paidRatio={amount > 0 ? Math.max(0, (amount - due) / amount) : 1}
                    />
                  </TableCell>
                  <TableCell className="py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => onOrderClick(order)}
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
                {t("orders.table.total") || "Total"}
              </TableCell>
              <TableCell colSpan={3} />
              <TableCell className="py-3">
                <MoneyCell amountLabel={formatCurrency(pageTotal, orders[0]?.currency || "USD")} />
              </TableCell>
              <TableCell />
            </tr>
          </tfoot>
        </Table>
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + 1, totalCount)}</span>
            {" – "}
            <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + orders.length, totalCount)}</span>
            {" of "}
            <span className="font-medium text-foreground">{totalCount}</span>
            {" "}
            {t("orders.table.orders") || "orders"}
          </p>
          {totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

export function OrdersTableSkeleton() {
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
                  <Skeleton className="h-3 w-10" />
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
