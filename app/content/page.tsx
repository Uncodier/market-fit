"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Badge } from "@/app/components/ui/badge"
import { 
  Search, 
  FileText, 
  Filter, 
  PlayCircle, 
  Mail, 
  BarChart, 
  LayoutGrid,
  MessageSquare,
  FileVideo,
  Globe,
  PenSquare,
  Users,
  RotateCcw,
  CalendarIcon,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  Pencil,
  ChevronUp,
  ChevronDown
} from "@/app/components/ui/icons"
import { Switch } from "@/app/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { useSite } from "@/app/context/SiteContext"
import { getContent, createContent, updateContentStatus, updateContent, type ContentItem } from "./actions"
import { getSegments } from "@/app/segments/actions"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import { toast } from "sonner"
import React from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/app/components/ui/sheet"
import { Skeleton } from "@/app/components/ui/skeleton"
import { ViewSelector, ViewType } from "@/app/components/view-selector"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { EmptyState } from "@/app/components/ui/empty-state"
import { Table, TableHeader, TableBody, TableCell, TableRow, TableHead } from "@/app/components/ui/table"
import { useRouter } from "next/navigation"
import { CreateContentDialog } from "./components"
import { getContentTypeName, getSegmentName, getContentTypeIconClass } from "./utils"
import { StarRating } from "@/app/components/ui/rating"
import { useCommandK } from "@/app/hooks/use-command-k"
import { safeReload } from "@/app/utils/safe-reload"

// Definimos los tipos de estado del contenido
const CONTENT_STATUSES = [
  { id: 'draft', name: 'Draft' },
  { id: 'review', name: 'In Review' },
  { id: 'approved', name: 'Approved' },
  { id: 'published', name: 'Published' },
  { id: 'archived', name: 'Archived' }
]

// Colores para los diferentes estados
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  approved: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  published: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  archived: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
}

// Iconos para los diferentes tipos de contenido
const CONTENT_TYPE_ICONS: Record<string, React.ReactElement> = {
  blog_post: <FileText className="h-4 w-4" />,
  video: <FileVideo className="h-4 w-4" />,
  podcast: <MessageSquare className="h-4 w-4" />,
  social_post: <Globe className="h-4 w-4" />,
  newsletter: <Mail className="h-4 w-4" />,
  case_study: <FileText className="h-4 w-4" />,
  whitepaper: <FileText className="h-4 w-4" />,
  infographic: <BarChart className="h-4 w-4" />,
  webinar: <PlayCircle className="h-4 w-4" />,
  ebook: <FileText className="h-4 w-4" />,
  ad: <LayoutGrid className="h-4 w-4" />,
  landing_page: <LayoutGrid className="h-4 w-4" />
}

// Interfaz para los filtros de contenido
interface ContentFilters {
  status: string[]
  type: string[]
  segments: string[]
}

interface ContentDetailProps {
  content: ContentItem
  onClose: () => void
  segments: Array<{ id: string; name: string }>
  onRatingChange?: (contentId: string, rating: number) => void
}

