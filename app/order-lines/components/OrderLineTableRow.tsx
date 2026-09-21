"use client"

import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import { format } from "date-fns"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  Ban,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  PlayCircle,
  RotateCcw,
} from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { TableCell, TableRow } from "@/app/components/ui/table"
import { StatusDot } from "@/app/components/documents/document-list"
import { parseItemName } from "@/app/orders/components/order-invoice-helpers"
import { cn } from "@/lib/utils"
import {
  nextOrderLineStatus,
  orderLineStatusLabel,
  type OrderLineActionStatus,
} from "../status"
import type { OrderLineAssignee, OrderLineRow } from "../types"
import {
  formatOrderLineDuration,
  isPendingOrderLine,
  isProductionOrderLine,
} from "../waiting-time"
import { OrderLineAssigneePicker } from "./OrderLineAssigneePicker"

interface OrderLineTableRowProps {
  line: OrderLineRow
  now: number
  updating: boolean
  canUpdate: boolean
  assignees: OrderLineAssignee[]
  onOpen: () => void
  onAssigneeChange: (
    line: OrderLineRow,
    assigneeId: string | null,
  ) => void
  onStatusChange: (
    line: OrderLineRow,
    status: OrderLineActionStatus,
  ) => void
}

const NEXT_STATUS_ACTIONS: Record<
  Exclude<OrderLineActionStatus, "cancelled">,
  {
    label: string
    Icon: typeof PlayCircle
  }
> = {
  preparing: { label: "In Progress", Icon: PlayCircle },
  completed: { label: "Ready", Icon: CheckCircle2 },
  returned: { label: "Returned", Icon: RotateCcw },
}

const SWIPE_CANCEL_THRESHOLD = 80

function translatedStatus(
  t: (key: string) => string,
  status: string,
): string {
  const key = `orderLines.status.${status}`
  const translated = t(key)
  return translated === key ? orderLineStatusLabel(status) : translated
}

function OrderLineNextAction({
  line,
  updating,
  canUpdate,
  onStatusChange,
}: Pick<
  OrderLineTableRowProps,
  "line" | "updating" | "canUpdate" | "onStatusChange"
>) {
  const nextStatus = nextOrderLineStatus(line.status)
  if (!nextStatus) {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  const { label, Icon } = NEXT_STATUS_ACTIONS[nextStatus]
  const accessibleLabel = `Mark ${line.name} in order #${line.order.orderNumber || line.order.id} as ${label.toLowerCase()}`

  return (
    <div
      className="flex min-w-max items-center justify-end"
      onClick={(event) => event.stopPropagation()}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 min-w-[118px] gap-1.5 rounded-full px-3 text-xs"
        aria-label={accessibleLabel}
        title={accessibleLabel}
        data-permission="update"
        disabled={updating || !canUpdate}
        onClick={() => onStatusChange(line, nextStatus)}
      >
        {updating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Icon className="h-3.5 w-3.5" />
        )}
        {label}
      </Button>
    </div>
  )
}

