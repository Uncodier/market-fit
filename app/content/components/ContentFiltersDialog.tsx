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
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogForm, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
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

export function ContentFiltersDialog({ 
  isOpen, 
  onOpenChange, 
  filters, 
  onFiltersChange,
  segments
}: { 
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  filters: ContentFilters
  onFiltersChange: (filters: ContentFilters) => void
  segments: Array<{ id: string; name: string }>
}) {
  const { t } = useLocalization()
  const [localFilters, setLocalFilters] = useState<ContentFilters>({...filters})
  // Estado para las secciones expandidas
  const [expandedSections, setExpandedSections] = useState({
    status: true,
    type: true,
    segments: true
  })

  useEffect(() => {
    setLocalFilters({...filters})
  }, [filters])

  // Función para cambiar el estado de una sección
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleStatusChange = (status: string) => {
    setLocalFilters(prev => {
      if (prev.status.includes(status)) {
        return {
          ...prev,
          status: prev.status.filter(s => s !== status)
        }
      } else {
        return {
          ...prev,
          status: [...prev.status, status]
        }
      }
    })
  }

  const handleTypeChange = (type: string) => {
    setLocalFilters(prev => {
      if (prev.type.includes(type)) {
        return {
          ...prev,
          type: prev.type.filter(t => t !== type)
        }
      } else {
        return {
          ...prev,
          type: [...prev.type, type]
        }
      }
    })
  }

  const handleSegmentChange = (segmentId: string) => {
    setLocalFilters(prev => {
      if (prev.segments.includes(segmentId)) {
        return {
          ...prev,
          segments: prev.segments.filter(s => s !== segmentId)
        }
      } else {
        return {
          ...prev,
          segments: [...prev.segments, segmentId]
        }
      }
    })
  }

  const handleApplyFilters = () => {
    onFiltersChange(localFilters)
    onOpenChange(false)
  }

  const handleResetFilters = () => {
    const resetFilters = {
      status: [],
      type: [],
      segments: []
    }
    setLocalFilters(resetFilters)
    onFiltersChange(resetFilters)
    onOpenChange(false)
  }

  // Función para obtener el total de filtros activos
  const getTotalActiveFilters = () => {
    return localFilters.status.length + localFilters.type.length + localFilters.segments.length
  }

  // Función para obtener la clase del badge de estado
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200"
      case "review":
        return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200"
      case "approved":
        return "bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200"
      case "published":
        return "bg-green-100 text-green-700 hover:bg-green-100 border-green-200"
      case "archived":
        return "bg-gray-100 text-gray-700 hover:bg-gray-100 border-gray-200"
      default:
        return "bg-gray-100 text-gray-700 hover:bg-gray-100 border-gray-200"
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogForm onSubmit={(e) => { e.preventDefault(); handleApplyFilters() }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Content
          </DialogTitle>
          <DialogDescription>
            Apply filters to narrow down your content list.
            {getTotalActiveFilters() > 0 && (
              <Badge variant="outline" className="ml-2">
                {getTotalActiveFilters()} active filters
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
        <div className="space-y-4">
          {/* Status Filter */}
          <div className="border rounded-lg">
            <div 
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={() => toggleSection('status')}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">{t('content.filter.status')}</h3>
                {localFilters.status.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {localFilters.status.length}
                  </Badge>
                )}
              </div>
              {expandedSections.status ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            
            {expandedSections.status && (
              <div className="px-3 py-[10px] border-t">
                <div className="grid grid-cols-2 gap-2">
                  {CONTENT_STATUSES.map(status => (
                    <div key={status.id} className="flex items-center space-x-2">
                      <Switch 
                        id={`status-${status.id}`}
                        checked={localFilters.status.includes(status.id)}
                        onCheckedChange={() => handleStatusChange(status.id)}
                      />
                      <Label 
                        htmlFor={`status-${status.id}`}
                        className="text-sm cursor-pointer flex items-center gap-1.5"
                      >
                        <Badge className={`${getStatusBadgeClass(status.id)} text-xs px-1.5 py-0`}>
                          {t(`content.status.${status.id}`)}
                        </Badge>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Content Type Filter */}
          <div className="border rounded-lg">
            <div 
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={() => toggleSection('type')}
            >
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">{t('content.filter.contentType')}</h3>
                {localFilters.type.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {localFilters.type.length}
                  </Badge>
                )}
              </div>
              {expandedSections.type ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            
            {expandedSections.type && (
              <div className="px-3 py-[10px] border-t">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="type-blog_post"
                      checked={localFilters.type.includes('blog_post')}
                      onCheckedChange={() => handleTypeChange('blog_post')}
                    />
                    <Label 
                      htmlFor="type-blog_post"
                      className="text-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <FileText className="h-3.5 w-3.5 text-blue-500" />
                      Blog Post
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="type-video"
                      checked={localFilters.type.includes('video')}
                      onCheckedChange={() => handleTypeChange('video')}
                    />
                    <Label 
                      htmlFor="type-video"
                      className="text-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <FileVideo className="h-3.5 w-3.5 text-purple-500" />
                      Video
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="type-podcast"
                      checked={localFilters.type.includes('podcast')}
                      onCheckedChange={() => handleTypeChange('podcast')}
                    />
                    <Label 
                      htmlFor="type-podcast"
                      className="text-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-green-500" />
                      Podcast
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="type-social_post"
                      checked={localFilters.type.includes('social_post')}
                      onCheckedChange={() => handleTypeChange('social_post')}
                    />
                    <Label 
                      htmlFor="type-social_post"
                      className="text-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <Globe className="h-3.5 w-3.5 text-yellow-500" />
                      Social Post
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="type-newsletter"
                      checked={localFilters.type.includes('newsletter')}
                      onCheckedChange={() => handleTypeChange('newsletter')}
                    />
                    <Label 
                      htmlFor="type-newsletter"
                      className="text-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <Mail className="h-3.5 w-3.5 text-red-500" />
                      Newsletter
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="type-case_study"
                      checked={localFilters.type.includes('case_study')}
                      onCheckedChange={() => handleTypeChange('case_study')}
                    />
                    <Label 
                      htmlFor="type-case_study"
                      className="text-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <FileText className="h-3.5 w-3.5 text-indigo-500" />
                      Case Study
                    </Label>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Segments Filter */}
          {segments.length > 0 && (
            <div className="border rounded-lg">
              <div 
                className="flex items-center justify-between p-3 cursor-pointer"
                onClick={() => toggleSection('segments')}
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium">{t('content.filter.segments')}</h3>
                  {localFilters.segments.length > 0 && (
                    <Badge variant="outline" className="ml-2">
                      {localFilters.segments.length}
                    </Badge>
                  )}
                </div>
                {expandedSections.segments ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              
              {expandedSections.segments && (
                <div className="px-3 py-[10px] border-t">
                  <div className="grid grid-cols-2 gap-2">
                    {segments.map(segment => (
                      <div key={segment.id} className="flex items-center space-x-2">
                        <Switch 
                          id={`segment-${segment.id}`}
                          checked={localFilters.segments.includes(segment.id)}
                          onCheckedChange={() => handleSegmentChange(segment.id)}
                        />
                        <Label 
                          htmlFor={`segment-${segment.id}`}
                          className="text-sm cursor-pointer"
                        >
                          {segment.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        </DialogBody>
        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" onClick={handleResetFilters} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button type="submit" className="gap-2">
            <Filter className="h-4 w-4" />
            Apply Filters
          </Button>
        </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}
