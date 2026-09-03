"use client"

import { useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Badge } from "@/app/components/ui/badge"
import {
  FileText, Filter, PlayCircle, Mail, BarChart, LayoutGrid, MessageSquare, FileVideo, Globe,
  PenSquare, Users, RotateCcw, CalendarIcon, Eye, ChevronLeft, ChevronRight, X, CheckCircle2,
  Pencil, ChevronUp, ChevronDown, Target, Microscope, Megaphone, ListOrdered, Check
} from "@/app/components/ui/icons"
import { Switch } from "@/app/components/ui/switch"
import { DatePicker } from "@/app/components/ui/date-picker"
import { Pagination } from "@/app/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/app/components/ui/sheet"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Table, TableHeader, TableBody, TableCell, TableRow, TableHead } from "@/app/components/ui/table"
import { updateContent, updateContentStatus, type ContentItem } from "../actions"
import { type ContentAssetWithDetails } from "@/app/assets/actions"
import { getContentTypeName, getSegmentName, getContentTypeIconClass, getCampaignName } from "../utils"
import { StarRating } from "@/app/components/ui/rating"
import { toast } from "sonner"
import React from "react"
import { cn } from "@/lib/utils"
import { useLocalization } from "@/app/context/LocalizationContext"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { CONTENT_STATUSES, STATUS_COLORS, CONTENT_TYPE_ICONS, getNetworkIcon, type ContentFilters } from "../content-shared"

import { ContentCard } from "./ContentCard"

export function ContentKanban({ 
  contentItems, 
  onUpdateContentStatus, 
  segments, 
  campaigns,
  onContentClick,
  onRatingChange,
  isLoadingCampaigns,
  assetsByContentId = {},
  outstandPosts,
  performanceData,
  onPublish
}: {
  contentItems: ContentItem[]
  onUpdateContentStatus: (contentId: string, newStatus: string) => Promise<void>
  segments: Array<{ id: string; name: string }>
  campaigns: Array<{ id: string; title: string }>
  onContentClick: (content: ContentItem) => void
  onRatingChange?: (contentId: string, rating: number) => void
  isLoadingCampaigns?: boolean
  assetsByContentId?: Record<string, ContentAssetWithDetails[]>
  outstandPosts?: any[]
  performanceData?: { byContentId: Record<string, any>, byPostId: Record<string, any> }
  onPublish?: (content: ContentItem) => void
}) {
  const { t } = useLocalization()
  const [items, setItems] = useState<Record<string, ContentItem[]>>({})

  useEffect(() => {
    const groupedItems: Record<string, ContentItem[]> = {}
    
    // Initialize all statuses with empty arrays
    CONTENT_STATUSES.forEach(status => {
      groupedItems[status.id] = []
    })
    
    // Group content items by status
    contentItems.forEach(item => {
      if (groupedItems[item.status]) {
        groupedItems[item.status].push(item)
      }
    })
    
    setItems(groupedItems)
  }, [contentItems])

  // Handle rating changes within the kanban view
  const handleRatingChange = (contentId: string, rating: number) => {
    // Update the item in our local state
    const newItems = { ...items };
    
    // Find which status column contains this content item
    for (const status in newItems) {
      const index = newItems[status].findIndex(item => item.id === contentId);
      if (index !== -1) {
        // Update the rating in our local state
        newItems[status] = [
          ...newItems[status].slice(0, index),
          { ...newItems[status][index], performance_rating: rating },
          ...newItems[status].slice(index + 1)
        ];
        break;
      }
    }
    
    setItems(newItems);
    
    // Also call the parent callback if provided
    if (onRatingChange) {
      onRatingChange(contentId, rating);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result

    // If dropped outside a droppable area
    if (!destination) return

    // If dropped in the same place
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) return

    // If the status hasn't changed
    if (destination.droppableId === source.droppableId) return

    // Find the content item
    const contentItem = contentItems.find(item => item.id === draggableId)
    if (!contentItem) return

    // Only Optimistically update if not publishing
    const newItems = { ...items }
    
    // Remove from source
    newItems[source.droppableId] = newItems[source.droppableId].filter(
      item => item.id !== draggableId
    )
    
    // Add to destination with updated status
    const updatedItem = { ...contentItem, status: destination.droppableId as any }
    newItems[destination.droppableId] = [
      ...newItems[destination.droppableId],
      updatedItem
    ]
    
    setItems(newItems)

    try {
      // Update in the database - this will also update the parent state
      await onUpdateContentStatus(draggableId, destination.droppableId)
      
      // If moved to approved, trigger publish modal
      if (destination.droppableId === 'approved' && onPublish) {
        onPublish(updatedItem)
      }
    } catch (error) {
      // Revert on error
      console.error('Error updating content status:', error)
      toast.error(t('content.toast.statusFailed'))
      
      // Revert to original state - rebuild from contentItems
      const revertedItems: Record<string, ContentItem[]> = {}
      
      // Initialize all statuses with empty arrays
      CONTENT_STATUSES.forEach(status => {
        revertedItems[status.id] = []
      })
      
      // Group content items by status
      contentItems.forEach(item => {
        if (revertedItems[item.status]) {
          revertedItems[item.status].push(item)
        }
      })
      
      setItems(revertedItems)
    }
  }

  return (
    <div className="w-full h-full flex flex-col justify-start flex-1 min-h-0 self-stretch flex-grow min-w-0 overflow-x-auto overflow-y-hidden pb-4">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 min-w-max px-4 md:px-8 pb-4 items-start pt-0 mt-0 flex-1 flex-row h-full min-h-0 items-stretch self-stretch flex-grow after:content-[''] after:w-px after:shrink-0">
          {CONTENT_STATUSES.map(status => (
            <div key={status.id} className="flex-shrink-0 w-80 h-fit max-h-full flex flex-col justify-start min-h-0">
              <div className="bg-background rounded-t-md p-3 border-b border-x border-t flex-none">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">{t(`content.status.${status.id}`)}</h3>
                </div>
              </div>
              <Droppable droppableId={status.id}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="bg-muted/30 rounded-b-md p-2 border-b border-x overflow-y-auto min-h-[100px]"
                  >
                    {items[status.id]?.length > 0 ? (
                      items[status.id].map((item, index) => (
                        <Draggable key={item.id} draggableId={item.id} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              <ContentCard 
                                content={item} 
                                segments={segments}
                                campaigns={campaigns}
                                onClick={onContentClick}
                                onRatingChange={handleRatingChange}
                                isLoadingCampaigns={isLoadingCampaigns}
                                assets={assetsByContentId?.[item.id] || []}
                                outstandPosts={status.id === 'published' ? outstandPosts : undefined}
                                performanceData={performanceData}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))
                    ) : (
                      <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                        No content items
                      </div>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  )
}

