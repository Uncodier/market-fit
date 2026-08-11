"use client"

import React, { useMemo, useState } from "react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { Card } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { CatalogItem, CatalogCategory } from "@/app/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Archive, DatabaseIcon, Edit } from "@/app/components/ui/icons"
import { resolveItemImage } from "@/app/lib/image-utils"
import { NavigationLink } from "@/app/components/navigation/NavigationLink"
import { GripHorizontal } from "@/app/components/ui/icons"

import { Button } from "@/app/components/ui/button"

interface KanbanViewProps {
  items: CatalogItem[]
  categories: CatalogCategory[]
  onDragEnd?: (result: any) => void
  isDragEnabled?: boolean
  searchQuery?: string
}

export function KanbanView({ 
  items, 
  categories,
  onDragEnd,
  isDragEnabled = false,
  searchQuery
}: KanbanViewProps) {
  const { t } = useLocalization()
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({})

  const getVisibleCount = (id: string) => visibleCounts[id] || 10
  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>, columnId: string, totalItems: number) => {
    const target = e.target as HTMLDivElement
    const { scrollTop, scrollHeight, clientHeight } = target
    if (scrollHeight > 0 && scrollHeight - scrollTop <= clientHeight + 50) {
      setVisibleCounts(prev => {
        const current = prev[columnId] || 10
        if (current >= totalItems) return prev
        return { ...prev, [columnId]: current + 10 }
      })
    }
  }

  const loadMore = (columnId: string, totalItems: number) => {
    setVisibleCounts(prev => {
      const current = prev[columnId] || 10
      if (current >= totalItems) return prev
      return { ...prev, [columnId]: current + 10 }
    })
  }

  // Group items by category_id
  const itemsByCategoryId = useMemo(() => {
    const grouped: Record<string, CatalogItem[]> = {}
    items.forEach(item => {
      const catId = item.category_id || "uncategorized"
      if (!grouped[catId]) grouped[catId] = []
      grouped[catId].push(item)
    })
    return grouped
  }, [items])

  const orderedColumns = useMemo(() => {
    const cols = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      items: itemsByCategoryId[cat.id] || []
    }))
    
    // Always append Uncategorized if it has items or if there's no search query
    const uncategorizedItems = itemsByCategoryId["uncategorized"] || []
    if (uncategorizedItems.length > 0 || cols.length === 0) {
      cols.push({
        id: "uncategorized",
        name: t('catalog.uncategorized') || "Uncategorized",
        items: uncategorizedItems
      })
    }
    
    return cols
  }, [categories, itemsByCategoryId, t])

  const handleDragEndInternal = (result: any) => {
    if (!onDragEnd) return
    onDragEnd(result)
  }

  return (
    <div className="w-full">
      <div className="overflow-x-auto pb-8">
        <DragDropContext onDragEnd={handleDragEndInternal}>
          <Droppable droppableId="categories-board" type="category" direction="horizontal" isDropDisabled={!isDragEnabled}>
            {(providedBoard) => (
              <div 
                ref={providedBoard.innerRef} 
                {...providedBoard.droppableProps}
                className="inline-flex gap-4 pb-4 min-h-[200px]"
              >
                {orderedColumns.map((column, colIndex) => {
                  const isUncategorized = column.id === "uncategorized"
                  const visibleItems = column.items.slice(0, getVisibleCount(column.id))
                  return (
                    <Draggable 
                      key={column.id} 
                      draggableId={column.id} 
                      index={colIndex}
                      isDragDisabled={!isDragEnabled || isUncategorized}
                    >
                      {(providedCol, snapshotCol) => (
                        <div 
                          ref={providedCol.innerRef}
                          {...providedCol.draggableProps}
                          className={cn(
                            "flex flex-col h-full w-[280px]",
                            snapshotCol.isDragging && "opacity-80"
                          )}
                          style={providedCol.draggableProps.style}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isDragEnabled && !isUncategorized && (
                                <div
                                  {...providedCol.dragHandleProps}
                                  className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground"
                                >
                                  <GripHorizontal className="h-4 w-4" />
                                </div>
                              )}
                              <h3 className="font-medium text-sm">
                                {column.name}
                              </h3>
                            </div>
                            <Badge variant="outline">{column.items.length}</Badge>
                          </div>
                          
                          <ScrollArea 
                            className="w-full rounded-md p-2 bg-muted/30/80 dark:bg-[rgb(2,8,23)]/5 max-h-[calc(100vh-220px)] min-h-[150px]"
                            onScrollCapture={(e) => handleScroll(e, column.id, column.items.length)}
                          >
                            <Droppable droppableId={column.id} type="item" isDropDisabled={!isDragEnabled}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={cn(
                                    "min-h-[150px] pr-4 h-full",
                                    snapshot.isDraggingOver && 'bg-muted/80 dark:bg-primary/10 rounded-md'
                                  )}
                                >
                                  {visibleItems.map((item, index) => (
                                    <Draggable 
                                      key={item.id} 
                                      draggableId={item.id} 
                                      index={index}
                                      isDragDisabled={!isDragEnabled}
                                    >
                                      {(providedRow, snapshotRow) => (
                                        <Card
                                          ref={providedRow.innerRef}
                                          {...providedRow.draggableProps}
                                          {...providedRow.dragHandleProps}
                                          className={cn(
                                            "mb-3 transition-shadow duration-200 hover:shadow-md overflow-hidden bg-card",
                                            snapshotRow.isDragging 
                                              ? 'shadow-lg border-primary/20 z-50 relative' 
                                              : '',
                                            item.status === 'archived' ? 'opacity-60' : ''
                                          )}
                                          style={providedRow.draggableProps.style}
                                        >
                                          <div className="h-32 w-full bg-muted/30 relative flex-shrink-0">
                                            <img src={resolveItemImage(item)} alt={item.name} className="w-full h-full object-cover" />
                                          </div>
                                          <div className="p-3 pb-2">
                                            <div className="flex justify-between items-start mb-2">
                                              <div className="text-sm font-medium line-clamp-2 pr-2">
                                                {item.name}
                                              </div>
                                              <NavigationLink 
                                                href={`/catalog/${item.id}`} 
                                                className="text-muted-foreground hover:text-muted-foreground shrink-0"
                                                onClick={e => e.stopPropagation()}
                                              >
                                                <Edit className="h-3 w-3" />
                                              </NavigationLink>
                                            </div>
                                            {item.sku && (
                                              <div className="text-xs text-muted-foreground font-mono mb-2">
                                                {item.sku}
                                              </div>
                                            )}
                                          </div>

                                          <div className="px-3 pb-3">
                                            <div className="flex items-center justify-between mt-1">
                                              <span className="text-sm font-medium">
                                                {item.is_dynamic_price ? (
                                                  <span className="text-sm">
                                                    {item.lowest_sale_price != null || item.metadata?.dynamic_pricing?.min_price != null
                                                      ? `From ${new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency || 'USD' }).format(Number(item.metadata?.dynamic_pricing?.min_price ?? item.lowest_sale_price))}`
                                                      : (t('catalog.dynamicPricing.quote') || 'Quote')}
                                                  </span>
                                                ) : item.target_sale_price != null 
                                                  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency || 'USD' }).format(item.target_sale_price)
                                                  : <span className="text-muted-foreground">-</span>
                                                }
                                              </span>
                                            </div>

                                            <div className="flex flex-wrap gap-2 mt-2">
                                              <Badge variant="secondary" className="capitalize text-[10px]">
                                                {item.availability_mode}
                                              </Badge>
                                            </div>
                                          </div>
                                        </Card>
                                      )}
                                    </Draggable>
                                  ))}
                                  {column.items.length > visibleItems.length && (
                                    <div className="pt-2 pb-4 flex justify-center">
                                      <Button variant="ghost" size="sm" onClick={() => loadMore(column.id, column.items.length)}>
                                        {t('common.loadMore') || 'Cargar 10 más'}
                                      </Button>
                                    </div>
                                  )}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </ScrollArea>
                        </div>
                      )}
                    </Draggable>
                  )
                })}
                {providedBoard.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </div>
  )
}