function SwipeableOrderLineRow({
  line,
  updating,
  canUpdate,
  onOpen,
  onCancel,
  children,
}: {
  line: OrderLineRow
  updating: boolean
  canUpdate: boolean
  onOpen: () => void
  onCancel: () => void
  children: (showCancelIntent: boolean) => ReactNode
}) {
  const [offset, setOffset] = useState(0)
  const pointerIdRef = useRef<number | null>(null)
  const startXRef = useRef(0)
  const offsetRef = useRef(0)
  const suppressClickRef = useRef(false)
  const canCancel =
    canUpdate && line.status !== "cancelled" && line.status !== "returned"
  const showCancelIntent = canCancel && offset < -24

  const resetSwipe = () => {
    pointerIdRef.current = null
    offsetRef.current = 0
    setOffset(0)
  }

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLTableRowElement>,
  ) => {
    if (
      !canCancel ||
      updating ||
      (event.target as HTMLElement).closest("button")
    ) {
      return
    }
    pointerIdRef.current = event.pointerId
    startXRef.current = event.clientX
    suppressClickRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (
    event: ReactPointerEvent<HTMLTableRowElement>,
  ) => {
    if (pointerIdRef.current !== event.pointerId) return
    const nextOffset = Math.min(
      0,
      Math.max(-120, event.clientX - startXRef.current),
    )
    if (nextOffset < -8) suppressClickRef.current = true
    offsetRef.current = nextOffset
    setOffset(nextOffset)
  }

  const handlePointerUp = (
    event: ReactPointerEvent<HTMLTableRowElement>,
  ) => {
    if (pointerIdRef.current !== event.pointerId) return
    const shouldCancel = offsetRef.current <= -SWIPE_CANCEL_THRESHOLD
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    resetSwipe()
    if (shouldCancel) onCancel()
  }

  const pending = isPendingOrderLine(line.status)
  return (
    <TableRow
      tabIndex={0}
      aria-label={
        canCancel
          ? `${line.name}. Swipe left or press Delete to cancel.`
          : line.name
      }
      onClick={(event) => {
        if (
          (event.target as HTMLElement).closest(
            "button, a, input, select, [role='menuitem'], [data-row-interactive]",
          )
        ) {
          return
        }
        if (suppressClickRef.current) {
          suppressClickRef.current = false
          return
        }
        onOpen()
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (
          canCancel &&
          !updating &&
          (event.key === "Delete" || event.key === "Backspace")
        ) {
          event.preventDefault()
          onCancel()
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen()
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={resetSwipe}
      style={{ transform: `translateX(${offset}px)` }}
      className={cn(
        "group cursor-pointer touch-pan-y border-b border-border/50 bg-card transition-[transform,background-color] hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        pending &&
          "shadow-[inset_3px_0_0_0] shadow-amber-400 dark:shadow-amber-500",
        line.status === "cancelled" && "opacity-70",
        showCancelIntent && "bg-destructive/10",
      )}
    >
      {children(showCancelIntent)}
    </TableRow>
  )
}

export function OrderLineTableRow({
  line,
  now,
  updating,
  canUpdate,
  assignees,
  onOpen,
  onAssigneeChange,
  onStatusChange,
}: OrderLineTableRowProps) {
  const { t } = useLocalization()
  const parentName =
    typeof line.metadata?.parent_name === "string"
      ? line.metadata.parent_name
      : null
  const parsedName = parseItemName(line.name, parentName)
  const itemName = parsedName.parentName || line.name
  const itemDescription = parsedName.parentName
    ? parsedName.variantName
    : line.description
  const modifiers = line.modifiers || []
  const pending = isPendingOrderLine(line.status)
  const production = isProductionOrderLine(line.status)
  const parsedScheduledAt = line.order.scheduledFor
    ? new Date(line.order.scheduledFor)
    : null
  const scheduledAt =
    parsedScheduledAt && Number.isFinite(parsedScheduledAt.getTime())
      ? parsedScheduledAt
      : null
  const showScheduled =
    Boolean(scheduledAt) &&
    line.status !== "cancelled" &&
    !["cancelled", "completed"].includes(line.order.status || "")
  const scheduledTimestamp = scheduledAt?.getTime() || null
  const isUpcomingSchedule =
    showScheduled &&
    pending &&
    scheduledTimestamp !== null &&
    scheduledTimestamp > now
  const waitingStartedAt =
    scheduledTimestamp !== null && scheduledTimestamp <= now
      ? line.order.scheduledFor!
      : line.sentAt || line.createdAt
  const productionStartedAt =
    line.inProgressAt || waitingStartedAt
  const orderCompletedAt =
    line.order.status === "completed" ? line.order.updatedAt : null
  const productionEndedAt =
    line.readyAt || line.completedAt || orderCompletedAt
  const shipment = line.shipment
  const deliveryStartedAt = shipment?.shippedAt || null
  const shipmentFinished =
    shipment?.status === "delivered" ||
    shipment?.status === "cancelled" ||
    shipment?.status === "failed" ||
    Boolean(orderCompletedAt)
  const deliveryEndedAt = shipmentFinished
    ? line.deliveredAt ||
      shipment?.deliveredAt ||
      orderCompletedAt ||
      shipment?.updatedAt ||
      now
    : now
  const productionSummary =
    line.inProgressAt && productionEndedAt
      ? `${t("orderLines.table.production")} ${formatOrderLineDuration(
          line.inProgressAt,
          new Date(productionEndedAt).getTime(),
        )}`
      : null
  const timing = isUpcomingSchedule
    ? {
        label: t("orderLines.table.scheduled"),
        duration: `${t("orderLines.table.startsIn")} ${formatOrderLineDuration(
          new Date(now).toISOString(),
          scheduledTimestamp!,
        )}`,
        detail: format(scheduledAt!, "MMM d, h:mm a"),
        className: "text-violet-700 dark:text-violet-400",
        secondary: null,
      }
    : shipment && deliveryStartedAt
    ? {
        label: t("orderLines.table.delivery"),
        duration: formatOrderLineDuration(
          deliveryStartedAt,
          typeof deliveryEndedAt === "number"
            ? deliveryEndedAt
            : new Date(deliveryEndedAt).getTime(),
        ),
        detail: line.deliveredAt || shipment.deliveredAt
          ? `${t("orderLines.table.delivered")} ${format(new Date(line.deliveredAt || shipment.deliveredAt!), "MMM d, h:mm a")}`
          : orderCompletedAt
            ? `${t("orderLines.table.completedAt")} ${format(new Date(orderCompletedAt), "MMM d, h:mm a")}`
          : shipment.estimatedDeliveryAt
            ? `${t("orderLines.table.eta")} ${format(new Date(shipment.estimatedDeliveryAt), "MMM d, h:mm a")}`
            : `${t("orderLines.table.since")} ${format(new Date(deliveryStartedAt), "h:mm a")}`,
        className: "text-sky-700 dark:text-sky-400",
        secondary: productionSummary,
      }
    : (!pending && production) || productionEndedAt
      ? {
          label: t("orderLines.table.production"),
          duration: formatOrderLineDuration(
            productionStartedAt,
            productionEndedAt
              ? new Date(productionEndedAt).getTime()
              : now,
          ),
          detail: productionEndedAt
            ? `${t("orderLines.table.readyAt")} ${format(new Date(productionEndedAt), "MMM d, h:mm a")}`
            : `${t("orderLines.table.inProgressAt")} ${format(new Date(productionStartedAt), "h:mm a")}`,
          className: productionEndedAt
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-blue-700 dark:text-blue-400",
          secondary: null,
        }
      : pending
        ? {
            label: t("orderLines.table.waiting"),
            duration: formatOrderLineDuration(waitingStartedAt, now),
            detail: `${t("orderLines.table.since")} ${format(new Date(waitingStartedAt), "h:mm a")}`,
            className: "text-amber-700 dark:text-amber-400",
            secondary: null,
          }
        : null

  return (
    <SwipeableOrderLineRow
      line={line}
      updating={updating}
      canUpdate={canUpdate}
      onOpen={onOpen}
      onCancel={() => onStatusChange(line, "cancelled")}
    >
      {(showCancelIntent) => (
        <>
          <TableCell className="py-4 pl-5">
            <div className="min-w-0 space-y-1">
              <p className="truncate text-base font-semibold leading-tight text-foreground">
                {itemName}
              </p>
              {line.unitCount > 1 ? (
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {t("orderLines.table.unit")} {line.unitIndex}{" "}
                  {t("orderLines.table.of")} {line.unitCount}
                </p>
              ) : null}
              {itemDescription ? (
                <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {itemDescription}
                </p>
              ) : null}
              {modifiers.length > 0 ? (
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  {modifiers.map((modifier) => (
                    <span key={modifier.id}>+ {modifier.name}</span>
                  ))}
                </div>
              ) : null}
              {showScheduled && scheduledAt ? (
                <p className="flex items-center gap-1 text-xs font-medium text-violet-700 dark:text-violet-400">
                  <Calendar className="h-3.5 w-3.5" />
                  {t("orderLines.table.scheduled")}{" "}
                  {format(scheduledAt, "MMM d, h:mm a")}
                </p>
              ) : null}
            </div>
          </TableCell>
          <TableCell className="py-4">
            <StatusDot
              status={line.status}
              label={translatedStatus(t, line.status)}
            />
          </TableCell>
          <TableCell className="py-4">
            {timing ? (
              <>
                <div
                  className={cn(
                    "flex items-center gap-1 whitespace-nowrap text-sm font-semibold",
                    timing.className,
                  )}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {timing.label} {timing.duration}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {timing.detail}
                </div>
                {timing.secondary ? (
                  <div className="text-[11px] text-muted-foreground/80">
                    {timing.secondary}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="whitespace-nowrap text-sm text-muted-foreground">
                  {format(new Date(line.createdAt), "MMM d, yyyy")}
                </div>
                <div className="text-[11px] text-muted-foreground/80">
                  {format(new Date(line.createdAt), "h:mm a")}
                </div>
              </>
            )}
          </TableCell>
          <TableCell className="py-4">
            <OrderLineAssigneePicker
              members={assignees}
              value={line.assigneeId}
              disabled={!canUpdate || updating}
              loading={updating}
              onValueChange={(assigneeId) =>
                onAssigneeChange(line, assigneeId)
              }
            />
          </TableCell>
          <TableCell className="py-4 text-right">
            {showCancelIntent ? (
              <div className="flex items-center justify-end gap-1.5 text-sm font-semibold text-destructive">
                <Ban className="h-4 w-4" />
                {t("orderLines.actions.releaseToCancel")}
              </div>
            ) : (
              <OrderLineNextAction
                line={line}
                updating={updating}
                canUpdate={canUpdate}
                onStatusChange={onStatusChange}
              />
            )}
          </TableCell>
        </>
      )}
    </SwipeableOrderLineRow>
  )
}
