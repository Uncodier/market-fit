"use client"

import React from "react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { Card } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Send, ExternalLink } from "@/app/components/ui/icons"
import Link from "next/link"

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-foreground hover:bg-muted/50 border-none",
  preparing: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900/50",
  shipped: "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-900/50",
  in_transit: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/50",
  delivered: "bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-green-200 dark:border-green-900/50",
  cancelled: "bg-red-50 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-red-200 dark:border-red-900/50",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-red-300 dark:border-red-900/50",
}

const SHIPMENT_STATUSES = [
  { id: 'pending', name: 'Pending' },
  { id: 'preparing', name: 'Preparing' },
  { id: 'shipped', name: 'Shipped' },
  { id: 'in_transit', name: 'In Transit' },
  { id: 'delivered', name: 'Delivered' },
  { id: 'cancelled', name: 'Cancelled' },
  { id: 'failed', name: 'Failed' }
]

interface KanbanViewProps {
  shipments: any[]
  onUpdateShipmentStatus: (shipmentId: string, newStatus: string) => Promise<void>
}

export function KanbanView({ 
  shipments, 
  onUpdateShipmentStatus
}: KanbanViewProps) {
  // Group shipments by status
  const shipmentsByStatus = React.useMemo(() => {
    const grouped: Record<string, any[]> = {}
    SHIPMENT_STATUSES.forEach(status => {
      grouped[status.id] = shipments.filter(shipment => shipment.status === status.id)
    })
    return grouped
  }, [shipments])

  // Handle drag end
  const handleDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result

    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
      return
    }

    await onUpdateShipmentStatus(draggableId, destination.droppableId)
  }

  return (
    <div className="w-full">
      <div className="overflow-x-auto pb-8">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="inline-flex gap-4 pb-4 min-h-[200px]">
            {SHIPMENT_STATUSES.map(status => (
              <div key={status.id} className="flex flex-col h-full w-[280px]">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium text-sm">{status.name}</h3>
                  <Badge variant="outline">{shipmentsByStatus[status.id].length}</Badge>
                </div>
                
                <Droppable droppableId={status.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "flex-1 rounded-md p-2 min-h-[500px]",
                        snapshot.isDraggingOver 
                          ? 'bg-muted/80 dark:bg-primary/10' 
                          : 'bg-muted/30/80 dark:bg-[rgb(2,8,23)]/5'
                      )}
                    >
                      <ScrollArea className="h-[500px] w-full pr-4">
                        {shipmentsByStatus[status.id].map((shipment, index) => (
                          <Draggable key={shipment.id} draggableId={shipment.id} index={index}>
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={cn(
                                  "mb-3 transition-shadow duration-200 hover:shadow-md overflow-hidden bg-card",
                                  snapshot.isDragging 
                                    ? 'shadow-lg border-primary/20' 
                                    : ''
                                )}
                              >
                                <div className="p-3 pb-2">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="text-sm font-medium line-clamp-1">
                                      {shipment.sale_order_id ? (
                                        <Link
                                          href={`/orders/${shipment.sale_order_id}`}
                                          className="hover:underline text-blue-600"
                                          onClick={e => e.stopPropagation()}
                                        >
                                          {shipment.sale_orders?.order_number || 'Unknown Order'}
                                        </Link>
                                      ) : (
                                        shipment.sale_orders?.order_number || 'Unknown Order'
                                      )}
                                    </div>
                                    <Link 
                                      href={`/shipments/${shipment.id}`} 
                                      className="text-muted-foreground hover:text-muted-foreground"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </Link>
                                  </div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge className={cn(STATUS_STYLES[shipment.status], "text-[10px]")}>
                                      {shipment.status.replace('_', ' ').toUpperCase()}
                                    </Badge>
                                  </div>
                                </div>

                                <div className="px-3 pb-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                      <span className="text-[10px] text-primary font-medium">
                                        {shipment.leads?.name?.substring(0, 2).toUpperCase() || 'UN'}
                                      </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <span className="text-xs text-foreground block truncate">
                                        {shipment.leads?.name || 'Unknown Customer'}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="text-xs text-muted-foreground mb-2 truncate">
                                    Tracking: {shipment.tracking_number || 'Not assigned'}
                                  </div>

                                  <div className="flex items-center justify-between pt-2 border-t border-border">
                                    <div className="text-xs text-muted-foreground flex items-center">
                                      <Send className="h-3 w-3 mr-1" />
                                      {shipment.locations?.name || 'Store'}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">
                                      {format(new Date(shipment.created_at), 'MMM d')}
                                    </span>
                                  </div>
                                </div>
                              </Card>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </ScrollArea>
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  )
}
