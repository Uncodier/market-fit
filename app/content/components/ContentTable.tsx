"use client"

import React, { useMemo } from "react"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Pagination } from "@/app/components/ui/pagination"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { FileText } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { type ContentItem, updateContent } from "../actions"
import { type ContentAssetWithDetails } from "@/app/assets/actions"
import { getContentTypeName, getSegmentName, getCampaignName } from "../utils"
import { StarRating } from "@/app/components/ui/rating"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { CONTENT_STATUSES, CONTENT_TYPE_ICONS } from "../content-shared"
import {
  DocumentListHead,
  DocumentListRow,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

function resolvePlatforms(content: ContentItem, outstandPosts?: any[]): string[] {
  const hasPublishedTags = content.tags?.some((tag) => tag.startsWith("published_"))
  let platforms: string[] = []

  if (content.id.startsWith("outstand-")) {
    const post = outstandPosts?.find((p) => `outstand-${p.id}` === content.id)
    platforms = post?.socialAccounts?.map((a: any) => a.network || (typeof a === "string" ? a : null)).filter(Boolean) || []
  } else if (hasPublishedTags || (outstandPosts && content.type === "social_post")) {
    platforms = Array.from(new Set(
      outstandPosts?.filter((p) => {
        if (content.tags?.includes(`outstand_id_${p.id}`)) return true
        const postText = p.containers?.[0]?.content || p.text || ""
        return postText && content.title && (postText.includes(content.title) || (content.description && postText.includes(content.description.substring(0, 50))))
      })
        .flatMap((p) => p.socialAccounts?.map((a: any) => a.network || (typeof a === "string" ? a : null)) || [p.social_account?.network])
        .filter(Boolean)
    ))
  }

  if (hasPublishedTags) {
    const publishedTags = content.tags?.filter((tag) => tag.startsWith("published_")).map((tag) => tag.replace("published_", "")) || []
    platforms = Array.from(new Set([...platforms, ...publishedTags]))
  }

  return platforms.filter((p) => p && p !== "undefined" && p !== "null" && typeof p === "string" && !p.match(/^[0-9]+$/))
}

function contentAccent(status: string): "due" | "cancelled" | "none" {
  if (status === "archived") return "cancelled"
  if (status === "draft" || status === "review") return "due"
  return "none"
}

interface ContentTableProps {
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
  performanceData?: { byContentId: Record<string, any>, byPostId: Record<string, any> }
}

export function ContentTable({
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
  outstandPosts,
  performanceData,
}: ContentTableProps) {
  const { t } = useLocalization()
  const totalPages = Math.ceil(totalContent / itemsPerPage)
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage

  const groupedContent = useMemo(() => {
    const groups: Record<string, ContentItem[]> = {}
    CONTENT_STATUSES.forEach((status) => {
      groups[status.id] = []
    })
    contentItems.forEach((item) => {
      if (groups[item.status]) groups[item.status].push(item)
    })
    return groups
  }, [contentItems])

  const handleRatingChange = (contentId: string, rating: number) => {
    onRatingChange?.(contentId, rating)
    const item = contentItems.find((row) => row.id === contentId)
    updateContent({
      contentId,
      title: item?.title || "",
      type: item?.type || "blog_post",
      performance_rating: rating,
      skipRevalidation: true,
    }).then(() => {
      toast.success(t("content.toast.ratingUpdated"), { position: "bottom-right", duration: 2000 })
    }).catch(() => {
      toast.error(t("content.toast.ratingFailed"))
    })
  }

  if (contentItems.length === 0) {
    return (
      <EmptyCard
        icon={<FileText className="h-6 w-6 text-muted-foreground" />}
        title={t("content.empty.title") || "No content found"}
        description={t("content.empty.description") || "Create content to start publishing."}
      />
    )
  }

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[860px]">
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[38%]">{t("content.table.title") || "Title"}</DocumentListHead>
            <DocumentListHead className="w-[14%]">{t("content.table.status") || "Status"}</DocumentListHead>
            <DocumentListHead className="w-[24%]">{t("content.table.context") || "Segment / campaign"}</DocumentListHead>
            <DocumentListHead className="w-[24%]" align="right">{t("content.table.performance") || "Performance"}</DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {CONTENT_STATUSES.map((status) => {
            const statusItems = groupedContent[status.id] || []
            if (statusItems.length === 0) return null
            const statusLabel = t(`content.status.${status.id}`) || status.id

            return (
              <React.Fragment key={status.id}>
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="bg-muted/30 py-2.5">
                    <div className="flex items-center gap-2">
                      <StatusDot status={status.id} label={statusLabel} />
                      <span className="text-[11px] tabular-nums text-muted-foreground/70">{statusItems.length}</span>
                    </div>
                  </TableCell>
                </TableRow>
                {statusItems.map((content) => {
                  const contentAssets = assetsByContentId[content.id] || []
                  const displayAssets = content.id.startsWith("outstand-")
                    ? content.assets || []
                    : contentAssets.filter((a) => a.file_type.startsWith("image/"))
                  const mainAsset = displayAssets.find((a) => a.is_primary) || displayAssets[0]
                  const platforms = resolvePlatforms(content, outstandPosts)
                  const typeLabel = getContentTypeName(content.type)
                  const meta = [typeLabel, platforms.length ? platforms.join(" · ") : null].filter(Boolean).join(" · ")
                  const context = [getSegmentName(content.segment_id, segments), getCampaignName(content.campaign_id, campaigns)]
                    .filter((value) => value && !value.startsWith("No ") && !value.startsWith("Unknown "))
                    .join(" · ") || "—"

                  return (
                    <DocumentListRow
                      key={content.id}
                      onClick={() => onContentClick(content)}
                      accent={contentAccent(content.status)}
                    >
                      <TableCell className="py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-9 w-9 rounded-md overflow-hidden flex-shrink-0 bg-muted">
                            {mainAsset?.file_path ? (
                              <img src={mainAsset.file_path} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                {CONTENT_TYPE_ICONS[content.type]}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <p className="truncate text-sm font-medium leading-tight text-foreground">{content.title}</p>
                            {meta ? (
                              <p className="truncate text-[11px] leading-tight text-muted-foreground">{meta}</p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <StatusDot status={content.status} label={statusLabel} />
                      </TableCell>
                      <TableCell className="py-3.5 text-sm text-muted-foreground">
                        {context}
                      </TableCell>
                      <TableCell className="py-3.5" onClick={(event) => event.stopPropagation()}>
                        <div className="flex justify-end">
                          <StarRating
                            rating={content.performance_rating}
                            onRatingChange={(rating) => handleRatingChange(content.id, rating)}
                            readonly={false}
                            size="sm"
                          />
                        </div>
                      </TableCell>
                    </DocumentListRow>
                  )
                })}
              </React.Fragment>
            )
          })}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
        <div className="flex items-center gap-4">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + 1, totalContent)}</span>
            {" – "}
            <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + contentItems.length, totalContent)}</span>
            {" of "}
            <span className="font-medium text-foreground">{totalContent}</span>
            {" "}
            {t("content.items") || "items"}
          </p>
          <Select value={itemsPerPage.toString()} onValueChange={onItemsPerPageChange}>
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={itemsPerPage.toString()} />
            </SelectTrigger>
            <SelectContent side="top">
              {[5, 10, 20, 50].map((value) => (
                <SelectItem key={value} value={value.toString()}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {totalPages > 1 && (
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
        )}
      </div>
    </div>
  )
}

export function ContentTableSkeleton() {
  return (
    <div className={documentListShellClassName()}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: 4 }).map((_, index) => (
              <DocumentListHead key={index} align={index === 3 ? "right" : "left"}>
                <Skeleton className={cn("h-3 w-16", index === 3 && "ml-auto")} />
              </DocumentListHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, index) => (
            <TableRow key={index} className="hover:bg-transparent">
              <TableCell className="py-3.5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-md" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-28" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="ml-auto h-4 w-24" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
