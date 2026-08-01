"use client"

import { OrderWithRelations } from "../types"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Clock, Calendar, CheckCircle2, Ban, PlayCircle } from "@/app/components/ui/icons"
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar"
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
                                      snapshot.isDragging ? "shadow-lg border-primary/50" : "shadow-sm hover:shadow-md"
                                    )}
                                    onClick={() => onOrderClick(order)}
                                  >
                                    <CardContent className="p-3">
                                      <div className="flex flex-col gap-1.5">
                                        <div>
                                          <div className="flex justify-between items-start mb-1.5 gap-2">
                                            <h3 className="text-sm font-semibold leading-tight group-hover:text-primary transition-colors">
                                              {order.order_number}
                                            </h3>
                                            <span className="font-semibold text-[13px] text-foreground flex-shrink-0 mt-0.5">
                                              {formatCurrency(order.total, order.currency)}
                                            </span>
                                          </div>
                                          <div className="text-xs text-muted-foreground flex items-center gap-2 min-h-8">
                                            <Avatar className="h-6 w-6 flex-shrink-0">
                                              <AvatarFallback className="text-[10px] font-medium bg-primary/10 text-primary">
                                                {leadName.substring(0, 2).toUpperCase()}
                                              </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col truncate">
                                              <span className="truncate text-sm font-medium text-foreground">{leadName}</span>
                                              {leadEmail && <span className="truncate text-[10px] opacity-70">{leadEmail}</span>}
                                            </div>
                                          </div>
                                        </div>
                                        
                                        <div className="flex items-center justify-between mt-1 pt-2 border-t border-border/40">
                                          <div className="flex items-center text-[11px] text-muted-foreground font-medium gap-2">
                                            <div className="flex items-center">
                                              <Calendar className="h-3 w-3 mr-1.5 opacity-70" />
                                              {formatDate(order.created_at)}
                                            </div>
                                            {hasNewItems && (
                                              <Badge className="text-[9px] px-1 py-0 h-4 bg-amber-500 hover:bg-amber-600 text-white border-0 uppercase tracking-wider">
                                                {t('orders.kanban.newItems') || 'New Items'}
                                              </Badge>
                                            )}
                                          </div>
                                          
                                          {order.sales?.source && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                                              {order.sales.source === 'online' ? (t('orders.kanban.sourceOnline') || 'Online Store') : (t('orders.kanban.sourcePos') || 'POS')}
                                            </Badge>
                                          )}
                                        </div>
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
