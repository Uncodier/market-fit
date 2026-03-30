"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { SearchInput } from "@/app/components/ui/search-input"
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
  ChevronDown,
  Target,
  Microscope,
  Megaphone,
  ListOrdered,
  Check
} from "@/app/components/ui/icons"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/app/components/ui/dropdown-menu"
import { Switch } from "@/app/components/ui/switch"
import { DatePicker } from "@/app/components/ui/date-picker"
import { Pagination } from "@/app/components/ui/pagination"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { useSite } from "@/app/context/SiteContext"
import { getContent, createContent, updateContentStatus, updateContent, type ContentItem } from "./actions"
import { fetchOutstandPosts, publishOutstandPost } from "./outstand"
import { createAsset, getContentAssetsByContentIds, type ContentAssetWithDetails } from "@/app/assets/actions"
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

import { Table, TableHeader, TableBody, TableCell, TableRow, TableHead } from "@/app/components/ui/table"
import { useRouter } from "next/navigation"
import { navigateToContent } from "@/app/hooks/use-navigation-history"
import { CreateContentDialog } from "./components"
import { getContentTypeName, getSegmentName, getContentTypeIconClass, getCampaignName } from "./utils"
import { StarRating } from "@/app/components/ui/rating"
import { useCommandK } from "@/app/hooks/use-command-k"
import { safeReload } from "@/app/utils/safe-reload"
import { TrendsSection, TrendsColumn } from "@/app/components/trends"
import { cn } from "@/lib/utils"
import { useLocalization } from "@/app/context/LocalizationContext"

const CONTENT_STATUSES = [
  { id: 'draft' },
  { id: 'review' },
  { id: 'approved' },
  { id: 'published' },
  { id: 'archived' }
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
  onPublish?: (content: ContentItem) => void
}

