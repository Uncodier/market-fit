"use client"

import React from "react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { Card } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { CatalogItem } from "@/app/types"
import { Archive, DatabaseIcon, Edit } from "@/app/components/ui/icons"
import Link from "next/link"

const KIND_COLUMNS = [
  { id: 'product', name: 'Products', icon: Archive },
  { id: 'service', name: 'Services', icon: DatabaseIcon }
]

interface KanbanViewProps {
  items: CatalogItem[]
  onUpdateKind: (itemId: string, newKind: string) => Promise<void>
}

export function KanbanView({ 
  items, 
  onUpdateKind
}: KanbanViewProps) {
  // Group items by kind
  const itemsByKind = React.useMemo(() => {
    const grouped: Record<string, CatalogItem[]> = {}
    KIND_COLUMNS.forEach(kind => {
      grouped[kind.id] = items.filter(item => item.kind === kind.id)
    })
    return grouped
  }, [items])

  // Handle drag end
  const handleDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result

    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
      return
    }

    await onUpdateKind(draggableId, destination.droppableId)
  }

  return (
    <div className="w-full">
      <div className="overflow-x-auto pb-8">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="inline-flex gap-4 pb-4 min-h-[200px]">
            {KIND_COLUMNS.map(column => {
              const Icon = column.icon
              return (
                <div key={column.id} className="flex flex-col h-full w-[280px]">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-medium text-sm flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {column.name}
                    </h3>
                    <Badge variant="outline">{itemsByKind[column.id].length}</Badge>
                  </div>
                  
                  <Droppable droppableId={column.id}>
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
                          {itemsByKind[column.id].map((item, index) => (
                            <Draggable key={item.id} draggableId={item.id} index={index}>
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={cn(
                                    "mb-3 transition-shadow duration-200 hover:shadow-md overflow-hidden bg-card",
                                    snapshot.isDragging 
                                      ? 'shadow-lg border-primary/20' 
                                      : '',
                                    item.status === 'archived' ? 'opacity-60' : ''
                                  )}
                                >
                                  <div className="p-3 pb-2">
                                    <div className="flex justify-between items-start mb-2">
                                      <div className="text-sm font-medium line-clamp-2 pr-2">
                                        {item.name}
                                      </div>
                                      <Link 
                                        href={`/catalog/${item.id}`} 
                                        className="text-muted-foreground hover:text-muted-foreground shrink-0"
                                        onClick={e => e.stopPropagation()}
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Link>
                                    </div>
                                    {item.sku && (
                                      <div className="text-xs text-muted-foreground font-mono mb-2">
                                        {item.sku}
                                      </div>
                                    )}
                                  </div>

                                  <div className="px-3 pb-3">
                                    <div className="flex items-center justify-between pt-2 border-t border-border">
                                      <div className="font-semibold text-foreground">
                                        {item.target_sale_price != null 
                                          ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.target_sale_price)
                                          : <span className="text-muted-foreground">-</span>
                                        }
                                      </div>
                                      <Badge variant="secondary" className="capitalize text-[10px]">
                                        {item.availability_mode}
                                      </Badge>
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
              )
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  )
}
