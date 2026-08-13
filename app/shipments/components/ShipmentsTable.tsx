"use client"

import React from "react"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Pagination } from "@/app/components/ui/pagination"
import { ExternalLink, Send } from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { useLocalization } from "@/app/context/LocalizationContext"
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/app/lib/formatters"
import { ShipmentWithRelations } from "@/app/shipments/types"
import {
  DocumentListHead,
  DocumentListRow,
  EntityAvatar,
  EntityCell,
  MoneyCell,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

function shipmentAccent(status: string, hasTracking: boolean): "due" | "cancelled" | "none" {
  if (status === "cancelled" || status === "failed") return "cancelled"
  if (status === "pending" || status === "preparing") return "due"
  if ((status === "shipped" || status === "in_transit") && !hasTracking) return "due"
  return "none"
}

interface ShipmentsTableProps {
  shipments: ShipmentWithRelations[]
  page: number
  pageSize: number
  totalCount: number
  searchQuery?: string
  onPageChange: (page: number) => void
  onShipmentClick: (shipment: ShipmentWithRelations) => void
}

export function ShipmentsTable({
  shipments,
  page,
  pageSize,
  totalCount,
  searchQuery,
  onPageChange,
  onShipmentClick,
}: ShipmentsTableProps) {
  const { t } = useLocalization()
  const totalPages = Math.ceil(totalCount / pageSize)
  const indexOfFirstItem = (page - 1) * pageSize
  const pageTotal = shipments.reduce((sum, shipment) => sum + (Number(shipment.sale_orders?.total) || 0), 0)

  if (shipments.length === 0) {
    return (
      <EmptyCard
        icon={<Send className="h-6 w-6 text-muted-foreground" />}
        title={t("shipments.empty.title") || "No shipments found"}
        description={
          t("shipments.empty.description") ||
          (searchQuery
            ? "No shipments match your search criteria."
            : "Shipments will appear here once an order is created with shipping.")
        }
      />
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={documentListShellClassName()}>
        <Table className="min-w-[920px]">
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <TableRow className="hover:bg-transparent">
              <DocumentListHead className="w-[26%]">{t("shipments.table.customer") || "Customer"}</DocumentListHead>
              <DocumentListHead className="w-[12%]">{t("shipments.table.status") || "Status"}</DocumentListHead>
              <DocumentListHead className="w-[16%]">{t("shipments.table.tracking") || "Tracking"}</DocumentListHead>
              <DocumentListHead className="w-[14%]">{t("shipments.table.courier") || "Courier"}</DocumentListHead>
              <DocumentListHead className="w-[12%]">{t("shipments.table.created") || "Created"}</DocumentListHead>
              <DocumentListHead className="w-[12%]" align="right">{t("shipments.table.total") || "Total"}</DocumentListHead>
              <DocumentListHead className="w-[8%]" align="right">{t("shipments.table.actions") || "Actions"}</DocumentListHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shipments.map((shipment) => {
              const customer = shipment.leads?.name || t("shipments.table.unknownCustomer") || "Unknown Customer"
              const orderNumber = shipment.sale_orders?.order_number
              const origin = shipment.locations?.name
                ? `${t("shipments.table.from") || "From"} ${shipment.locations.name}`
                : null
              const hasTracking = Boolean(shipment.tracking_number)
              const cancelled = shipment.status === "cancelled" || shipment.status === "failed"
              const amount = Number(shipment.sale_orders?.total) || 0
              const statusLabel =
                t(`shipments.status.${shipment.status}`) || String(shipment.status).replace(/_/g, " ")

              return (
                <DocumentListRow
                  key={shipment.id}
                  onClick={() => onShipmentClick(shipment)}
                  accent={shipmentAccent(shipment.status, hasTracking)}
                >
                  <TableCell className="py-3.5">
                    <EntityCell
                      name={customer}
                      secondary={orderNumber ? `#${orderNumber}` : t("shipments.table.unknownOrder") || "Unknown Order"}
                      meta={origin}
                    />
                  </TableCell>
                  <TableCell className="py-3.5">
                    <StatusDot status={shipment.status} label={statusLabel} />
                  </TableCell>
                  <TableCell className="py-3.5">
                    {hasTracking ? (
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm leading-tight text-foreground">
                          {shipment.tracking_number}
                        </p>
                        {shipment.carrier ? (
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{shipment.carrier}</p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {t("shipments.table.notAssigned") || "Not assigned"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-3.5">
                    {shipment.assignee_profile?.name ? (
                      <div className="flex min-w-0 items-center gap-2">
                        <EntityAvatar name={shipment.assignee_profile.name} className="h-7 w-7 text-[10px]" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium leading-tight">
                            {shipment.assignee_profile.name}
                          </p>
                          {shipment.last_located_at ? (
                            <p className="truncate text-[11px] text-muted-foreground">
                              {formatDistanceToNow(new Date(shipment.last_located_at), { addSuffix: true })}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {t("shipments.unassigned") || "Unassigned"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <div className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(shipment.created_at), "MMM d, yyyy")}
                    </div>
                    <div className="text-[11px] text-muted-foreground/80">
                      {format(new Date(shipment.created_at), "h:mm a")}
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <MoneyCell
                      amountLabel={amount > 0 ? formatCurrency(amount) : "—"}
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
                          onClick={() => onShipmentClick(shipment)}
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
                {t("shipments.table.total") || "Total"}
              </TableCell>
              <TableCell colSpan={4} />
              <TableCell className="py-3">
                <MoneyCell amountLabel={formatCurrency(pageTotal)} />
              </TableCell>
              <TableCell />
            </tr>
          </tfoot>
        </Table>
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + 1, totalCount)}</span>
            {" – "}
            <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + shipments.length, totalCount)}</span>
            {" of "}
            <span className="font-medium text-foreground">{totalCount}</span>
            {" "}
            {t("shipments.table.shipments") || "shipments"}
          </p>
          {totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

export function ShipmentsTableSkeleton() {
  return (
    <div className={documentListShellClassName()}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: 7 }).map((_, index) => (
              <DocumentListHead key={index} align={index >= 5 ? "right" : "left"}>
                <Skeleton className={cn("h-3 w-16", index >= 5 && "ml-auto")} />
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
              <TableCell className="py-3.5"><Skeleton className="h-4 w-28" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell className="py-3.5">
                <div className="flex flex-col items-end gap-1.5">
                  <Skeleton className="h-5 w-16" />
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