function ContentDetail({ content, onClose, segments, onRatingChange, onPublish }: ContentDetailProps) {
  const { t } = useLocalization()
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
      performance_rating: rating,
      skipRevalidation: true // Prevent automatic page refresh
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
    if (!dateString) return t('content.detail.notSet')
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
      toast.success(t('content.toast.contentUpdated'))
      // Close the panel to refresh the content
      onClose()
    } catch (error) {
      console.error("Error updating content:", error)
      toast.error(t('content.toast.contentFailed'))
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
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-xl font-semibold">Content Details</h2>
        <div className="flex gap-2">
          {onPublish && (
            <Button size="sm" onClick={() => onPublish(content)}>
              <Globe className="w-4 h-4 mr-2" /> Publish to Social
            </Button>
          )}
        </div>
      </div>
      <SheetHeader className="pb-6">
        {isEditing ? (
          <div className="mt-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-md flex items-center justify-center mt-4" style={{ width: '48px', height: '48px' }}>
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">{t('content.detail.title')}</p>
                <Input
                  value={editForm.title}
                  onChange={(e: any) => setEditForm({...editForm, title: e.target.value})}
                  className="h-12 text-sm font-semibold"
                  placeholder={t('content.detail.titlePlaceholder')}
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
            {t('content.detail.contentInfo')}
          </h3>
          
          <div className="grid gap-4">
            <div className="flex items-center gap-3">
              <div className={`bg-primary/10 rounded-md flex items-center justify-center ${getContentTypeIconClass(content.type)}`} style={{ width: '48px', height: '48px' }}>
                {CONTENT_TYPE_ICONS[content.type]}
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-[5px]">{t('content.detail.contentType')}</p>
                {isEditing ? (
                  <Select 
                    value={editForm.type} 
                    onValueChange={(value: "blog_post" | "video" | "podcast" | "social_post" | "newsletter" | "case_study" | "whitepaper" | "infographic" | "webinar" | "ebook" | "ad" | "landing_page") => setEditForm({...editForm, type: value})}
                  >
                    <SelectTrigger className="h-12 text-sm">
                      <SelectValue placeholder={t('content.detail.selectType')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blog_post">{t('content.types.blog_post')}</SelectItem>
                      <SelectItem value="video">{t('content.types.video')}</SelectItem>
                      <SelectItem value="podcast">{t('content.types.podcast')}</SelectItem>
                      <SelectItem value="social_post">{t('content.types.social_post')}</SelectItem>
                      <SelectItem value="newsletter">{t('content.types.newsletter')}</SelectItem>
                      <SelectItem value="case_study">{t('content.types.case_study')}</SelectItem>
                      <SelectItem value="whitepaper">{t('content.types.whitepaper')}</SelectItem>
                      <SelectItem value="infographic">{t('content.types.infographic')}</SelectItem>
                      <SelectItem value="webinar">{t('content.types.webinar')}</SelectItem>
                      <SelectItem value="ebook">{t('content.types.ebook')}</SelectItem>
                      <SelectItem value="ad">{t('content.types.ad')}</SelectItem>
                      <SelectItem value="landing_page">{t('content.types.landing_page')}</SelectItem>
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
                <p className="text-xs text-muted-foreground mb-[5px]">{t('content.detail.status')}</p>
                <Badge className={STATUS_COLORS[content.status]}>
                  {t(`content.status.${content.status}`)}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-[5px]">{t('content.detail.segment')}</p>
                {isEditing ? (
                  <Select value={editForm.segment_id} onValueChange={(value) => setEditForm({...editForm, segment_id: value})}>
                    <SelectTrigger className="h-12 text-sm">
                      <SelectValue placeholder={t('content.detail.selectSegment')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('content.detail.noSegment')}</SelectItem>
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
                <p className="text-xs text-muted-foreground mb-[5px]">{t('content.detail.description')}</p>
                {isEditing ? (
                  <Textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    className="min-h-[80px] text-sm"
                    placeholder={t('content.detail.descriptionPlaceholder')}
                  />
                ) : (
                  <p className="text-sm">{content.description || t('content.detail.noDescription')}</p>
                )}
              </div>
            </div>
            
            {/* Performance Rating */}
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                <BarChart className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-[5px]">{t('content.detail.performanceRating')}</p>
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
                    <p className="text-xs text-muted-foreground mb-[5px]">{t('content.detail.wordCount')}</p>
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
                    <p className="text-xs text-muted-foreground mb-[5px]">{t('content.detail.readingTime')}</p>
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
                    <p className="text-xs text-muted-foreground mb-[5px]">{t('content.detail.seoScore')}</p>
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
                <p className="text-xs text-muted-foreground mb-[5px]">{t('content.detail.created')}</p>
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
                <p className="text-xs text-muted-foreground mb-[5px]">{t('content.detail.updated')}</p>
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
                  <p className="text-xs text-muted-foreground mb-[5px]">{t('content.detail.published')}</p>
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
                  onChange={(e: any) => setTagInput(e.target.value)}
                  placeholder={t('content.detail.addTag')}
                  className="h-10"
                  onKeyDown={(e: any) => {
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
                  <p className="text-sm text-muted-foreground">{t('content.detail.noTagsYet')}</p>
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

      <div className="mt-8 flex flex-col gap-3 pb-8">
        {isEditing ? (
          <div className="grid grid-cols-2 gap-3 w-full">
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
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 w-full">
            <Button onClick={() => setIsEditing(true)} variant="outline" className="w-full">
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button onClick={onClose} variant="secondary" className="w-full">
              <X className="mr-2 h-4 w-4" />
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function ContentCard({ content, segments, campaigns, onClick, onRatingChange, isLoadingCampaigns, assets = [], outstandPosts }: { 
  content: ContentItem, 
  segments: Array<{ id: string; name: string }>,
  campaigns: Array<{ id: string; title: string }>,
  onClick: (content: ContentItem) => void,
  onRatingChange?: (contentId: string, rating: number) => void,
  isLoadingCampaigns?: boolean,
  assets?: ContentAssetWithDetails[],
  outstandPosts?: any[]
}) {
  const getNetworkIcon = (network: string) => {
    switch(network.toLowerCase()) {
      case 'linkedin':
      case 'linkedin_profile':
      case 'linkedin_page':
        return <svg className="w-4 h-4 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>;
      case 'facebook':
      case 'facebook_page':
        return <svg className="w-4 h-4 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd"/></svg>;
      case 'x':
      case 'twitter':
        return <svg className="w-3.5 h-3.5 text-gray-900 dark:text-gray-100" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
      case 'instagram':
        return <svg className="w-4 h-4 text-[#E1306C]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd"/></svg>;
      case 'tiktok':
        return <svg className="w-4 h-4 text-gray-900 dark:text-gray-100" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 2.22-1.15 4.54-2.97 5.86-1.53 1.1-3.53 1.4-5.38.99-1.83-.41-3.41-1.73-4.14-3.45-.73-1.74-.6-3.79.3-5.39.95-1.68 2.76-2.73 4.69-2.83V16.1c-.81.04-1.62.24-2.28.73-.66.5-1.08 1.26-1.19 2.08-.13.91.13 1.88.75 2.51.62.63 1.58.9 2.48.79.88-.11 1.65-.67 2.02-1.45.35-.74.37-1.6.38-2.43V0h3.5v.02z"/></svg>;
      default:
        return <Globe className="w-4 h-4 text-muted-foreground" />;
    }
  }

  // Define Table view specific network icon renderer
  const getTableNetworkIcon = (network: string) => {
    switch(network.toLowerCase()) {
      case 'linkedin':
      case 'linkedin_profile':
      case 'linkedin_page':
        return <svg className="w-3.5 h-3.5 text-[#0A66C2] shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>;
      case 'facebook':
      case 'facebook_page':
        return <svg className="w-3.5 h-3.5 text-[#1877F2] shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd"/></svg>;
      case 'x':
      case 'twitter':
        return <svg className="w-3.5 h-3.5 text-gray-900 dark:text-gray-100 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
      case 'instagram':
        return <svg className="w-3.5 h-3.5 text-[#E1306C] shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd"/></svg>;
      case 'tiktok':
        return <svg className="w-3.5 h-3.5 text-gray-900 dark:text-gray-100 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 2.22-1.15 4.54-2.97 5.86-1.53 1.1-3.53 1.4-5.38.99-1.83-.41-3.41-1.73-4.14-3.45-.73-1.74-.6-3.79.3-5.39.95-1.68 2.76-2.73 4.69-2.83V16.1c-.81.04-1.62.24-2.28.73-.66.5-1.08 1.26-1.19 2.08-.13.91.13 1.88.75 2.51.62.63 1.58.9 2.48.79.88-.11 1.65-.67 2.02-1.45.35-.74.37-1.6.38-2.43V0h3.5v.02z"/></svg>;
      default:
        return <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
    }
  }

  const [carouselIndex, setCarouselIndex] = useState(0)
  const displayAssets = content.id.startsWith('outstand-') 
    ? content.assets || [] 
    : assets.filter((a) => a.file_type.startsWith("image/"))
  const mainAsset = displayAssets.find((a) => a.is_primary) || displayAssets[0]
  const hasCarousel = displayAssets.length > 1

  // Check if content matches any Outstand social post or was published from our app
  const hasPublishedTags = content.tags?.some(t => t.startsWith('published_'));
  const isOutstandPost = hasPublishedTags || (outstandPosts && content.type === 'social_post' && ['published', 'approved', 'draft'].includes(content.status)
    ? outstandPosts.some(post => {
        if (content.tags?.includes(`outstand_id_${post.id}`)) return true;
        const postText = post.containers?.[0]?.content || post.text || '';
        // Basic match check - can be enhanced based on how Outstand links to our content
        return postText && content.title && (
          postText.includes(content.title) || 
          (content.description && postText.includes(content.description.substring(0, 50)))
        );
      })
    : content.id.startsWith('outstand-'));

  // Get platforms if it is an outstand post
  let outstandPlatforms: string[] = []
  if (content.id.startsWith('outstand-')) {
    const post = outstandPosts?.find(p => `outstand-${p.id}` === content.id);
    outstandPlatforms = post?.socialAccounts?.map((a: any) => a.network || (typeof a === 'string' ? a : null)).filter(Boolean) || []
  } else if (isOutstandPost) {
    outstandPlatforms = Array.from(new Set(outstandPosts?.filter(p => {
      if (content.tags?.includes(`outstand_id_${p.id}`)) return true;
      const postText = p.containers?.[0]?.content || p.text || '';
      return postText && content.title && (postText.includes(content.title) || (content.description && postText.includes(content.description.substring(0, 50))));
    })
    .flatMap(p => p.socialAccounts?.map((a: any) => a.network || (typeof a === 'string' ? a : null)) || [p.social_account?.network])
    .filter(Boolean)))
  }

  // Always include platforms from published tags
  if (hasPublishedTags) {
    const publishedTags = content.tags
      ?.filter(t => t.startsWith('published_'))
      .map(t => t.replace('published_', '')) || [];
    if (publishedTags.length > 0) {
      outstandPlatforms = Array.from(new Set([...outstandPlatforms, ...publishedTags]));
    }
  }

  // Filter out any unmapped or duplicate platform fallbacks which might cause the default Globe icon
  outstandPlatforms = outstandPlatforms.filter(p => 
    p && 
    p !== 'undefined' && 
    p !== 'null' && 
    typeof p === 'string' &&
    !p.match(/^[0-9]+$/) // Filter out pure numeric strings (like IDs: "101600695973502")
  );

  useEffect(() => {
    if (!hasCarousel || displayAssets.length === 0) return
    const t = setInterval(() => {
      setCarouselIndex((i) => (i + 1) % displayAssets.length)
    }, 3000)
    return () => clearInterval(t)
  }, [hasCarousel, displayAssets.length])

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
    
    // Update the rating in the database without revalidation to avoid refresh
    updateContent({
      contentId: content.id,
      title: content.title,
      type: content.type,
      performance_rating: rating,
      skipRevalidation: true // Prevent automatic page refresh
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
      className="mb-2 cursor-pointer transition-shadow duration-200 hover:shadow-md"
      onClick={() => onClick(content)}
    >
      <CardContent className="p-0">
        {(mainAsset || (hasCarousel && displayAssets[carouselIndex])) ? (
          <div className="relative aspect-square w-full overflow-hidden rounded-t-md bg-muted">
            <img
              src={(hasCarousel ? displayAssets[carouselIndex] : mainAsset)?.file_path || undefined}
              alt=""
              className="w-full h-full object-cover"
            />
            {hasCarousel && (
              <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1">
                {displayAssets.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 rounded-full w-1 ${i === carouselIndex ? "bg-primary" : "bg-muted-foreground/40"}`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}
        <div className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex gap-3 items-start">
            <div className={`bg-primary/10 rounded-md flex items-center justify-center min-w-[39px] ${getContentTypeIconClass(content.type)}`} style={{ width: '39px', height: '39px' }}>
              {CONTENT_TYPE_ICONS[content.type]}
            </div>
            <div className="flex flex-col">
              <h3 className="text-sm font-medium line-clamp-1 mt-0.5">{content.title}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground">{getContentTypeName(content.type)}</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">{formattedDate}</span>
              </div>
              
              {isOutstandPost && (
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {outstandPlatforms.length > 0 ? (
                    outstandPlatforms.map((network, index) => (
                      <div key={index} title={network} className="shrink-0 flex items-center justify-center bg-muted/50 rounded-md w-6 h-6 border border-border/50">
                        {getNetworkIcon(network)}
                      </div>
                    ))
                  ) : (
                    <div title="Published in Social" className="shrink-0 flex items-center justify-center bg-muted/50 rounded-md w-6 h-6 border border-border/50">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {content.description && (
          <p className="text-xs text-muted-foreground mt-2 mb-2 line-clamp-2">{content.description}</p>
        )}
        
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {segmentName && (
              <Badge variant="outline" className="text-xs whitespace-nowrap overflow-hidden text-ellipsis pr-3 max-w-[180px] flex items-center block">
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                  {segmentName}
                </span>
              </Badge>
            )}
            {content.word_count && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">{content.word_count} words</span>
            )}
          </div>
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="flex-shrink-0 flex items-center justify-end scale-75 origin-right"
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
        
        {/* Campaign information - similar to requirements kanban */}
        {content.campaign_id && (
          <div className="flex mt-2 border-t pt-2">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <Target className="h-3 w-3 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              {isLoadingCampaigns ? (
                <Skeleton className="h-5 w-24 rounded-full" />
              ) : (
                <span className="px-1.5 py-0.5 text-xs rounded-full bg-purple-100/20 text-purple-600 dark:text-purple-400 border border-purple-300/30 overflow-hidden text-ellipsis whitespace-nowrap max-w-full inline-block">
                  {getCampaignName(content.campaign_id, campaigns)}
                </span>
              )}
            </div>
          </div>
        )}
        </div>
      </CardContent>
    </Card>
  )
}

function ContentKanban({ 
  contentItems, 
  onUpdateContentStatus, 
  segments, 
  campaigns,
  onContentClick,
  onRatingChange,
  isLoadingCampaigns,
  assetsByContentId = {},
  outstandPosts,
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
    <div className="w-full h-full flex flex-col justify-start flex-1 min-h-0 self-stretch flex-grow min-w-0">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 min-w-fit items-start pt-0 mt-0 flex-1 flex-row w-full h-full min-h-0 items-stretch self-stretch flex-grow min-w-0">
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
                                assets={assetsByContentId[item.id] || []}
                                outstandPosts={status.id === 'published' ? outstandPosts : undefined}
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
  campaigns,
  onRatingChange,
  assetsByContentId = {},
  outstandPosts
}: { 
  contentItems: ContentItem[]
  currentPage: number
  itemsPerPage: number
  totalContent: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (value: string) => void
  onContentClick: (content: ContentItem) => void
  segments: Array<{ id: string; name: string }>
  campaigns: Array<{ id: string; title: string }>
  onRatingChange?: (contentId: string, rating: number) => void
  assetsByContentId?: Record<string, ContentAssetWithDetails[]>
  outstandPosts?: any[]
}) {
  const { t } = useLocalization()
  const [statusPages, setStatusPages] = useState<Record<string, number>>(() => {
    const initialPages: Record<string, number> = {}
    CONTENT_STATUSES.forEach(status => {
      initialPages[status.id] = 1
    })
    return initialPages
  })
  
  const [statusItemsPerPage, setStatusItemsPerPage] = useState(5) // Smaller per-section pagination
  
  // Group content items by status
  const groupedContent = React.useMemo(() => {
    const groups: Record<string, ContentItem[]> = {}
    
    // Initialize all statuses with empty arrays
    CONTENT_STATUSES.forEach(status => {
      groups[status.id] = []
    })
    
    // Group content items by status
    contentItems.forEach(item => {
      if (groups[item.status]) {
        groups[item.status].push(item)
      }
    })
    
    return groups
  }, [contentItems])

  const handleRatingChange = (contentId: string, rating: number) => {
    // Call parent callback if provided
    if (onRatingChange) {
      onRatingChange(contentId, rating);
    }
    
    // Update the rating in the database without revalidation to avoid refresh
    updateContent({
      contentId: contentId,
      title: contentItems.find(item => item.id === contentId)?.title || '',
      type: contentItems.find(item => item.id === contentId)?.type || 'blog_post',
      performance_rating: rating,
      skipRevalidation: true // Prevent automatic page refresh
    }).then(() => {
      toast.success(t('content.toast.ratingUpdated'), {
        position: "bottom-right",
        duration: 2000
      });
    }).catch(error => {
      console.error("Error updating rating:", error);
      toast.error(t('content.toast.ratingFailed'));
    });
  };

  const handleStatusPageChange = (statusId: string, page: number) => {
    setStatusPages(prev => ({
      ...prev,
      [statusId]: page
    }))
  }

  const handleStatusItemsPerPageChange = (value: string) => {
    setStatusItemsPerPage(parseInt(value))
    // Reset all status pages to 1 when changing items per page
    const resetPages: Record<string, number> = {}
    CONTENT_STATUSES.forEach(status => {
      resetPages[status.id] = 1
    })
    setStatusPages(resetPages)
  }

  // Function to get paginated items for a specific status
  const getPaginatedStatusItems = (statusId: string, statusItems: ContentItem[]) => {
    const currentPage = statusPages[statusId] || 1
    const startIndex = (currentPage - 1) * statusItemsPerPage
    const endIndex = startIndex + statusItemsPerPage
    return statusItems.slice(startIndex, endIndex)
  }

  // Function to get total pages for a status
  const getStatusTotalPages = (statusItems: ContentItem[]) => {
    return Math.ceil(statusItems.length / statusItemsPerPage)
  }
  
  return (
    <div className="space-y-6">
      {CONTENT_STATUSES.map(status => {
        const statusItems = groupedContent[status.id] || []
        
        if (statusItems.length === 0) return null
        
        const paginatedItems = getPaginatedStatusItems(status.id, statusItems)
        const totalPages = getStatusTotalPages(statusItems)
        const currentPage = statusPages[status.id] || 1
        const startIndex = (currentPage - 1) * statusItemsPerPage
        
        return (
          <div key={status.id} className="space-y-3">
            {/* Status Header */}
            <div className="flex items-center gap-3 px-1">
              <h3 className="text-lg font-semibold text-foreground">{t(`content.status.${status.id}`)}</h3>
              <Badge variant="outline" className="text-sm">
                {statusItems.length} {statusItems.length === 1 ? (t('content.item') || 'item') : (t('content.items') || 'items')}
              </Badge>
            </div>
            
            {/* Status Table */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[64px] min-w-[64px] max-w-[64px]">{t('content.table.asset')}</TableHead>
                    <TableHead className="min-w-[200px]">{t('content.table.title')}</TableHead>
                    <TableHead className="w-[130px] min-w-[130px] max-w-[130px]">{t('content.table.segment')}</TableHead>
                    <TableHead className="w-[140px] min-w-[140px] max-w-[140px]">{t('content.table.campaign')}</TableHead>
                    <TableHead className="w-[120px] min-w-[120px] max-w-[120px]">{t('content.table.performance')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((content) => {
                    const contentAssets = assetsByContentId[content.id] || []
                    const displayAssets = content.id.startsWith('outstand-') 
                      ? content.assets || []
                      : contentAssets.filter((a) => a.file_type.startsWith("image/"))
                    const mainAsset = displayAssets.find((a) => a.is_primary) || displayAssets[0]
                    
                    const hasPublishedTags = content.tags?.some(t => t.startsWith('published_'));
                    const isOutstandPost = hasPublishedTags || (outstandPosts && content.type === 'social_post' && ['published', 'approved', 'draft'].includes(content.status)
                      ? outstandPosts.some(post => {
                          if (content.tags?.includes(`outstand_id_${post.id}`)) return true;
                          const postText = post.containers?.[0]?.content || post.text || '';
                          return postText && content.title && (
                            postText.includes(content.title) || 
                            (content.description && postText.includes(content.description.substring(0, 50)))
                          );
                        })
                      : content.id.startsWith('outstand-'));

                    // Get platforms if it is an outstand post
                    let outstandPlatforms: string[] = []
                    if (content.id.startsWith('outstand-')) {
                      const post = outstandPosts?.find(p => `outstand-${p.id}` === content.id);
                      outstandPlatforms = post?.socialAccounts?.map((a: any) => a.network || (typeof a === 'string' ? a : null)).filter(Boolean) || []
                    } else if (isOutstandPost) {
                      outstandPlatforms = Array.from(new Set(outstandPosts?.filter(p => {
                        if (content.tags?.includes(`outstand_id_${p.id}`)) return true;
                        const postText = p.containers?.[0]?.content || p.text || '';
                        return postText && content.title && (postText.includes(content.title) || (content.description && postText.includes(content.description.substring(0, 50))));
                      })
                      .flatMap(p => p.socialAccounts?.map((a: any) => a.network || (typeof a === 'string' ? a : null)) || [p.social_account?.network])
                      .filter(Boolean)))
                    }

                    // Always include platforms from published tags
                    if (hasPublishedTags) {
                      const publishedTags = content.tags
                        ?.filter(t => t.startsWith('published_'))
                        .map(t => t.replace('published_', '')) || [];
                      if (publishedTags.length > 0) {
                        outstandPlatforms = Array.from(new Set([...outstandPlatforms, ...publishedTags]));
                      }
                    }

                    // Filter out any unmapped or duplicate platform fallbacks which might cause the default Globe icon
                    outstandPlatforms = outstandPlatforms.filter(p => 
                      p && 
                      p !== 'undefined' && 
                      p !== 'null' && 
                      typeof p === 'string' &&
                      !p.match(/^[0-9]+$/) // Filter out pure numeric strings (like IDs: "101600695973502")
                    );
                    
                    return (
                    <TableRow 
                      key={content.id}
                      className="group hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => onContentClick(content)}
                    >
                      <TableCell className="relative w-[64px] min-w-[64px] max-w-[64px] !p-0 align-top">
                        <div className="absolute inset-0 w-full h-full overflow-hidden bg-muted">
                          {mainAsset ? (
                            <img
                              src={mainAsset.file_path || undefined}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 p-1 text-center">
                              {CONTENT_TYPE_ICONS[content.type]}
                              <span className="text-[10px] leading-tight text-muted-foreground line-clamp-2">
                                {getContentTypeName(content.type)}
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm line-clamp-2" title={content.title}>{content.title}</p>
                          </div>
                          {content.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2" title={content.description}>{content.description}</p>
                          )}
                          {isOutstandPost && (
                            <div className="flex items-center gap-1 shrink-0 mt-1">
                              {outstandPlatforms.length > 0 ? (
                                outstandPlatforms.map((network, index) => (
                                  <div key={index} title={network} className="shrink-0 flex items-center justify-center bg-muted/50 rounded-md w-5 h-5 border border-border/50">
                                    {getTableNetworkIcon(network)}
                                  </div>
                                ))
                              ) : (
                                <div title="Published in Social" className="shrink-0 flex items-center justify-center bg-muted/50 rounded-md w-5 h-5 border border-border/50">
                                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="line-clamp-2" title={getSegmentName(content.segment_id, segments)}>
                          {getSegmentName(content.segment_id, segments)}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="line-clamp-2" title={getCampaignName(content.campaign_id, campaigns)}>
                          {getCampaignName(content.campaign_id, campaigns)}
                        </div>
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
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
              
              {/* Individual Status Pagination */}
              {statusItems.length > statusItemsPerPage && (
                <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      Showing <span className="font-medium">{startIndex + 1}</span> to{" "}
                      <span className="font-medium">
                        {Math.min(startIndex + statusItemsPerPage, statusItems.length)}
                      </span>{" "}
                      of <span className="font-medium">{statusItems.length}</span> items
                    </p>
                  </div>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={(page) => handleStatusPageChange(status.id, page)}
                    maxVisiblePages={5}
                  />
                </div>
              )}
            </Card>
          </div>
        )
      })}
      
      {/* Global Settings */}
      {contentItems.length > 0 && (
        <Card className="mt-6">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                Total: <span className="font-medium">{totalContent}</span> content items
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Items per section:</span>
              <Select
                value={statusItemsPerPage.toString()}
                onValueChange={handleStatusItemsPerPageChange}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={statusItemsPerPage.toString()} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

function ContentTableSkeleton() {
  const { t } = useLocalization()
  return (
    <div className="space-y-6">
      {/* Simulate multiple status sections */}
      {Array.from({ length: 3 }).map((_, statusIndex) => (
        <div key={statusIndex} className="space-y-3">
          {/* Status Header Skeleton */}
          <div className="flex items-center gap-3 px-1">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          
          {/* Status Table Skeleton */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">{t('content.table.title')}</TableHead>
                  <TableHead className="w-[100px] min-w-[100px] max-w-[100px]">{t('content.table.type')}</TableHead>
                  <TableHead className="w-[130px] min-w-[130px] max-w-[130px]">{t('content.table.segment')}</TableHead>
                  <TableHead className="w-[140px] min-w-[140px] max-w-[140px]">{t('content.table.campaign')}</TableHead>
                  <TableHead className="w-[120px] min-w-[120px] max-w-[120px]">{t('content.table.performance')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 3 }).map((_, i) => (
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
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {/* Individual Status Pagination Skeleton */}
            <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-[180px]" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div className="flex items-center gap-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-8 rounded-md" />
                  ))}
                </div>
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          </Card>
        </div>
      ))}
      
      {/* Global Settings Skeleton */}
      <Card className="mt-6">
        <div className="flex items-center justify-between px-4 py-2">
          <Skeleton className="h-4 w-[180px]" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-[120px]" />
            <Skeleton className="h-8 w-[70px]" />
          </div>
        </div>
      </Card>
    </div>
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
    <div className="w-full h-full flex flex-col justify-start flex-1 min-h-0 self-stretch flex-grow min-w-0">
      <div className="flex gap-4 min-w-fit items-start pt-0 mt-0 flex-1 flex-row w-full h-full min-h-0 items-stretch self-stretch">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-80 h-full flex flex-col justify-start self-stretch min-h-0 self-stretch flex-grow min-w-0">
            <div className="bg-background rounded-t-md p-3 border-b border-x border-t flex-none">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-8" />
              </div>
            </div>
            <div className="bg-muted/30 rounded-b-md border-b border-x p-2 flex-1 h-full overflow-y-auto min-h-0 min-h-0">
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
  const { t } = useLocalization()
  const { currentSite, getSettings } = useSite()
  const router = useRouter()
  const [contentItems, setContentItems] = useState<ContentItem[]>([])
  const [socialMedia, setSocialMedia] = useState<any[]>([])
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
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true)
  const [assetsByContentId, setAssetsByContentId] = useState<Record<string, ContentAssetWithDetails[]>>({})
  const [outstandPosts, setOutstandPosts] = useState<any[]>([])
  const [isLoadingOutstand, setIsLoadingOutstand] = useState(false)

  const combinedContentItems = React.useMemo(() => {
    console.log("⚙️ [Content] Building combinedContentItems. Current local items:", contentItems.length, "Outstand posts:", outstandPosts.length);
    const newItems = [...contentItems];
    
    if (outstandPosts && outstandPosts.length > 0) {
      outstandPosts.forEach(post => {
         const postText = post.containers?.[0]?.content || post.text || '';
         const isMatched = contentItems.some(item => {
           if (item.tags?.includes(`outstand_id_${post.id}`)) return true;
           return postText && item.title && (
             postText.includes(item.title) || 
             (item.description && postText.includes(item.description.substring(0, 50)))
           );
         });
         
         console.log(`🔍 [Content] Post from Outstand (ID: ${post.id}): matched? ${isMatched} | length: ${postText.length}`);
         
         if (!isMatched && postText) {
           // Extract networks
           const platforms = post.socialAccounts?.map((a: any) => a.network || (typeof a === 'string' ? a : null)).filter(Boolean) || [];
           const publishedTags = platforms.map((p: string) => `published_${p}`);

           newItems.push({
             id: `outstand-${post.id}`,
             title: postText.substring(0, 50) + (postText.length > 50 ? '...' : ''),
             description: postText,
             type: 'social_post',
             content: postText,
             text: postText,
             instructions: null,
             status: post.isDraft ? 'draft' : (post.scheduledAt ? 'approved' : 'published'),
             segment_id: null,
             campaign_id: null,
             site_id: currentSite?.id || '',
             author_id: null,
             user_id: null,
             created_at: post.createdAt || new Date().toISOString(),
             updated_at: post.createdAt || new Date().toISOString(),
             published_at: post.publishedAt || null,
             tags: ['outstand_only', `outstand_id_${post.id}`, ...publishedTags],
             word_count: postText.split(' ').length,
             estimated_reading_time: 1,
             seo_score: null,
             performance_rating: null,
             assets: post.containers?.[0]?.media?.map((m: any) => ({
                id: m.id,
                file_path: m.url || m.thumbnailUrl || '',
                file_type: m.type || 'image/jpeg',
                is_primary: true
             })) || []
           });
         }
      });
    }
    console.log("✅ [Content] Combined items count:", newItems.length);
    return newItems;
  }, [contentItems, outstandPosts, currentSite?.id]);

  // Sort state
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "rate_desc" | "rate_asc">("newest")

  // Initialize command+k hook
  useCommandK()
  
  useEffect(() => {
    if (currentSite?.id) {
      refreshContentList()
      loadSegments()
      loadCampaigns()
      loadOutstandPosts()
      
      // Load social media settings for publishing
      const loadSettings = async () => {
        try {
          const settings = await getSettings(currentSite.id)
          if (settings?.social_media) {
            setSocialMedia(settings.social_media.filter((s: any) => s.isActive && (s.platform === 'facebook' || s.platform === 'linkedin' || s.platform === 'tiktok' || s.platform === 'twitter' || s.platform === 'x' || s.platform === 'instagram')))
          }
        } catch (e) {
          console.error('Failed to load social media settings', e)
        }
      }
      loadSettings()
    }
  }, [currentSite?.id])

  const loadOutstandPosts = async () => {
    if (!currentSite?.id) return
    
    try {
      console.log('🔄 [Content] Fetching Outstand posts in client...')
      setIsLoadingOutstand(true)
      const result = await fetchOutstandPosts(currentSite.id)
      console.log('📦 [Content] Outstand API Response:', result?.data?.length || 0, 'posts')
      setOutstandPosts(result?.data || [])
    } catch (error) {
      console.error('❌ Error fetching outstand posts in client:', error)
      setOutstandPosts([])
    } finally {
      setIsLoadingOutstand(false)
    }
  }

  const refreshContentList = useCallback(async () => {
    if (!currentSite?.id) return

    console.log("🔄 [Content] Fetching local Makinari content...");
    setIsLoading(true)
    try {
      const result = await getContent(currentSite.id)
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      if (result.content) {
        console.log(`📦 [Content] Local content received: ${result.content.length}`);
        setContentItems(result.content)
        setTotalContent(result.count)
        setFilteredContent(result.content)
        const ids = result.content.map((c: ContentItem) => c.id)
        const { byContentId } = await getContentAssetsByContentIds(ids)
        setAssetsByContentId(byContentId || {})
      }
    } catch (error) {
      console.error("Error fetching content:", error)
      toast.error(t('content.toast.loadError'))
    } finally {
      setIsLoading(false)
    }
  }, [currentSite?.id])

  const loadSegments = async () => {
    if (!currentSite?.id) return

    try {
      console.log(`📊 [Content] Loading segments for site: ${currentSite.id}`)
      const { segments, error } = await getSegments(currentSite.id)
      
      if (error) {
        toast.error(t('content.toast.segmentsError') + (error ? `: ${error}` : ''))
        return
      }
      
      if (segments) {
        console.log(`📊 [Content] Loaded ${segments.length} segments:`, segments.map(s => s.name).join(', '))
        setSegments(segments.map(segment => ({
          id: segment.id,
          name: segment.name,
          description: segment.description
        })))
      }
    } catch (error) {
      console.error("Error loading segments:", error)
      toast.error(t('content.toast.segmentsError'))
    }
  }

  const loadCampaigns = async () => {
    if (!currentSite?.id) return
    
    try {
      setIsLoadingCampaigns(true)
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
    } finally {
      setIsLoadingCampaigns(false)
    }
  }

  const updateFilteredContent = useCallback((
    search: string, 
    currentFilters: ContentFilters,
    itemsToFilter: ContentItem[] = combinedContentItems,
    currentSort: typeof sortBy = sortBy
  ) => {
    const searchLower = search.toLowerCase()
    
    let filtered = itemsToFilter.filter(item => {
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
    
    // Sort logic
    filtered = filtered.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime()
      const dateB = new Date(b.created_at || 0).getTime()
      const rateA = a.performance_rating ?? 0
      const rateB = b.performance_rating ?? 0
      
      if (currentSort === 'newest') return dateB - dateA
      if (currentSort === 'oldest') return dateA - dateB
      if (currentSort === 'rate_desc') {
        if (rateB !== rateA) return rateB - rateA
        return dateB - dateA
      }
      if (currentSort === 'rate_asc') {
        if (rateA !== rateB) return rateA - rateB
        return dateB - dateA
      }
      return 0
    })
    
    setFilteredContent(filtered)
  }, [combinedContentItems, sortBy])

  useEffect(() => {
    updateFilteredContent(searchTerm, filters, combinedContentItems, sortBy)
  }, [combinedContentItems, searchTerm, filters, sortBy, updateFilteredContent])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value
    setSearchTerm(newSearchTerm)
  }

  const handleFiltersChange = (newFilters: ContentFilters) => {
    setFilters(newFilters)
  }

  // Effect to re-run sort and filter when sortBy changes
  // We don't need this effect anymore since the main useEffect handles it
  // useEffect(() => {
  //   updateFilteredContent(searchTerm, filters, combinedContentItems, sortBy)
  // }, [sortBy, updateFilteredContent, searchTerm, filters, combinedContentItems])

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
      const updatedItems = contentItems.map(item => 
        item.id === contentId 
          ? { 
              ...item, 
              status: newStatus as any,
              updated_at: new Date().toISOString(),
              ...(newStatus === 'published' ? { published_at: new Date().toISOString() } : {})
            } 
          : item
      )
      
      setContentItems(updatedItems)
      
      // Update filtered content as well to maintain consistency
      updateFilteredContent(searchTerm, filters, updatedItems)

      toast.success(`Content status updated to ${newStatus}`)
    } catch (error) {
      console.error("Error updating content status:", error)
      toast.error(t('content.toast.statusFailed'))
      throw error // Re-throw to trigger the revert in kanban
    }
  }

  const handleContentClick = async (content: ContentItem) => {
      if (content.id.startsWith('outstand-')) {
        try {
          const outstandId = content.id.replace('outstand-', '');
          
          // Determine tags to save: pass along whatever mock tags we assigned (including outstand_id_ and published_)
          const tagsToSave = content.tags && content.tags.length > 0
            ? content.tags
            : ['outstand_only', `outstand_id_${outstandId}`];

          // Save to DB first
          const res = await createContent({
            title: content.title,
            description: content.description || undefined,
            type: content.type as any,
            siteId: currentSite!.id,
            status: content.status,
            tags: tagsToSave,
            text: content.text || content.content || ''
          });
        
        if (res.content) {
          // Save assets if any
          if (content.assets && content.assets.length > 0) {
              const displayAssets = content.assets.filter((a: any) => a.file_type?.startsWith("image/") || a.file_type?.startsWith("video/"));
              for (const asset of displayAssets) {
                 await createAsset({
                    siteId: currentSite!.id,
                    contentId: res.content.id,
                    url: asset.file_path,
                    name: `outstand-asset-${outstandId}`,
                    fileType: asset.file_type,
                    fileSize: 0,
                    isPrimary: asset === displayAssets[0]
                 });
              }
          }
          
          navigateToContent({
            contentId: res.content.id,
            contentTitle: res.content.title,
            router
          });
          return;
        } else {
          console.error("Failed to save outstand post, response:", res);
          toast.error(`Failed to save post to database: ${res.error || 'Unknown error'}`);
          return;
        }
      } catch (e) {
        console.error("Error creating content from outstand post", e);
        toast.error("Failed to save post");
        return;
      }
    }

    navigateToContent({
      contentId: content.id,
      contentTitle: content.title,
      router
    })
  }

  const [publishingContent, setPublishingContent] = useState<ContentItem | null>(null)
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([])
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState<Date>(new Date())
  
  const handlePublishClick = (content: ContentItem) => {
    setPublishingContent(content)
    // Select all available network IDs by default, specifically pulling connected page IDs
    // Set ensures we don't have duplicate defaults
    const defaultIds = Array.from(new Set(socialMedia.flatMap(s => {
      if (s.connectedPages && Array.isArray(s.connectedPages) && s.connectedPages.length > 0) {
        return s.connectedPages.map((page: any) => page.id);
      }
      return s.account_id || s.accountId || s.id || null;
    }).filter(Boolean)));
    setSelectedNetworks(defaultIds)
  }

  const closePublishModal = () => {
    setPublishingContent(null)
    setSelectedNetworks([])
  }

  const submitPublish = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!publishingContent || !currentSite?.id) return
    if (selectedNetworks.length === 0) {
      toast.error("Please select at least one social network")
      return
    }
    
    try {
      // Map selected IDs back to platform names for saving tags
      const platformNames = selectedNetworks.map(id => {
        const acc = socialMedia.find((s: any) => (s.account_id || s.accountId || s.id || s.platform) === id || (s.connectedPages && s.connectedPages.some((p:any) => p.id === id)));
        return acc ? acc.platform : id;
      });

      // Map selected IDs to account names or usernames for the API as expected by Outstand
      // Use Set to remove duplicates
      const validAccounts = Array.from(new Set(selectedNetworks.map(id => {
        for (const social of socialMedia) {
          if (social.connectedPages && Array.isArray(social.connectedPages)) {
            const page = social.connectedPages.find((p: any) => p.id === id);
            if (page) return page.name || page.username;
          }
          if ((social.account_id || social.accountId || social.id || social.platform) === id) {
            return social.accountName || social.username || id;
          }
        }
        return id;
      }))).filter(n => 
        !['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok', 'pinterest', 'github', 'reddit', 'medium', 'x'].includes(n.toLowerCase())
      );

      if (validAccounts.length === 0) {
        toast.error("Please select at least one valid connected account. Check your social media settings.")
        return
      }

      console.log('Publishing to selected network IDs:', selectedNetworks);
      console.log('Filtered valid accounts for API:', validAccounts);
      console.log('Available social media settings:', socialMedia);
      
      const isLinkedInSelected = platformNames.some(p => p.toLowerCase().includes('linkedin'));
      const isFacebookSelected = platformNames.some(p => p.toLowerCase().includes('facebook'));
      const isTwitterSelected = platformNames.some(p => p.toLowerCase().includes('twitter') || p.toLowerCase().includes('x'));
      const isInstagramSelected = platformNames.some(p => p.toLowerCase().includes('instagram'));
      
      // Determine what text to send based on the platform.
      // Usually social networks expect one plain text body.
      // If we have text/content, use it, otherwise fall back to title + description.
      let postContent = '';
      const fullText = publishingContent.text || publishingContent.content || '';
      
      if (fullText && fullText.trim().length > 0) {
        // We have full text, which is likely the actual post body
        postContent = fullText;
      } else {
        // Fallback to title and description
        postContent = publishingContent.title;
        if (publishingContent.description) {
          postContent += `\n\n${publishingContent.description}`;
        }
      }

      // Twitter character limit safeguard
      if (isTwitterSelected && postContent.length > 280) {
        postContent = postContent.substring(0, 277) + '...';
      }

      const payload = {
        tenant_id: currentSite.id,
        containers: [
          {
            content: postContent,
            media: []
          }
        ],
        accounts: validAccounts,
        ...(scheduleEnabled && scheduledDate ? { scheduledAt: scheduledDate.toISOString() } : {})
      }
      
      // Close the modal early for better UX
      closePublishModal()
      
      const { success, data, error } = await publishOutstandPost(currentSite.id, payload)
      
      if (success) {
        toast.success("Content published successfully")
        
        // Save the published info back to the content using platform names
        const newPostId = data?.post?.id || data?.data?.id || data?.id;
        const newTags = Array.from(new Set([...(publishingContent.tags || []), ...platformNames.map(n => `published_${n}`)]));
        if (newPostId) {
          newTags.push(`outstand_id_${newPostId}`);
        }
        
        // Push platformPostIds to tags so we can track the exact publish links if needed
        const accountsData = data?.post?.socialAccounts || data?.data?.socialAccounts || data?.socialAccounts || [];
        accountsData.forEach((acc: any) => {
          if (acc.platformPostId) {
            newTags.push(`platform_post_id_${acc.platformPostId}`);
          }
        });

        await updateContent({
          contentId: publishingContent.id,
          title: publishingContent.title,
          type: publishingContent.type,
          tags: newTags
        });
        
        // Also update status to published
        await handleUpdateContentStatus(publishingContent.id, 'published')
        
        // Refresh the posts list
        loadOutstandPosts()
      } else {
        throw new Error(error || "Failed to publish")
      }
    } catch (error) {
      console.error(error)
      // Hide any mention of Outstand in error message
      const errMsg = error instanceof Error ? error.message : "Failed to publish content";
      const cleanErrMsg = errMsg.replace(/outstand/i, 'Social Media API').replace(/API Error/i, 'Error');
      toast.error(cleanErrMsg)
    }
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
    const updatedItems = contentItems.map(item => 
      item.id === contentId 
        ? { ...item, performance_rating: rating } 
        : item
    );
    
    setContentItems(updatedItems);
    
    // Update filtered content to maintain consistency
    updateFilteredContent(searchTerm, filters, updatedItems);
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



  return (
    <div className="h-full flex flex-col min-w-0 w-full justify-start flex-1 h-full">
      <Tabs defaultValue="all" className="flex-1 flex flex-col justify-start w-full h-full">
        <StickyHeader>
          <div className="w-full pt-0">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-8">
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                  <TabsTrigger value="all" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('content.tabs.all')}>
                    <LayoutGrid size={13} className="md:!hidden" />
                    <span className="tab-label">{t('content.tabs.all')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="blog_post" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('content.tabs.blog')}>
                    <FileText size={13} className="md:!hidden" />
                    <span className="tab-label">{t('content.tabs.blog')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="video" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('content.tabs.video')}>
                    <FileVideo size={13} className="md:!hidden" />
                    <span className="tab-label">{t('content.tabs.video')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="social_post" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('content.tabs.social')}>
                    <Globe size={13} className="md:!hidden" />
                    <span className="tab-label">{t('content.tabs.social')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="ad" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('content.tabs.ads')}>
                    <Megaphone size={13} className="md:!hidden" />
                    <span className="tab-label">{t('content.tabs.ads')}</span>
                  </TabsTrigger>
                </TabsList>
              <div className="flex items-center gap-2">
                <SearchInput
                  placeholder="Search content..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"
                  alwaysExpanded={false}
                />

                  <Button 
                    variant="secondary" 
                    size={(filters.status.length > 0 || filters.type.length > 0 || filters.segments.length > 0) ? "default" : "icon"}
                    className={cn(
                      "h-9 rounded-full",
                      (filters.status.length > 0 || filters.type.length > 0 || filters.segments.length > 0) ? "px-3" : "w-9"
                    )}
                    onClick={() => setIsFiltersDialogOpen(true)}
                  >
                    <Filter className="h-4 w-4" />
                    {(filters.status.length > 0 || filters.type.length > 0 || filters.segments.length > 0) && (
                      <Badge variant="secondary" className="ml-2">
                        {filters.status.length + filters.type.length + filters.segments.length}
                      </Badge>
                    )}
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="sm" className="h-9 gap-2 rounded-full px-4" title={t('content.sortBy') === 'content.sortBy' ? 'Sort by' : t('content.sortBy')}>
                        <ListOrdered className="h-4 w-4" />
                        <span className="hidden sm:inline font-normal">
                          {sortBy === "newest"
                            ? (t('content.sort.newest') === 'content.sort.newest' ? 'Newest' : t('content.sort.newest'))
                            : sortBy === "oldest"
                              ? (t('content.sort.oldest') === 'content.sort.oldest' ? 'Oldest' : t('content.sort.oldest'))
                              : sortBy === "rate_desc"
                                ? (t('content.sort.rateDesc') === 'content.sort.rateDesc' ? 'Highest Rated' : t('content.sort.rateDesc'))
                                : (t('content.sort.rateAsc') === 'content.sort.rateAsc' ? 'Lowest Rated' : t('content.sort.rateAsc'))}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        onClick={() => setSortBy("newest")}
                      >
                        <Check className={cn("mr-2 h-4 w-4", sortBy === "newest" ? "opacity-100" : "opacity-0")} />
                        {t('content.sort.newest') === 'content.sort.newest' ? 'Newest' : t('content.sort.newest')}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        onClick={() => setSortBy("oldest")}
                      >
                        <Check className={cn("mr-2 h-4 w-4", sortBy === "oldest" ? "opacity-100" : "opacity-0")} />
                        {t('content.sort.oldest') === 'content.sort.oldest' ? 'Oldest' : t('content.sort.oldest')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => setSortBy("rate_desc")}
                      >
                        <Check className={cn("mr-2 h-4 w-4", sortBy === "rate_desc" ? "opacity-100" : "opacity-0")} />
                        {t('content.sort.rateDesc') === 'content.sort.rateDesc' ? 'Highest Rated' : t('content.sort.rateDesc')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => setSortBy("rate_asc")}
                      >
                        <Check className={cn("mr-2 h-4 w-4", sortBy === "rate_asc" ? "opacity-100" : "opacity-0")} />
                        {t('content.sort.rateAsc') === 'content.sort.rateAsc' ? 'Lowest Rated' : t('content.sort.rateAsc')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
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
        
        <div className="p-8 space-y-6 bg-muted/30 flex-1 flex flex-col justify-start w-full h-full">
          {/* Trends Section - Only for Table View */}
          {viewType === 'table' && (
            <div className="px-8">
              <TrendsSection segments={segments} currentSiteId={currentSite?.id} displayMode="table" />
            </div>
          )}
          
          {/* Main Content Layout */}
          <div className={viewType === 'kanban' ? "overflow-x-auto pb-4 -mx-8 flex-1 flex flex-col justify-start" : "px-8"}>
            <div className={viewType === 'kanban' ? "flex items-start gap-4 min-w-fit px-8 pt-0 mt-0 flex-1 flex-row" : ""}>
              {/* Left Sidebar - Trends Column (Only for Kanban View) */}
              {viewType === 'kanban' && (
                <div className="flex-shrink-0 pt-0 mt-0 flex flex-col justify-start self-stretch min-h-0">
                  <TrendsColumn
                    className="self-stretch"
                    segments={segments}
                    currentSiteId={currentSite?.id}
                  />
                </div>
              )}
              
              {/* Main Content Area */}
              <div className={viewType === 'kanban' ? "flex-1 pt-0 mt-0 flex flex-col justify-start" : ""}>
                <TabsContent value="all" className={viewType === 'kanban' ? "m-0 flex-1 flex flex-col justify-start" : "space-y-4"}>
              {isLoading ? (
                viewType === 'kanban' ? <ContentSkeleton /> : <ContentTableSkeleton />
              ) : viewType === 'kanban' ? (
                <ContentKanban 
                  contentItems={filteredContent}
                  onUpdateContentStatus={handleUpdateContentStatus}
                  segments={segments}
                  campaigns={campaigns}
                  onContentClick={handleContentClick}
                  onRatingChange={handleContentRatingChange}
                  isLoadingCampaigns={isLoadingCampaigns}
                  assetsByContentId={assetsByContentId}
                  outstandPosts={outstandPosts}
                  onPublish={handlePublishClick}
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
                  campaigns={campaigns}
                  onRatingChange={handleContentRatingChange}
                  assetsByContentId={assetsByContentId}
                  outstandPosts={outstandPosts}
                />
              )}
            </TabsContent>
            
            <TabsContent value="blog_post" className={viewType === 'kanban' ? "m-0 flex-1 flex flex-col justify-start" : "space-y-4"}>
              {isLoading ? (
                viewType === 'kanban' ? <ContentSkeleton /> : <ContentTableSkeleton />
              ) : viewType === 'kanban' ? (
                <ContentKanban 
                  contentItems={filteredContent.filter(item => item.type === 'blog_post')}
                  onUpdateContentStatus={handleUpdateContentStatus}
                  segments={segments}
                  campaigns={campaigns}
                  onContentClick={handleContentClick}
                  onRatingChange={handleContentRatingChange}
                  isLoadingCampaigns={isLoadingCampaigns}
                  assetsByContentId={assetsByContentId}
                  outstandPosts={outstandPosts}
                  onPublish={handlePublishClick}
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
                  campaigns={campaigns}
                  onRatingChange={handleContentRatingChange}
                  assetsByContentId={assetsByContentId}
                  outstandPosts={outstandPosts}
                />
              )}
            </TabsContent>
            
            <TabsContent value="video" className={viewType === 'kanban' ? "m-0 flex-1 flex flex-col justify-start" : "space-y-4"}>
              {isLoading ? (
                viewType === 'kanban' ? <ContentSkeleton /> : <ContentTableSkeleton />
              ) : viewType === 'kanban' ? (
                <ContentKanban 
                  contentItems={filteredContent.filter(item => item.type === 'video')}
                  onUpdateContentStatus={handleUpdateContentStatus}
                  segments={segments}
                  campaigns={campaigns}
                  onContentClick={handleContentClick}
                  onRatingChange={handleContentRatingChange}
                  isLoadingCampaigns={isLoadingCampaigns}
                  assetsByContentId={assetsByContentId}
                  outstandPosts={outstandPosts}
                  onPublish={handlePublishClick}
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
                  campaigns={campaigns}
                  onRatingChange={handleContentRatingChange}
                  assetsByContentId={assetsByContentId}
                  outstandPosts={outstandPosts}
                />
              )}
            </TabsContent>
            
            <TabsContent value="social_post" className={viewType === 'kanban' ? "m-0 flex-1 flex flex-col justify-start w-full h-full min-h-0 self-stretch flex-grow min-w-0 flex-1" : "space-y-4"}>
              {isLoading ? (
                viewType === 'kanban' ? <ContentSkeleton /> : <ContentTableSkeleton />
              ) : viewType === 'kanban' ? (
                <ContentKanban 
                  contentItems={filteredContent.filter(item => item.type === 'social_post')}
                  onUpdateContentStatus={handleUpdateContentStatus}
                  segments={segments}
                  campaigns={campaigns}
                  onContentClick={handleContentClick}
                  onRatingChange={handleContentRatingChange}
                  isLoadingCampaigns={isLoadingCampaigns}
                  assetsByContentId={assetsByContentId}
                  outstandPosts={outstandPosts}
                  onPublish={handlePublishClick}
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
                  campaigns={campaigns}
                  onRatingChange={handleContentRatingChange}
                  assetsByContentId={assetsByContentId}
                  outstandPosts={outstandPosts}
                />
              )}
            </TabsContent>
            
            <TabsContent value="ad" className={viewType === 'kanban' ? "m-0 flex-1 flex flex-col justify-start w-full h-full min-h-0 self-stretch flex-grow min-w-0 flex-1" : "space-y-4"}>
              {isLoading ? (
                viewType === 'kanban' ? <ContentSkeleton /> : <ContentTableSkeleton />
              ) : viewType === 'kanban' ? (
                <ContentKanban 
                  contentItems={filteredContent.filter(item => item.type === 'ad')}
                  onUpdateContentStatus={handleUpdateContentStatus}
                  segments={segments}
                  campaigns={campaigns}
                  onContentClick={handleContentClick}
                  onRatingChange={handleContentRatingChange}
                  isLoadingCampaigns={isLoadingCampaigns}
                  assetsByContentId={assetsByContentId}
                  outstandPosts={outstandPosts}
                  onPublish={handlePublishClick}
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
                  campaigns={campaigns}
                  onRatingChange={handleContentRatingChange}
                  assetsByContentId={assetsByContentId}
                  outstandPosts={outstandPosts}
                />
              )}
            </TabsContent>
            </div>
            
            {/* Right padding spacer for scroll */}
            {viewType === 'kanban' && <div className="w-16 flex-shrink-0" />}
          </div>
        </div>
        </div>
      </Tabs>
      
      {/* Content Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('content.sheet.details')}</SheetTitle>
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
              onPublish={handlePublishClick}
            />
          )}
        </SheetContent>
      </Sheet>
      
      {/* Publish Modal */}
      {publishingContent && (
        <Dialog open={!!publishingContent} onOpenChange={(open) => !open && closePublishModal()}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Publish to Social Media</DialogTitle>
              <DialogDescription>
                Publish &quot;{publishingContent.title}&quot; to your connected social media accounts.
              </DialogDescription>
            </DialogHeader>
          <form onSubmit={submitPublish} className="space-y-4">
            {socialMedia.length === 0 ? (
              <div className="bg-muted/30 p-4 rounded-md text-sm text-muted-foreground border border-border/50 text-center">
                <p>No social accounts connected.</p>
                <Button 
                  type="button" 
                  variant="link" 
                  onClick={() => router.push('/settings/social_network')}
                  className="mt-2"
                >
                  Connect Accounts
                </Button>
              </div>
            ) : (
              <div className="space-y-4 pt-4">
                <p className="text-sm font-medium">Select Networks:</p>
                <div className="space-y-2">
                  {socialMedia.map((social, idx) => {
                    // Si tiene connectedPages, mostramos un checkbox por cada una
                    if (social.connectedPages && Array.isArray(social.connectedPages) && social.connectedPages.length > 0) {
                      return social.connectedPages.map((page: any, pageIdx: number) => {
                        // Unique ID combining platform and page ID to avoid duplicates
                        const uniqueId = `${social.platform}-${page.id}`;
                        return (
                        <div key={`${idx}-${pageIdx}`} className="flex items-center space-x-2">
                          <Switch 
                            id={`social-${uniqueId}`} 
                            checked={selectedNetworks.includes(page.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedNetworks(prev => [...prev, page.id])
                              } else {
                                setSelectedNetworks(prev => prev.filter(p => p !== page.id))
                              }
                            }}
                          />
                          <label 
                            htmlFor={`social-${uniqueId}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize flex items-center gap-2"
                          >
                            {getNetworkIcon(social.platform)}
                            {page.name || social.accountName || social.platform}
                          </label>
                        </div>
                      )})
                    }

                    const networkId = social.account_id || social.accountId || social.id || social.platform;
                    return (
                    <div key={idx} className="flex items-center space-x-2">
                      <Switch 
                        id={`social-${networkId}`} 
                        checked={selectedNetworks.includes(networkId)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedNetworks(prev => [...prev, networkId])
                          } else {
                            setSelectedNetworks(prev => prev.filter(p => p !== networkId))
                          }
                        }}
                      />
                      <label 
                        htmlFor={`social-${networkId}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize flex items-center gap-2"
                      >
                        {getNetworkIcon(social.platform)}
                        {social.accountName || social.platform}
                      </label>
                    </div>
                  )})}
                </div>
                
                <div className="pt-4 border-t mt-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <Switch
                      id="schedule-post"
                      checked={scheduleEnabled}
                      onCheckedChange={setScheduleEnabled}
                    />
                    <label htmlFor="schedule-post" className="text-sm font-medium">
                      Schedule post for later
                    </label>
                  </div>
                  
                  {scheduleEnabled && (
                    <div className="grid gap-2 mt-4">
                      <label className="text-xs text-muted-foreground">
                        Select date and time
                      </label>
                      <DatePicker
                        date={scheduledDate}
                        setDate={setScheduledDate}
                        showTimePicker={true}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closePublishModal}>Cancel</Button>
              <Button type="submit" disabled={socialMedia.length === 0 || selectedNetworks.length === 0}>
                {scheduleEnabled && scheduledDate ? "Schedule" : "Publish Now"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}

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