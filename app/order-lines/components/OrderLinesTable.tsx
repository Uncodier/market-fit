"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ArrowRight, ListTodo, Loader2 } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Pagination } from "@/app/components/ui/pagination"
import { Skeleton } from "@/app/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table"
import {
  DocumentListHead,
  documentListShellClassName,
} from "@/app/components/documents/document-list"
import {
  nextOrderLineStatus,
  orderLineStatusLabel,
  type OrderLineActionStatus,
} from "../status"
import type { OrderLineAssignee, OrderLineRow } from "../types"
import { shouldTickOrderLineClock } from "../waiting-time"
import { OrderLineAssigneePicker } from "./OrderLineAssigneePicker"
import { OrderLineTableRow } from "./OrderLineTableRow"

interface OrderLinesTableProps {
  lines: OrderLineRow[]
  page: number
  pageSize: number
  totalCount: number
  searchQuery?: string
  locationNames: Record<string, string>
  updatingLineId?: string | null
  updatingOrderId?: string | null
  canUpdate: boolean
  assignees: OrderLineAssignee[]
  onPageChange: (page: number) => void
  onOrderClick: (line: OrderLineRow) => void
  onAdvanceOrder: (lines: OrderLineRow[]) => void
  onAssigneeChange: (
    lines: OrderLineRow[],
    assigneeId: string | null,
  ) => void
  onStatusChange: (
    line: OrderLineRow,
    status: OrderLineActionStatus,
  ) => void
}

