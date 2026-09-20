"use client"

import { OrderWithRelations } from "../types"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Clock, Calendar, CheckCircle2, Ban, PlayCircle, MapPin, Store, Truck } from "@/app/components/ui/icons"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { cn } from "@/lib/utils"
import { useLocalization } from "@/app/context/LocalizationContext"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { formatScheduledFor, scheduledForClassName } from "@/app/orders/format-scheduled-for"
import { formatOrderProductSummary, formatOrderTime } from "@/app/orders/order-list-description"
import { OrderActionsMenu } from "@/app/orders/components/OrderActionsMenu"

interface OrdersKanbanProps {
  orders: OrderWithRelations[]
  onOrderClick: (order: OrderWithRelations) => void
  onUpdateOrderStatus: (orderId: string, newStatus: string) => void
  onPay: (order: OrderWithRelations) => void
  onPrintFull: (order: OrderWithRelations) => void | Promise<void>
  onPrintDelta: (order: OrderWithRelations) => void | Promise<void>
  onCancel: (order: OrderWithRelations) => void
  onSplit: (order: OrderWithRelations) => void
  canCancel?: boolean
  printingKey?: string | null
}

const ORDER_STATUSES = [
  { id: "pending", name: "Pending", icon: Clock },
  { id: "in_progress", name: "In Progress", icon: PlayCircle },
  { id: "completed", name: "Completed", icon: CheckCircle2 },
  { id: "cancelled", name: "Cancelled", icon: Ban },
]

const STATUS_BORDER_COLORS: Record<string, string> = {
  pending: "border-b-yellow-500 dark:border-b-yellow-600",
  in_progress: "border-b-blue-500 dark:border-b-blue-600",
  completed: "border-b-emerald-500 dark:border-b-emerald-600",
  cancelled: "border-b-rose-500 dark:border-b-rose-600",
}

const ORDER_SKELETON_CARD_COUNTS = [3, 2, 3, 1]

function OrderCardSkeleton() {
  return (
    <Card className="mb-3 border-border/60 shadow-sm">
      <CardContent className="p-3 space-y-2.5">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-4 w-12 shrink-0" />
        </div>
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-10" />
        </div>
      </CardContent>
    </Card>
  )
}

