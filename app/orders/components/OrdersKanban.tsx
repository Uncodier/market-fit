"use client"

import { OrderWithRelations } from "../types"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Clock, Calendar, CheckCircle2, Ban, PlayCircle } from "@/app/components/ui/icons"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { cn } from "@/lib/utils"
import { useLocalization } from "@/app/context/LocalizationContext"
import { EmptyCard } from "@/app/components/ui/empty-card"

interface OrdersKanbanProps {
  orders: OrderWithRelations[]
  onOrderClick: (order: OrderWithRelations) => void
  onUpdateOrderStatus: (orderId: string, newStatus: string) => void
}

const ORDER_STATUSES = [
  { id: "pending", name: "Pending", icon: Clock },
  { id: "in_progress", name: "In Progress", icon: PlayCircle },
  { id: "completed", name: "Completed", icon: CheckCircle2 },
  { id: "cancelled", name: "Cancelled", icon: Ban },
]

export function OrdersKanban({ orders, onOrderClick, onUpdateOrderStatus }: OrdersKanbanProps) {
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

    onUpdateOrderStatus(draggableId, destination.droppableId)
  }

  const statusBorderColors: Record<string, string> = {
    pending: "border-b-yellow-500 dark:border-b-yellow-600",
    in_progress: "border-b-blue-500 dark:border-b-blue-600",
    completed: "border-b-emerald-500 dark:border-b-emerald-600",
    cancelled: "border-b-rose-500 dark:border-b-rose-600",
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="overflow-x-auto pb-4 -mx-4 md:-mx-8">
        <div className="flex gap-4 min-w-fit px-4 md:px-8 min-h-[calc(100vh-220px)] items-stretch">
          {ORDER_STATUSES.map((status) => {
            const statusOrders = orders.filter(order => order.status === status.id)
            const totalAmount = statusOrders.reduce((sum, order) => sum + (order.total || 0), 0)
            const StatusIcon = status.icon
            
            return (
              <div key={status.id} className="flex-shrink-0 w-80 flex flex-col">
                <div 
                  className={cn(
                    "bg-background/80 backdrop-blur-sm rounded-t-lg p-3.5 border-b-[3px] border-x border-t shadow-sm sticky top-0 z-10",
                    statusBorderColors[status.id] || "border-b-primary/30"
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
                        "bg-muted/30 rounded-b-lg p-3 border-b border-x flex-1 flex flex-col min-h-[150px] transition-colors",
                        snapshot.isDraggingOver && "bg-muted/60 border-primary/20 shadow-inner"
                      )}
                    >
                      {statusOrders.length > 0 ? (
                        statusOrders.map((order, index) => {
                          const leadName = (order.leads as any)?.name || t('orders.kanban.unknownCustomer') || 'Unknown Customer';
                          const leadEmail = (order.leads as any)?.email;
                          const hasNewItems = order.sale_order_items?.some((item: any) => item.status === 'new') || false;

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
                                      "mb-3 cursor-pointer transition-all duration-200 border-border/60 hover:border-primary/40 relative group",
                                      snapshot.isDragging ? "shadow-lg border-primary/50" : "shadow-sm hover:shadow-md",
                                      hasNewItems && "bg-amber-50/40 dark:bg-amber-500/5"
                                    )}
                                    onClick={() => onOrderClick(order)}
                                  >
                                    <CardContent className="p-3 space-y-2.5">
                                      <div className="flex justify-between items-start gap-2">
                                        <div className="min-w-0">
                                          <h3 className="text-sm font-semibold leading-tight group-hover:text-primary transition-colors truncate">
                                            {order.order_number}
                                          </h3>
                                          <p className="text-sm text-foreground truncate mt-1">{leadName}</p>
                                          {leadEmail && (
                                            <p className="text-[11px] text-muted-foreground truncate">{leadEmail}</p>
                                          )}
                                        </div>
                                        <span className="font-semibold text-[13px] text-foreground flex-shrink-0">
                                          {formatCurrency(order.total, order.currency)}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0 flex-wrap">
                                          <Calendar className="h-3 w-3 opacity-70 flex-shrink-0" />
                                          <span className="whitespace-nowrap">{formatDate(order.created_at)}</span>
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
                                          {order.fulfillment_method && order.fulfillment_method !== 'none' && (
                                            <>
                                              <span className="opacity-40">·</span>
                                              <span className="truncate">
                                                {t(`orders.kanban.fulfillment.${order.fulfillment_method}`) || order.fulfillment_method}
                                              </span>
                                            </>
                                          )}
                                        </div>

                                        {order.sales?.status && (
                                          <span className={cn(
                                            "text-[11px] font-medium flex-shrink-0",
                                            (order.sales.status === 'completed' || order.sales.amount_due === 0)
                                              ? "text-emerald-700 dark:text-emerald-400"
                                              : "text-amber-700 dark:text-amber-400"
                                          )}>
                                            {(order.sales.status === 'completed' || order.sales.amount_due === 0)
                                              ? t('orders.kanban.paid')
                                              : t('orders.kanban.unpaid')}
                                          </span>
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
                            contentClassName="min-h-[160px] pb-0 p-2"
                          />
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
