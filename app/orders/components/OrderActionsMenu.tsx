"use client"

import { Button } from "@/app/components/ui/button"
import {
  Ban,
  CreditCard,
  ExternalLink,
  MoreVertical,
  Printer,
  RotateCw,
  SplitSquareHorizontal,
} from "@/app/components/ui/icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import type { OrderWithRelations } from "@/app/orders/types"
import { isPosOpenOrder } from "@/app/pos/open-orders"
import { cn } from "@/lib/utils"

type OrderActionsMenuProps = {
  order: OrderWithRelations
  triggerClassName?: string
  canCancel?: boolean
  printingKey?: string | null
  onOpen: (order: OrderWithRelations) => void
  onPay: (order: OrderWithRelations) => void
  onPrintFull: (order: OrderWithRelations) => void | Promise<void>
  onPrintDelta: (order: OrderWithRelations) => void | Promise<void>
  onCancel: (order: OrderWithRelations) => void
  onSplit: (order: OrderWithRelations) => void
}

export function OrderActionsMenu({
  order,
  triggerClassName,
  canCancel = true,
  printingKey,
  onOpen,
  onPay,
  onPrintFull,
  onPrintDelta,
  onCancel,
  onSplit,
}: OrderActionsMenuProps) {
  const orderIsOpen = Boolean(order.sale_id) && isPosOpenOrder(order)
  const amount = Number(order.sales?.amount ?? order.total) || 0
  const amountDue = Number(order.sales?.amount_due) || 0
  const hasPriorPayments =
    Boolean(order.sales?.payments?.some((payment) => Number(payment.amount) > 0)) ||
    amountDue + 0.009 < amount
  const hasPrintableItems = Boolean(
    order.sale_order_items?.some(
      (item) =>
        !item.parent_sale_order_item_id &&
        item.status !== "draft" &&
        item.status !== "cancelled",
    ),
  )
  const isPrinting = Boolean(
    printingKey &&
      (printingKey === `${order.id}:full` ||
        printingKey === `${order.id}:delta`),
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Order actions"
          title="Order actions"
          disabled={isPrinting}
          className={cn("h-8 w-8", triggerClassName)}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-48"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => onOpen(order)}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Open order
        </DropdownMenuItem>

        {orderIsOpen && amountDue > 0.009 ? (
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => onPay(order)}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Pay
          </DropdownMenuItem>
        ) : null}

        {orderIsOpen && !hasPriorPayments ? (
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => onSplit(order)}
          >
            <SplitSquareHorizontal className="mr-2 h-4 w-4" />
            Split order
          </DropdownMenuItem>
        ) : null}

        {hasPrintableItems ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => void onPrintFull(order)}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print full order
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => void onPrintDelta(order)}
            >
              <RotateCw className="mr-2 h-4 w-4" />
              Print changes
            </DropdownMenuItem>
          </>
        ) : null}

        {canCancel && order.status !== "cancelled" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onSelect={() => onCancel(order)}
            >
              <Ban className="mr-2 h-4 w-4" />
              Cancel order
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