export function OrdersKanbanSkeleton() {
  return (
    <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden pb-4">
      <div className="flex gap-4 min-w-max px-4 md:px-8 items-stretch after:content-[''] after:w-px after:shrink-0">
        {ORDER_STATUSES.map((status, columnIndex) => (
          <div key={status.id} className="flex-shrink-0 w-72 md:w-80 flex flex-col min-h-[calc(100vh-220px)]">
            <div
              className={cn(
                "bg-background/80 backdrop-blur-sm rounded-t-lg p-3.5 border-b-[3px] border-x border-t shadow-sm",
                STATUS_BORDER_COLORS[status.id] || "border-b-primary/30"
              )}
            >
              <div className="flex items-center justify-between mb-0.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-5 w-6 rounded-full" />
              </div>
              <Skeleton className="h-3 w-14 mt-1" />
            </div>
            <div className="bg-muted/30 rounded-b-lg p-3 border-b border-x flex-1 flex flex-col min-h-[150px]">
              {Array.from({ length: ORDER_SKELETON_CARD_COUNTS[columnIndex] ?? 2 }).map((_, cardIndex) => (
                <OrderCardSkeleton key={cardIndex} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function OrdersKanban({
  orders,
  onOrderClick,
  onUpdateOrderStatus,
  onPay,
  onPrintFull,
  onPrintDelta,
  onCancel,
  onSplit,
  canCancel,
  printingKey,
}: OrdersKanbanProps) {
  const { t } = useLocalization()
  
  const formatCurrency = (amount: number | null, currency: string = 'USD') => {
    if (amount === null || amount === undefined) return "-"
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t('common.noDate') || "No date"
    return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50)
    }

    onUpdateOrderStatus(draggableId, destination.droppableId)
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex gap-4 min-w-max px-4 md:px-8 items-stretch after:content-[''] after:w-px after:shrink-0">
          {ORDER_STATUSES.map((status) => {
            const statusOrders = orders.filter(order => order.status === status.id)
            const totalAmount = statusOrders.reduce((sum, order) => sum + (order.total || 0), 0)
            const StatusIcon = status.icon
            
            return (
              <div key={status.id} className="flex-shrink-0 w-72 md:w-80 flex flex-col">
                <div 
                  className={cn(
                    "bg-background/80 backdrop-blur-sm rounded-t-lg p-3.5 border-b-[3px] border-x border-t shadow-sm sticky top-0 z-10 shrink-0",
                    STATUS_BORDER_COLORS[status.id] || "border-b-primary/30"
                  )}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-foreground/80 flex items-center gap-2">
                      <StatusIcon size={14} className="opacity-70" />
                      {t(`orders.status.${status.id}`) || status.name}
                    </h3>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-medium bg-secondary/50">
                      {statusOrders.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">
                    {/* Note: This total assumes mixed currencies are not prevalent or is just a rough estimate; could be improved if strict multi-currency is needed later */}
                    {formatCurrency(totalAmount)}
                  </p>
                </div>

                <Droppable droppableId={status.id}>
                  {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "bg-muted/30 rounded-b-lg p-3 border-b border-x flex flex-col transition-colors min-h-[150px]",
                          snapshot.isDraggingOver && "bg-muted/60 border-primary/20 shadow-inner"
                        )}
                      >
                      {statusOrders.length > 0 ? (
                        statusOrders.map((order, index) => {
                          const leadName = order.leads?.name;
                          const leadContact = order.leads?.email || order.leads?.phone;
                          const hasNewItems = order.sale_order_items?.some((item) => item.status === 'new') || false;
                          const scheduledLabel = formatScheduledFor(order.scheduled_for);
                          const description = formatOrderProductSummary(order.sale_order_items);
                          const createdTime = formatOrderTime(order.created_at);
                          const fulfillmentLabel =
                            order.fulfillment_method && order.fulfillment_method !== "none"
                              ? t(`orders.kanban.fulfillment.${order.fulfillment_method}`) || order.fulfillment_method
                              : null;
                          const FulfillmentIcon =
                            order.fulfillment_method === "ship"
                              ? Truck
                              : order.fulfillment_method === "pickup"
                                ? Store
                                : MapPin;

                          return (
                            <Draggable key={order.id} draggableId={order.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                >
                                  <Card 
                                    className={cn(
                                      "mb-3 cursor-pointer transition-all duration-200 border-border/60 hover:border-primary/40 relative group select-none",
                                      snapshot.isDragging ? "shadow-lg border-primary/50" : "shadow-sm hover:shadow-md",
                                      hasNewItems && "bg-amber-50/40 dark:bg-amber-500/5"
                                    )}
                                    onClick={() => onOrderClick(order)}
                                  >
                                    <OrderActionsMenu
                                      order={order}
                                      onOpen={onOrderClick}
                                      onPay={onPay}
                                      onPrintFull={onPrintFull}
                                      onPrintDelta={onPrintDelta}
                                      onCancel={onCancel}
                                      onSplit={onSplit}
                                      canCancel={canCancel}
                                      printingKey={printingKey}
                                      triggerClassName="absolute right-2 top-2 z-10 h-7 w-7 bg-background/90 opacity-100 shadow-sm transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 data-[state=open]:opacity-100"
                                    />
                                    <CardContent className="p-3 space-y-2.5">
                                      <div className="flex justify-between items-start gap-2 pr-7">
                                        <div className="min-w-0">
                                          <h3 className="text-sm font-semibold leading-tight group-hover:text-primary transition-colors truncate">
                                            {order.order_number}
                                          </h3>
                                        </div>
                                        <div className="flex flex-shrink-0 items-center gap-1.5">
                                          <span className="font-semibold text-[13px] text-foreground">
                                            {formatCurrency(order.total, order.currency)}
                                          </span>
                                          {order.sales?.status && (
                                            <span className={cn(
                                              "text-[11px] font-medium",
                                              order.sales.status !== 'cancelled' && Number(order.sales.amount_due || 0) === 0
                                                ? "text-emerald-700 dark:text-emerald-400"
                                                : "text-amber-700 dark:text-amber-400"
                                            )}>
                                              {order.sales.status !== 'cancelled' && Number(order.sales.amount_due || 0) === 0
                                                ? t('orders.kanban.paid')
                                                : t('orders.kanban.unpaid')}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {(leadName || leadContact) && (
                                        <p className="flex w-full min-w-0 items-center gap-1.5">
                                          {leadName && (
                                            <span className="truncate text-sm text-foreground">{leadName}</span>
                                          )}
                                          {leadName && leadContact && (
                                            <span className="shrink-0 text-muted-foreground/50">·</span>
                                          )}
                                          {leadContact && (
                                            <span className="truncate text-[11px] text-muted-foreground">{leadContact}</span>
                                          )}
                                        </p>
                                      )}

                                      {description && (
                                        <p className="w-full text-[11px] leading-snug text-muted-foreground line-clamp-2">
                                          {description}
                                        </p>
                                      )}

                                      <div className="space-y-1.5 border-t border-border/40 pt-2">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden text-[11px] text-muted-foreground">
                                            <Calendar className="h-3 w-3 opacity-70 flex-shrink-0" />
                                            <span className="whitespace-nowrap">{formatDate(order.created_at)}</span>
                                            {createdTime && (
                                              <>
                                                <span className="opacity-40">·</span>
                                                <span className="whitespace-nowrap">{createdTime}</span>
                                              </>
                                            )}
                                            {order.sales?.source && (
                                              <>
                                                <span className="opacity-40">·</span>
                                                <span className="truncate">
                                                  {order.sales.source === 'online' || order.sales.source === 'shop' || order.sales.source === 'marketplace'
                                                    ? t('orders.kanban.sourceOnline')
                                                    : t('orders.kanban.sourcePos')}
                                                </span>
                                              </>
                                            )}
                                          </div>
                                          {fulfillmentLabel && (
                                            <span
                                              aria-label={fulfillmentLabel}
                                              title={fulfillmentLabel}
                                              className="ml-auto shrink-0"
                                            >
                                              <FulfillmentIcon className="h-3.5 w-3.5" />
                                            </span>
                                          )}
                                        </div>
                                        {scheduledLabel && (
                                          <div
                                            className={cn(
                                              "flex items-center gap-1 text-[11px] font-medium",
                                              scheduledForClassName(order.scheduled_for)
                                            )}
                                          >
                                            <Clock className="h-3 w-3 shrink-0" />
                                            <span className="sr-only">{t("orders.kanban.scheduled") || "Scheduled"} </span>
                                            <span className="whitespace-nowrap">{scheduledLabel}</span>
                                          </div>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>
                              )}
                            </Draggable>
                          )
                        })
                      ) : (
                        <div className="flex-1 flex flex-col justify-center min-h-[160px] py-4">
                          <EmptyCard
                            icon={<Clock className="text-muted-foreground/40" size={24} />}
                            title={t('orders.kanban.empty') || "No orders"}
                            description={t('orders.kanban.emptyDescription') || "No orders in this status."}
                            variant="fancy"
                            showShadow={false}
                            className="bg-transparent border-none shadow-none"
                            contentClassName="min-h-[160px] pb-0 p-2" />
                        </div>
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </div>
    </DragDropContext>
  )
}