export function OrderLinesTable({
  lines,
  page,
  pageSize,
  totalCount,
  searchQuery,
  locationNames,
  updatingLineId,
  updatingOrderId,
  canUpdate,
  assignees,
  onPageChange,
  onOrderClick,
  onAdvanceOrder,
  onAssigneeChange,
  onStatusChange,
}: OrderLinesTableProps) {
  const { t } = useLocalization()
  const totalPages = Math.ceil(totalCount / pageSize)
  const firstItemIndex = (page - 1) * pageSize
  const [now, setNow] = useState(() => Date.now())
  const orderGroups = useMemo(() => {
    const grouped = new Map<string, OrderLineRow[]>()
    for (const line of lines) {
      const existing = grouped.get(line.order.id)
      if (existing) existing.push(line)
      else grouped.set(line.order.id, [line])
    }
    return [...grouped.entries()].map(([orderId, orderLines]) => ({
      orderId,
      lines: orderLines,
    }))
  }, [lines])

  useEffect(() => {
    if (lines.length === 0) return
    const hasRunningTimer = lines.some((line) =>
      shouldTickOrderLineClock({
        lineStatus: line.status,
        orderStatus: line.order.status,
        shipmentStatus: line.shipment?.status,
      }),
    )
    if (!hasRunningTimer) return
    const interval = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(interval)
  }, [lines])

  if (lines.length === 0) {
    return (
      <EmptyCard
        icon={<ListTodo size={24} className="text-muted-foreground" />}
        title={t("orderLines.empty.title")}
        description={
          searchQuery
            ? t("orderLines.empty.searchDescription")
            : t("orderLines.empty.description")
        }
      />
    )
  }

  return (
    <div className={documentListShellClassName("bg-muted/30")}>
      <Table className="min-w-[900px]">
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[35%]">
              {t("orderLines.table.item")}
            </DocumentListHead>
            <DocumentListHead className="w-[13%]">
              {t("orderLines.table.status")}
            </DocumentListHead>
            <DocumentListHead className="w-[18%]">
              {t("orderLines.table.timing")}
            </DocumentListHead>
            <DocumentListHead className="w-[16%]">
              {t("orderLines.table.employee")}
            </DocumentListHead>
            <DocumentListHead className="w-[18%]" align="right">
              {t("orderLines.table.actions")}
            </DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orderGroups.map((group) => {
            const order = group.lines[0].order
            const customer =
              order.customer?.name || t("orders.kanban.unknownCustomer")
            const location = order.originLocationId
              ? locationNames[order.originLocationId]
              : null
            const fulfillment = order.fulfillmentMethod
              ? order.fulfillmentMethod.replaceAll("_", " ")
              : null
            const itemCount = group.lines.length
            const nextStatuses = [
              ...new Set(
                group.lines
                  .map((line) => nextOrderLineStatus(line.status))
                  .filter(
                    (
                      status,
                    ): status is Exclude<
                      OrderLineActionStatus,
                      "cancelled"
                    > => status !== null,
                  ),
              ),
            ]
            const commonNextStatus =
              nextStatuses.length === 1 ? nextStatuses[0] : null
            const canAdvance = nextStatuses.length > 0
            const groupAssigneeValues = new Set(
              group.lines.map((line) => line.assigneeId || "unassigned"),
            )
            const commonAssigneeValue =
              groupAssigneeValues.size === 1
                ? [...groupAssigneeValues][0]
                : undefined
            const commonAssigneeId =
              commonAssigneeValue === "unassigned"
                ? null
                : commonAssigneeValue
            const groupUpdating = updatingOrderId === group.orderId

            return (
              <Fragment key={group.orderId}>
                {group.lines.map((line) => (
                  <OrderLineTableRow
                    key={line.id}
                    line={line}
                    now={now}
                    updating={
                      groupUpdating || updatingLineId === line.id
                    }
                    canUpdate={canUpdate}
                    assignees={assignees}
                    onOpen={() => onOrderClick(line)}
                    onAssigneeChange={(selectedLine, assigneeId) =>
                      onAssigneeChange([selectedLine], assigneeId)
                    }
                    onStatusChange={onStatusChange}
                  />
                ))}

                <TableRow className="border-b border-border/60 bg-muted/60 hover:bg-muted/70">
                  <TableCell colSpan={5} className="px-5 py-3">
                    <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="font-medium uppercase tracking-[0.08em] text-muted-foreground">
                          {t("orderLines.table.order")}
                        </span>
                        <button
                          type="button"
                          className="font-semibold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => onOrderClick(group.lines[0])}
                        >
                          #{order.orderNumber || order.id}
                        </button>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-medium text-foreground">
                          {customer}
                        </span>
                        {location ? (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">
                              {location}
                            </span>
                          </>
                        ) : null}
                        <span>
                          · {itemCount}{" "}
                          {itemCount === 1
                            ? t("orderLines.table.itemCount")
                            : t("orderLines.table.itemsCount")}
                        </span>
                        {fulfillment ? (
                          <span className="capitalize">{fulfillment}</span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                          {t("orderLines.bulk.title")}
                        </span>
                        <OrderLineAssigneePicker
                          members={assignees}
                          value={commonAssigneeId}
                          bulk
                          disabled={!canUpdate || groupUpdating}
                          loading={groupUpdating}
                          onValueChange={(assigneeId) =>
                            onAssigneeChange(group.lines, assigneeId)
                          }
                        />
                        {canAdvance ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 rounded-full px-3 text-xs"
                            disabled={!canUpdate || groupUpdating}
                            onClick={() => onAdvanceOrder(group.lines)}
                          >
                            {groupUpdating ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ArrowRight className="h-3.5 w-3.5" />
                            )}
                            {commonNextStatus
                              ? `${t("orderLines.bulk.markAll")} ${orderLineStatusLabel(commonNextStatus)}`
                              : t("orderLines.bulk.advanceAll")}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              </Fragment>
            )
          })}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {Math.min(firstItemIndex + 1, totalCount)}
          </span>
          {" – "}
          <span className="font-medium text-foreground">
            {Math.min(firstItemIndex + lines.length, totalCount)}
          </span>
          {" of "}
          <span className="font-medium text-foreground">{totalCount}</span>{" "}
          {totalCount === 1
            ? t("orderLines.table.itemCount")
            : t("orderLines.table.itemsCount")}
        </p>
        {totalPages > 1 ? (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        ) : null}
      </div>
    </div>
  )
}

export function OrderLinesTableSkeleton() {
  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: 5 }).map((_, index) => (
              <DocumentListHead key={index} align={index === 4 ? "right" : "left"}>
                <Skeleton className="h-3 w-16" />
              </DocumentListHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 7 }).map((_, index) => (
            <TableRow key={index} className="hover:bg-transparent">
              <TableCell className="py-3.5">
                <Skeleton className="h-9 w-48" />
              </TableCell>
              <TableCell className="py-3.5">
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell className="py-3.5">
                <Skeleton className="h-8 w-24" />
              </TableCell>
              <TableCell className="py-3.5">
                <Skeleton className="h-8 w-28" />
              </TableCell>
              <TableCell className="py-3.5">
                <Skeleton className="ml-auto h-8 w-60" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