function ContentDetail({ content, onClose, segments, onRatingChange }: ContentDetailProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    title: content.title,
    description: content.description || '',
    type: content.type,
    segment_id: content.segment_id || 'none',
    tags: content.tags || [],
    performance_rating: content.performance_rating
  })
  const [tagInput, setTagInput] = useState('')

  const handleRatingChange = (rating: number) => {
    // Update local state
    setEditForm(prev => ({ ...prev, performance_rating: rating }));
    
    // Call parent callback if provided
    if (onRatingChange) {
      onRatingChange(content.id, rating);
    }
    
    // Update the rating immediately in the database
    updateContent({
      contentId: content.id,
      title: content.title,
      type: content.type,
      performance_rating: rating
    }).then(() => {
      toast.success("Performance rating updated", {
        position: "bottom-right",
        duration: 2000
      });
    }).catch(error => {
      console.error("Error updating rating:", error);
      toast.error("Failed to update rating");
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleSaveChanges = async () => {
    if (!content) return
    
    setIsSaving(true)
    try {
      const result = await updateContent({
        contentId: content.id,
        title: editForm.title,
        description: editForm.description || undefined,
        type: editForm.type,
        segment_id: editForm.segment_id === 'none' ? null : editForm.segment_id,
        tags: editForm.tags.length > 0 ? editForm.tags : null,
        performance_rating: editForm.performance_rating
      })
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      setIsEditing(false)
      toast.success("Content updated successfully")
      // Close the panel to refresh the content
      onClose()
    } catch (error) {
      console.error("Error updating content:", error)
      toast.error("Failed to update content")
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !editForm.tags.includes(tagInput.trim())) {
      setEditForm({
        ...editForm,
        tags: [...editForm.tags, tagInput.trim()]
      })
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setEditForm({
      ...editForm,
      tags: editForm.tags.filter(t => t !== tag)
    })
  }

  return (
    <div className="space-y-6 pt-4">
      <SheetHeader className="pb-6">
        {isEditing ? (
          <div className="mt-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-md flex items-center justify-center mt-4" style={{ width: '48px', height: '48px' }}>
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Title</p>
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                  className="h-12 text-sm font-semibold"
                  placeholder="Content title"
                />
              </div>
            </div>
          </div>
        ) : (
          <SheetTitle className="text-2xl mt-4">{content.title}</SheetTitle>
        )}
      </SheetHeader>
      
      <div className="space-y-6">
        {/* Content Information */}
        <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            Content Information
          </h3>
          
          <div className="grid gap-4">
            <div className="flex items-center gap-3">
              <div className={`bg-primary/10 rounded-md flex items-center justify-center ${getContentTypeIconClass(content.type)}`} style={{ width: '48px', height: '48px' }}>
                {CONTENT_TYPE_ICONS[content.type]}
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-[5px]">Content Type</p>
                {isEditing ? (
                  <Select 
                    value={editForm.type} 
                    onValueChange={(value: "blog_post" | "video" | "podcast" | "social_post" | "newsletter" | "case_study" | "whitepaper" | "infographic" | "webinar" | "ebook" | "ad" | "landing_page") => setEditForm({...editForm, type: value})}
                  >
                    <SelectTrigger className="h-12 text-sm">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blog_post">Blog Post</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="podcast">Podcast</SelectItem>
                      <SelectItem value="social_post">Social Media Post</SelectItem>
                      <SelectItem value="newsletter">Newsletter</SelectItem>
                      <SelectItem value="case_study">Case Study</SelectItem>
                      <SelectItem value="whitepaper">Whitepaper</SelectItem>
                      <SelectItem value="infographic">Infographic</SelectItem>
                      <SelectItem value="webinar">Webinar</SelectItem>
                      <SelectItem value="ebook">E-Book</SelectItem>
                      <SelectItem value="ad">Advertisement</SelectItem>
                      <SelectItem value="landing_page">Landing Page</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm font-medium">{getContentTypeName(content.type)}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-[5px]">Status</p>
                <Badge className={STATUS_COLORS[content.status]}>
                  {content.status.charAt(0).toUpperCase() + content.status.slice(1)}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-[5px]">Segment</p>
                {isEditing ? (
                  <Select value={editForm.segment_id} onValueChange={(value) => setEditForm({...editForm, segment_id: value})}>
                    <SelectTrigger className="h-12 text-sm">
                      <SelectValue placeholder="Select segment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No segment</SelectItem>
                      {segments.map((segment) => (
                        <SelectItem key={segment.id} value={segment.id}>
                          {segment.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm font-medium">{getSegmentName(content.segment_id, segments)}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-[5px]">Description</p>
                {isEditing ? (
                  <Textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    className="min-h-[80px] text-sm"
                    placeholder="Enter a brief description"
                  />
                ) : (
                  <p className="text-sm">{content.description || 'No description'}</p>
                )}
              </div>
            </div>
            
            {/* Performance Rating */}
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                <BarChart className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-[5px]">Performance Rating</p>
                <div className="py-1">
                  <StarRating 
                    rating={editForm.performance_rating} 
                    onRatingChange={handleRatingChange}
                    readonly={false}
                    size="lg"
                    className="w-full justify-around"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Metrics */}
        {(content.word_count || content.estimated_reading_time || content.seo_score) && (
          <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
            <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
              Content Metrics
            </h3>
            
            <div className="grid grid-cols-3 gap-4">
              {content.word_count && (
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-[5px]">Word Count</p>
                    <p className="text-sm font-medium">{content.word_count}</p>
                  </div>
                </div>
              )}
              
              {content.estimated_reading_time && (
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-[5px]">Reading Time</p>
                    <p className="text-sm font-medium">{content.estimated_reading_time} min</p>
                  </div>
                </div>
              )}
              
              {content.seo_score && (
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                    <BarChart className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-[5px]">SEO Score</p>
                    <p className="text-sm font-medium">{content.seo_score}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Dates */}
        <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            Dates
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-md flex items-center justify-center min-w-[48px]" style={{ width: '48px', height: '48px' }}>
                <CalendarIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-[5px]">Created</p>
                <p className="text-sm font-medium">
                  {formatDate(content.created_at)}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-md flex items-center justify-center min-w-[48px]" style={{ width: '48px', height: '48px' }}>
                <RotateCcw className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-[5px]">Updated</p>
                <p className="text-sm font-medium">
                  {formatDate(content.updated_at)}
                </p>
              </div>
            </div>
            
            {content.published_at && (
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center min-w-[48px]" style={{ width: '48px', height: '48px' }}>
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-[5px]">Published</p>
                  <p className="text-sm font-medium">
                    {formatDate(content.published_at)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Tags */}
        <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            Tags
          </h3>
          
          {isEditing ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Add a tag"
                  className="h-10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddTag()
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={handleAddTag} className="h-10">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {editForm.tags.length > 0 ? (
                  editForm.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                      <button
                        type="button"
                        className="ml-1 hover:text-destructive"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        ×
                      </button>
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No tags added yet</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {content.tags && content.tags.length > 0 ? (
                content.tags.map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No tags</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {isEditing ? (
          <>
            <Button onClick={() => {
              setIsEditing(false)
              setEditForm({
                title: content.title,
                description: content.description || '',
                type: content.type,
                segment_id: content.segment_id || 'none',
                tags: content.tags || [],
                performance_rating: content.performance_rating
              })
            }} variant="outline" className="w-full">
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={handleSaveChanges} disabled={isSaving} className="w-full">
              {isSaving ? (
                <>Saving...</>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => {
              setIsEditing(true)
              setEditForm({
                title: content.title,
                description: content.description || '',
                type: content.type,
                segment_id: content.segment_id || 'none',
                tags: content.tags || [],
                performance_rating: content.performance_rating
              })
            }} variant="outline" className="w-full">
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button onClick={onClose} variant="destructive" className="w-full">
              <X className="mr-2 h-4 w-4" />
              Close
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function ContentCard({ content, segments, onClick, onRatingChange }: { 
  content: ContentItem, 
  segments: Array<{ id: string; name: string }>,
  onClick: (content: ContentItem) => void,
  onRatingChange?: (contentId: string, rating: number) => void
}) {
  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return null
    const segment = segments.find(s => s.id === segmentId)
    return segment ? segment.name : null
  }

  const handleRatingChange = (rating: number) => {
    // Create updated content with new rating for optimistic UI update
    const updatedContent = { ...content, performance_rating: rating };
    
    // Call the callback to update state in parent component
    if (onRatingChange) {
      onRatingChange(content.id, rating);
    }
    
    // Update the rating in the database
    updateContent({
      contentId: content.id,
      title: content.title,
      type: content.type,
      performance_rating: rating
    }).then(() => {
      toast.success("Performance rating updated", {
        position: "bottom-right",
        duration: 2000
      });
    }).catch(error => {
      console.error("Error updating rating:", error);
      toast.error("Failed to update rating");
    });
  };

  const truncateText = (text: string | null, maxLength: number = 15) => {
    if (!text) return null;
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  }

  const segmentName = getSegmentName(content.segment_id)
  const formattedDate = new Date(content.created_at).toLocaleDateString(undefined, { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  })

  return (
    <Card 
      className="mb-2 cursor-pointer transition-all duration-200 hover:shadow-md hover:translate-y-[-2px]"
      onClick={() => onClick(content)}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex gap-3 items-start">
            <div className={`bg-primary/10 rounded-md flex items-center justify-center min-w-[39px] ${getContentTypeIconClass(content.type)}`} style={{ width: '39px', height: '39px' }}>
              {CONTENT_TYPE_ICONS[content.type]}
            </div>
            <div className="flex flex-col">
              <h3 className="text-sm font-medium line-clamp-1 mt-0.5">{content.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">{getContentTypeName(content.type)}</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">{formattedDate}</span>
              </div>
            </div>
          </div>
        </div>
        
        {content.description && (
          <p className="text-xs text-muted-foreground mt-2 mb-2 line-clamp-2">{content.description}</p>
        )}
        
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2 flex-grow-0 max-w-[65%]">
            {segmentName && (
              <Badge variant="outline" className="text-xs whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]">
                {truncateText(segmentName)}
              </Badge>
            )}
            {content.word_count && (
              <span className="text-xs text-muted-foreground">{content.word_count} words</span>
            )}
          </div>
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="w-[30%] flex justify-end scale-75 origin-right"
          >
            <StarRating 
              rating={content.performance_rating} 
              onRatingChange={handleRatingChange}
              readonly={false}
              size="sm"
              className="justify-end"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ContentKanban({ 
  contentItems, 
  onUpdateContentStatus, 
  segments, 
  onContentClick,
  onRatingChange
}: {
  contentItems: ContentItem[]
  onUpdateContentStatus: (contentId: string, newStatus: string) => Promise<void>
  segments: Array<{ id: string; name: string }>
  onContentClick: (content: ContentItem) => void
  onRatingChange?: (contentId: string, rating: number) => void
}) {
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

    // Optimistic update
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
      // Update in the database
      await onUpdateContentStatus(draggableId, destination.droppableId)
    } catch (error) {
      // Revert on error
      console.error('Error updating content status:', error)
      toast.error('Failed to update content status')
      
      // Revert to original state
      setItems({
        ...items
      })
    }
  }

  return (
    <div className="overflow-x-auto pb-4">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 min-w-fit">
          {CONTENT_STATUSES.map(status => (
            <div key={status.id} className="flex-shrink-0 w-80">
              <div className="bg-background rounded-t-md p-3 border-b border-x border-t">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">{status.name}</h3>
                  <Badge variant="outline" className="text-xs">
                    {items[status.id]?.length || 0}
                  </Badge>
                </div>
              </div>
              <Droppable droppableId={status.id}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="bg-muted/30 rounded-b-md p-2 border-b border-x"
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
                                onClick={onContentClick}
                                onRatingChange={handleRatingChange}
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

function ContentTable({ 
  contentItems,
  currentPage,
  itemsPerPage,
  totalContent,
  onPageChange,
  onItemsPerPageChange,
  onContentClick,
  segments,
  onRatingChange
}: { 
  contentItems: ContentItem[]
  currentPage: number
  itemsPerPage: number
  totalContent: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (value: string) => void
  onContentClick: (content: ContentItem) => void
  segments: Array<{ id: string; name: string }>
  onRatingChange?: (contentId: string, rating: number) => void
}) {
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage
  const totalPages = Math.ceil(totalContent / itemsPerPage)
  
  // Función para truncar texto largo
  const truncateText = (text: string | null, maxLength: number = 30) => {
    if (!text || text.length <= maxLength) return text
    return `${text.substring(0, maxLength)}...`
  }

  const handleRatingChange = (contentId: string, rating: number) => {
    // Call parent callback if provided
    if (onRatingChange) {
      onRatingChange(contentId, rating);
    }
    
    // Update the rating in the database
    updateContent({
      contentId: contentId,
      title: contentItems.find(item => item.id === contentId)?.title || '',
      type: contentItems.find(item => item.id === contentId)?.type || 'blog_post',
      performance_rating: rating
    }).then(() => {
      toast.success("Performance rating updated", {
        position: "bottom-right",
        duration: 2000
      });
    }).catch(error => {
      console.error("Error updating rating:", error);
      toast.error("Failed to update rating");
    });
  };
  
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[45%]">Title</TableHead>
            <TableHead className="w-[12%]">Type</TableHead>
            <TableHead className="w-[10%]">Segment</TableHead>
            <TableHead className="w-[10%]">Status</TableHead>
            <TableHead className="w-[8%]">Created</TableHead>
            <TableHead className="w-[10%]">Performance</TableHead>
            <TableHead className="w-[5%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contentItems.length > 0 ? (
            contentItems.map((content) => (
              <TableRow 
                key={content.id}
                className="group hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => onContentClick(content)}
              >
                <TableCell>
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">{content.title}</p>
                    {content.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{content.description}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={`bg-primary/10 rounded-md flex items-center justify-center ${getContentTypeIconClass(content.type)}`} style={{ width: '24px', height: '24px' }}>
                      {CONTENT_TYPE_ICONS[content.type]}
                    </div>
                    <span className="text-sm">{getContentTypeName(content.type)}</span>
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  <div className="max-w-[120px] whitespace-nowrap overflow-hidden text-ellipsis">
                    {truncateText(getSegmentName(content.segment_id, segments), 20)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[content.status]}>
                    {content.status.charAt(0).toUpperCase() + content.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {new Date(content.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div onClick={(e) => e.stopPropagation()} className="scale-75 origin-left">
                    <StarRating 
                      rating={content.performance_rating}
                      onRatingChange={(rating) => handleRatingChange(content.id, rating)}
                      readonly={false}
                      size="sm"
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      onContentClick(content)
                    }}
                  >
                    <Eye className="h-4 w-4" />
                    <span className="sr-only">View</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center">
                No content found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between px-4 py-2 border-t">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{" "}
            <span className="font-medium">
              {Math.min(indexOfFirstItem + itemsPerPage, totalContent)}
            </span>{" "}
            of <span className="font-medium">{totalContent}</span> results
          </p>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={onItemsPerPageChange}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={itemsPerPage.toString()} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0 hover:bg-muted/50 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous page</span>
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(page)}
                className={`!min-w-0 h-8 w-8 p-0 font-medium transition-colors ${
                  currentPage === page 
                    ? "bg-gray-100 text-gray-900 hover:bg-gray-200"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {page}
              </Button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
            className="h-8 w-8 p-0 hover:bg-muted/50 disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next page</span>
          </Button>
        </div>
      </div>
    </Card>
  )
}

function ContentTableSkeleton() {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[45%]">Title</TableHead>
            <TableHead className="w-[12%]">Type</TableHead>
            <TableHead className="w-[10%]">Segment</TableHead>
            <TableHead className="w-[10%]">Status</TableHead>
            <TableHead className="w-[8%]">Created</TableHead>
            <TableHead className="w-[10%]">Performance</TableHead>
            <TableHead className="w-[5%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="space-y-0.5">
                  <Skeleton className="h-5 w-full max-w-[250px]" />
                  <Skeleton className="h-4 w-[200px]" />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-md" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-16 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="h-8 w-8 rounded-md ml-auto" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between px-4 py-2 border-t">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-8 w-[200px]" />
      </div>
    </Card>
  )
}

// Agreguemos un componente de filtros
function ContentFiltersDialog({ 
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
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
        
        <div className="space-y-4 py-2">
          {/* Status Filter */}
          <div className="border rounded-lg">
            <div 
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={() => toggleSection('status')}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Status</h3>
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
                          {status.name}
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
                <h3 className="font-medium">Content Type</h3>
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
                  <h3 className="font-medium">Segments</h3>
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
        
        <DialogFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={handleResetFilters} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button type="button" onClick={handleApplyFilters} className="gap-2">
            <Filter className="h-4 w-4" />
            Apply Filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ContentSkeleton() {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-fit">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-80">
            <div className="bg-background rounded-t-md p-3 border-b border-x border-t">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-8" />
              </div>
            </div>
            <div className="bg-muted/30 rounded-b-md border-b border-x p-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <Card key={j} className="mb-2">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-5 w-full mt-2" />
                    <Skeleton className="h-4 w-3/4 mt-1" />
                    <div className="flex items-center justify-between mt-3">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ContentPage() {
  const { currentSite } = useSite()
  const router = useRouter()
  const [contentItems, setContentItems] = useState<ContentItem[]>([])
  const [segments, setSegments] = useState<Array<{ id: string; name: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewType, setViewType] = useState<ViewType>('kanban')
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [filters, setFilters] = useState<ContentFilters>({
    status: [],
    type: [],
    segments: []
  })
  const [isFiltersDialogOpen, setIsFiltersDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredContent, setFilteredContent] = useState<ContentItem[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [totalContent, setTotalContent] = useState(0)
  const [campaigns, setCampaigns] = useState<Array<{id: string, title: string, description?: string}>>([])

  // Initialize command+k hook
  useCommandK()

  useEffect(() => {
    if (currentSite?.id) {
      refreshContentList()
      loadSegments()
      loadCampaigns()
    }
  }, [currentSite?.id])

  const refreshContentList = useCallback(async () => {
    if (!currentSite?.id) return

    setIsLoading(true)
    try {
      const result = await getContent(currentSite.id)
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      if (result.content) {
        setContentItems(result.content)
        setTotalContent(result.count)
        setFilteredContent(result.content)
        
        if (searchTerm || filters.status.length > 0 || filters.type.length > 0 || filters.segments.length > 0) {
          updateFilteredContent(searchTerm, filters, result.content)
        }
      }
    } catch (error) {
      console.error("Error fetching content:", error)
      toast.error("An error occurred while loading content")
    } finally {
      setIsLoading(false)
    }
  }, [currentSite?.id, searchTerm, filters])

  const loadSegments = async () => {
    if (!currentSite?.id) return

    try {
      const { segments, error } = await getSegments(currentSite.id)
      
      if (error) {
        toast.error("Failed to load segments: " + error)
        return
      }
      
      if (segments) {
        setSegments(segments.map(segment => ({
          id: segment.id,
          name: segment.name,
          description: segment.description
        })))
      }
    } catch (error) {
      console.error("Error loading segments:", error)
      toast.error("An error occurred while loading segments")
    }
  }

  const loadCampaigns = async () => {
    if (!currentSite?.id) return
    
    try {
      const response = await getCampaigns(currentSite.id)
      if (response.error) {
        console.error('Error loading campaigns:', response.error)
        setCampaigns([])
      } else {
        setCampaigns(response.data || [])
      }
    } catch (error) {
      console.error('Error loading campaigns:', error)
      setCampaigns([])
    }
  }

  const updateFilteredContent = (search: string, currentFilters: ContentFilters, items = contentItems) => {
    const searchLower = search.toLowerCase()
    
    // Debug para verificar si tenemos elementos de contenido
    console.log("Content items to filter:", items.length);
    
    const filtered = items.filter(item => {
      // Filtrar por término de búsqueda
      const matchesSearch = search === '' || 
        item.title.toLowerCase().includes(searchLower) ||
        (item.description && item.description.toLowerCase().includes(searchLower))
      
      // Filtrar por estado
      const matchesStatus = currentFilters.status.length === 0 || 
        currentFilters.status.includes(item.status)
      
      // Filtrar por tipo de contenido
      const matchesType = currentFilters.type.length === 0 || 
        currentFilters.type.includes(item.type)
      
      // Filtrar por segmento
      const matchesSegment = currentFilters.segments.length === 0 || 
        (item.segment_id && currentFilters.segments.includes(item.segment_id))
      
      return matchesSearch && matchesStatus && matchesType && matchesSegment
    })
    
    // Debug para verificar resultados filtrados
    console.log("Filtered content items:", filtered.length);
    
    setFilteredContent(filtered)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value
    setSearchTerm(newSearchTerm)
    updateFilteredContent(newSearchTerm, filters)
  }

  const handleFiltersChange = (newFilters: ContentFilters) => {
    setFilters(newFilters)
    updateFilteredContent(searchTerm, newFilters)
  }

  const handleUpdateContentStatus = async (contentId: string, newStatus: string) => {
    try {
      const result = await updateContentStatus({
        contentId,
        status: newStatus as any
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      // Update local state
      setContentItems(prev => 
        prev.map(item => 
          item.id === contentId 
            ? { 
                ...item, 
                status: newStatus as any,
                updated_at: new Date().toISOString(),
                ...(newStatus === 'published' ? { published_at: new Date().toISOString() } : {})
              } 
            : item
        )
      )

      toast.success(`Content status updated to ${newStatus}`)
    } catch (error) {
      console.error("Error updating content status:", error)
      toast.error("Failed to update content status")
    }
  }

  const handleContentClick = (content: ContentItem) => {
    router.push(`/content/${content.id}`)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value))
    setCurrentPage(1)
  }

  // Handle content rating changes
  const handleContentRatingChange = (contentId: string, rating: number) => {
    // Update the content items array
    setContentItems(prevItems => 
      prevItems.map(item => 
        item.id === contentId 
          ? { ...item, performance_rating: rating } 
          : item
      )
    );
    
    // Also update the filtered content
    setFilteredContent(prevItems => 
      prevItems.map(item => 
        item.id === contentId 
          ? { ...item, performance_rating: rating } 
          : item
      )
    );
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center space-y-4">
          <p className="text-red-500 mb-4">{error}</p>
          <Button 
            variant="outline" 
            onClick={() => safeReload(false, 'Error recovery')}
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  const emptyState = (
    <EmptyState
      icon={<FileText className="h-12 w-12 text-primary/60" />}
      title="No content yet"
      description="Create and manage your content for different segments and channels."
      features={[
        {
          title: "Content Types",
          items: [
            "Blog posts",
            "Newsletters",
            "Social media",
            "Landing pages"
          ]
        },
        {
          title: "Workflow",
          items: [
            "Draft to published",
            "Segment targeting",
            "Performance tracking"
          ]
        }
      ]}
      hint='Click "New Content" to create your first content item'
    />
  )

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="all">
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                <TabsList>
                  <TabsTrigger value="all">
                    All Content
                    <Badge variant="secondary" className="ml-2 bg-muted">
                      {contentItems.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="blog_post">
                    Blog Posts
                    <Badge variant="secondary" className="ml-2 bg-muted">
                      {contentItems.filter(item => item.type === 'blog_post').length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="video">
                    Videos
                    <Badge variant="secondary" className="ml-2 bg-muted">
                      {contentItems.filter(item => item.type === 'video').length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="social_post">
                    Social Media
                    <Badge variant="secondary" className="ml-2 bg-muted">
                      {contentItems.filter(item => item.type === 'social_post').length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="ad">
                    Ads
                    <Badge variant="secondary" className="ml-2 bg-muted">
                      {contentItems.filter(item => item.type === 'ad').length}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
                <div className="relative w-64">
                  <Input
                    data-command-k-input
                    type="text"
                    placeholder="Search content..."
                    className="w-full pl-8 pr-12"
                    value={searchTerm}
                    onChange={handleSearchChange}
                  />
                  <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                      <span className="text-xs">⌘</span>K
                    </kbd>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsFiltersDialogOpen(true)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                  {(filters.status.length > 0 || filters.type.length > 0 || filters.segments.length > 0) && (
                    <Badge variant="secondary" className="ml-2">
                      {filters.status.length + filters.type.length + filters.segments.length}
                    </Badge>
                  )}
                </Button>
              </div>
              <div className="ml-auto">
                <ViewSelector 
                  currentView={viewType} 
                  onViewChange={(view) => setViewType(view)}
                />
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div className="p-8 space-y-4">
          <div className="px-8">
            <TabsContent value="all" className="space-y-4">
              {isLoading ? (
                viewType === 'kanban' ? <ContentSkeleton /> : <ContentTableSkeleton />
              ) : filteredContent.length === 0 ? (
                emptyState
              ) : viewType === 'kanban' ? (
                <ContentKanban 
                  contentItems={filteredContent}
                  onUpdateContentStatus={handleUpdateContentStatus}
                  segments={segments}
                  onContentClick={handleContentClick}
                  onRatingChange={handleContentRatingChange}
                />
              ) : (
                <ContentTable 
                  contentItems={filteredContent}
                  currentPage={currentPage}
                  itemsPerPage={itemsPerPage}
                  totalContent={filteredContent.length}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                  onContentClick={handleContentClick}
                  segments={segments}
                  onRatingChange={handleContentRatingChange}
                />
              )}
            </TabsContent>
            
            <TabsContent value="blog_post" className="space-y-4">
              {isLoading ? (
                viewType === 'kanban' ? <ContentSkeleton /> : <ContentTableSkeleton />
              ) : filteredContent.filter(item => item.type === 'blog_post').length === 0 ? (
                emptyState
              ) : viewType === 'kanban' ? (
                <ContentKanban 
                  contentItems={filteredContent.filter(item => item.type === 'blog_post')}
                  onUpdateContentStatus={handleUpdateContentStatus}
                  segments={segments}
                  onContentClick={handleContentClick}
                  onRatingChange={handleContentRatingChange}
                />
              ) : (
                <ContentTable 
                  contentItems={filteredContent.filter(item => item.type === 'blog_post')}
                  currentPage={currentPage}
                  itemsPerPage={itemsPerPage}
                  totalContent={filteredContent.filter(item => item.type === 'blog_post').length}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                  onContentClick={handleContentClick}
                  segments={segments}
                  onRatingChange={handleContentRatingChange}
                />
              )}
            </TabsContent>
            
            <TabsContent value="video" className="space-y-4">
              {isLoading ? (
                viewType === 'kanban' ? <ContentSkeleton /> : <ContentTableSkeleton />
              ) : filteredContent.filter(item => item.type === 'video').length === 0 ? (
                emptyState
              ) : viewType === 'kanban' ? (
                <ContentKanban 
                  contentItems={filteredContent.filter(item => item.type === 'video')}
                  onUpdateContentStatus={handleUpdateContentStatus}
                  segments={segments}
                  onContentClick={handleContentClick}
                  onRatingChange={handleContentRatingChange}
                />
              ) : (
                <ContentTable 
                  contentItems={filteredContent.filter(item => item.type === 'video')}
                  currentPage={currentPage}
                  itemsPerPage={itemsPerPage}
                  totalContent={filteredContent.filter(item => item.type === 'video').length}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                  onContentClick={handleContentClick}
                  segments={segments}
                  onRatingChange={handleContentRatingChange}
                />
              )}
            </TabsContent>
            
            <TabsContent value="social_post" className="space-y-4">
              {isLoading ? (
                viewType === 'kanban' ? <ContentSkeleton /> : <ContentTableSkeleton />
              ) : filteredContent.filter(item => item.type === 'social_post').length === 0 ? (
                emptyState
              ) : viewType === 'kanban' ? (
                <ContentKanban 
                  contentItems={filteredContent.filter(item => item.type === 'social_post')}
                  onUpdateContentStatus={handleUpdateContentStatus}
                  segments={segments}
                  onContentClick={handleContentClick}
                  onRatingChange={handleContentRatingChange}
                />
              ) : (
                <ContentTable 
                  contentItems={filteredContent.filter(item => item.type === 'social_post')}
                  currentPage={currentPage}
                  itemsPerPage={itemsPerPage}
                  totalContent={filteredContent.filter(item => item.type === 'social_post').length}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                  onContentClick={handleContentClick}
                  segments={segments}
                  onRatingChange={handleContentRatingChange}
                />
              )}
            </TabsContent>
            
            <TabsContent value="ad" className="space-y-4">
              {isLoading ? (
                viewType === 'kanban' ? <ContentSkeleton /> : <ContentTableSkeleton />
              ) : filteredContent.filter(item => item.type === 'ad').length === 0 ? (
                emptyState
              ) : viewType === 'kanban' ? (
                <ContentKanban 
                  contentItems={filteredContent.filter(item => item.type === 'ad')}
                  onUpdateContentStatus={handleUpdateContentStatus}
                  segments={segments}
                  onContentClick={handleContentClick}
                  onRatingChange={handleContentRatingChange}
                />
              ) : (
                <ContentTable 
                  contentItems={filteredContent.filter(item => item.type === 'ad')}
                  currentPage={currentPage}
                  itemsPerPage={itemsPerPage}
                  totalContent={filteredContent.filter(item => item.type === 'ad').length}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                  onContentClick={handleContentClick}
                  segments={segments}
                  onRatingChange={handleContentRatingChange}
                />
              )}
            </TabsContent>
          </div>
        </div>
      </Tabs>
      
      {/* Content Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="sm:max-w-full">
          <SheetHeader>
            <SheetTitle>Content Details</SheetTitle>
          </SheetHeader>
          {selectedContent && (
            <ContentDetail 
              content={selectedContent} 
              onClose={() => {
                setIsDetailOpen(false);
                refreshContentList();
              }}
              segments={segments}
              onRatingChange={handleContentRatingChange}
            />
          )}
        </SheetContent>
      </Sheet>
      
      {/* Filters Dialog */}
      <ContentFiltersDialog 
        isOpen={isFiltersDialogOpen}
        onOpenChange={setIsFiltersDialogOpen}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        segments={segments}
      />
      
      <CreateContentDialog 
        segments={segments}
        campaigns={campaigns}
        onSuccess={refreshContentList}
      />
    </div>
  )
} 