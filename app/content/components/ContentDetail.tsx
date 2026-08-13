"use client"

import { useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Badge } from "@/app/components/ui/badge"
import { FileText, Globe, PenSquare, Eye, X, CheckCircle2, Pencil } from "@/app/components/ui/icons"
import { SheetHeader, SheetTitle } from "@/app/components/ui/sheet"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { updateContent, type ContentItem } from "../actions"
import { getContentTypeName } from "../utils"
import { StarRating } from "@/app/components/ui/rating"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { STATUS_COLORS, CONTENT_TYPE_ICONS } from "../content-shared"

interface ContentDetailProps {
  content: ContentItem
  onClose: () => void
  segments: Array<{ id: string; name: string }>
  onRatingChange?: (contentId: string, rating: number) => void
  onPublish?: (content: ContentItem) => void
}

export function ContentDetail({ content, onClose, segments, onRatingChange, onPublish }: ContentDetailProps) {
  const { t } = useLocalization()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    title: content.title,
    description: content.description || '',
    type: content.type,
    segment_id: content.segment_id || '',
    segmentValue: (content.segment_id ? { mode: "existing", id: content.segment_id, label: "Loading..." } : null) as RelationSelectValue,
    tags: content.tags || [],
    performance_rating: content.performance_rating
  })
  const [tagInput, setTagInput] = useState('')

  // Need to sync segment label after segments load
  useEffect(() => {
    if (content.segment_id) {
      const match = segments.find(s => s.id === content.segment_id)
      if (match) {
        setEditForm(prev => ({...prev, segmentValue: { mode: "existing", id: match.id, label: match.name }}))
      }
    }
  }, [content.segment_id, segments])

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
      const { id: resolvedSegmentId, error: segError } = await resolveRelationId("segment", editForm.segmentValue, content.site_id)
      if (segError) throw new Error(segError)

      const result = await updateContent({
        contentId: content.id,
        title: editForm.title,
        description: editForm.description || undefined,
        type: editForm.type,
        segment_id: resolvedSegmentId || null,
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
                  <RelationSelect 
                    options={segments.map((segment) => ({ id: segment.id, label: segment.name }))}
                    value={editForm.segmentValue}
                    onValueChange={(val) => setEditForm({...editForm, segmentValue: val, segment_id: val?.mode === "existing" ? val.id : ""})}
                    placeholder={t('content.detail.selectSegment')}
                    emptyMessage="No segment found"
                    className="h-12"
                  />
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
                segment_id: content.segment_id || '',
                segmentValue: (content.segment_id ? { mode: "existing", id: content.segment_id, label: "Loading..." } : null) as RelationSelectValue,
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

