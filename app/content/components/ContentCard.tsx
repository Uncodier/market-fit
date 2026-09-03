"use client"

import { useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Badge } from "@/app/components/ui/badge"
import {
  FileText, Filter, PlayCircle, Mail, BarChart, LayoutGrid, MessageSquare, FileVideo, Globe,
  PenSquare, Users, RotateCcw, CalendarIcon, Eye, ChevronLeft, ChevronRight, X, CheckCircle2,
  Pencil, ChevronUp, ChevronDown, Target, Microscope, Megaphone, ListOrdered, Check, Activity
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
import { CONTENT_TYPE_ICONS, getNetworkIcon } from "../content-shared"

export function ContentCard({ content, segments, campaigns, onClick, onRatingChange, isLoadingCampaigns, assets = [], outstandPosts, performanceData }: { 
  content: ContentItem, 
  segments: Array<{ id: string; name: string }>,
  campaigns: Array<{ id: string; title: string }>,
  onClick: (content: ContentItem) => void,
  onRatingChange?: (contentId: string, rating: number) => void,
  isLoadingCampaigns?: boolean,
  assets?: ContentAssetWithDetails[],
  outstandPosts?: any[],
  performanceData?: { byContentId: Record<string, any>, byPostId: Record<string, any> }
}) {

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

  const outstandIdTag = content?.tags?.find((t: string) => t.startsWith('outstand_id_'))
  const explicitOutstandPostId = outstandIdTag ? outstandIdTag.replace('outstand_id_', '') : undefined
  const virtualPostId = content.id.startsWith('outstand-') ? content.id.slice('outstand-'.length) : undefined
  const postPerformance = performanceData?.byContentId?.[content.id]
    || (explicitOutstandPostId && performanceData?.byPostId?.[explicitOutstandPostId])
    || (virtualPostId && performanceData?.byPostId?.[virtualPostId])

  const numberFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })
  const engagementRate = Number(postPerformance?.engagement_rate) || 0
  const percentFormatter = new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 1 })
  const engagementLabel = percentFormatter.format(engagementRate > 1 ? engagementRate / 100 : engagementRate)

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
        
        {postPerformance && (
          <div className="flex mt-2 border-t pt-2 gap-4 items-center">
            <div className="flex items-center gap-1 text-xs text-muted-foreground" title="Views">
              <Eye className="h-3 w-3" />
              {numberFormatter.format(postPerformance.views || 0)}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground" title="Engagement">
              <Activity className="h-3 w-3" />
              {engagementLabel}
            </div>
          </div>
        )}
        </div>
      </CardContent>
    </Card>
  )
}

