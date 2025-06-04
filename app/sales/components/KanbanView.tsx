"use client"

import React from "react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Sale } from "@/app/types"
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut"
import { format } from "date-fns"
import { Button } from "@/app/components/ui/button"

// Status colors for sales
const STATUS_STYLES = {
  draft: "bg-gray-50 text-gray-700 hover:bg-gray-50 border-gray-200",
  pending: "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200",
  completed: "bg-green-50 text-green-700 hover:bg-green-50 border-green-200",
  cancelled: "bg-red-50 text-red-700 hover:bg-red-50 border-red-200",
  refunded: "bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200"
}

// Source colors for sales
const SOURCE_STYLES = {
  retail: "bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200",
  online: "bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-indigo-200"
}

// Sale statuses
const SALE_STATUSES = [
  { id: 'draft', name: 'Draft' },
  { id: 'pending', name: 'Pending' },
  { id: 'completed', name: 'Completed' },
  { id: 'cancelled', name: 'Cancelled' },
  { id: 'refunded', name: 'Refunded' }
]

interface KanbanViewProps {
  sales: Sale[]
  onUpdateSaleStatus: (saleId: string, newStatus: string) => Promise<void>
  segments: Array<{ id: string; name: string }>
  onSaleClick: (sale: Sale) => void
  onPrintSale: (sale: Sale) => void
  onRegisterPayment: (sale: Sale) => void
}

export function KanbanView({ 
  sales, 
  onUpdateSaleStatus, 
  segments,
  onSaleClick,
  onPrintSale,
  onRegisterPayment
}: KanbanViewProps) {
  // Group sales by status
  const salesByStatus = React.useMemo(() => {
    const grouped: Record<string, Sale[]> = {}
    SALE_STATUSES.forEach(status => {
      grouped[status.id] = sales.filter(sale => sale.status === status.id)
    })
    return grouped
  }, [sales])

  // Function to get segment name from its ID
  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return "No Segment"
    if (!segments || !Array.isArray(segments)) return "Unknown Segment"
    const segment = segments.find(s => s.id === segmentId)
    return segment?.name || "Unknown Segment"
  }

  // Handle drag end
  const handleDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result

    // If there's no destination or the item was dropped in its original position
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
      return
    }

    // Update the sale status
    await onUpdateSaleStatus(draggableId, destination.droppableId)
  }

  // Handle card click
  const handleCardClick = (e: React.MouseEvent, sale: Sale) => {
    e.preventDefault()
    onSaleClick(sale)
  }

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy')
    } catch (error) {
      return dateString
    }
  }

  return (
    <div className="w-full">
      <div className="overflow-x-auto pb-8">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="inline-flex gap-4 pb-4 min-h-[200px]">
            {SALE_STATUSES.map(status => (
              <div key={status.id} className="flex flex-col h-full w-[280px]">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium text-sm">{status.name}</h3>
                  <Badge variant="outline">{salesByStatus[status.id].length}</Badge>
                </div>
                
                <Droppable droppableId={status.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "flex-1 rounded-md p-2 min-h-[500px]",
                        snapshot.isDraggingOver 
                          ? 'bg-gray-100/80 dark:bg-primary/10' 
                          : 'bg-gray-50/80 dark:bg-[rgb(2,8,23)]/5'
                      )}
                    >
                      <ScrollArea className="h-[500px] w-full pr-4">
                        {salesByStatus[status.id].map((sale, index) => (
                          <Draggable key={sale.id} draggableId={sale.id} index={index}>
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={cn(
                                  "mb-3 transition-all duration-200 hover:shadow-md hover:translate-y-[-2px] cursor-pointer overflow-hidden",
                                  snapshot.isDragging 
                                    ? 'shadow-lg dark:shadow-black/20 border-primary/20' 
                                    : ''
                                )}
                                onClick={(e) => handleCardClick(e, sale)}
                              >
                                {/* Title Section */}
                                <div className="p-3 pb-2">
                                  <div className="text-sm font-medium mb-2 line-clamp-2">
                                    {sale.title}
                                  </div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge className={`${SOURCE_STYLES[sale.source]} text-[10px]`}>
                                      {sale.source}
                                    </Badge>
                                    {sale.segmentId && (
                                      <Badge 
                                        variant="secondary" 
                                        className="text-[10px]"
                                        title={getSegmentName(sale.segmentId)}
                                      >
                                        {getSegmentName(sale.segmentId)}
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                {/* Content Section */}
                                <div className="px-3 pb-3">
                                  {/* Product Info */}
                                  <div className="text-xs text-muted-foreground mb-2">
                                    {sale.productName}
                                  </div>

                                  {/* Lead Info */}
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                                      <span className="text-[10px] text-primary font-medium">
                                        {sale.leadName?.substring(0, 2).toUpperCase() || 'AN'}
                                      </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground truncate">
                                      {sale.leadName}
                                    </span>
                                  </div>

                                  {/* Footer Section */}
                                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                    <div className="text-sm font-medium">
                                      {formatCurrency(sale.amount)}
                                      {sale.amount_due > 0 && (
                                        <span className="text-primary ml-1 text-xs">
                                          ({formatCurrency(sale.amount_due)} due)
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">
                                      {formatDate(sale.saleDate)}
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