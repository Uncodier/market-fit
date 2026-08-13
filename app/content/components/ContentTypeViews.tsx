"use client"

import { TabsContent } from "@/app/components/ui/tabs"
import { ViewType } from "@/app/components/view-selector"
import { type ContentItem } from "../actions"
import { type ContentAssetWithDetails } from "@/app/assets/actions"
import { ContentKanban } from "./ContentKanban"
import { ContentTable, ContentTableSkeleton } from "./ContentTable"
import { ContentSkeleton } from "./ContentSkeleton"

const TYPE_TABS = ["all", "blog_post", "video", "social_post", "ad"] as const

interface ContentTypeViewsProps {
  viewType: ViewType
  isLoading: boolean
  filteredContent: ContentItem[]
  currentPage: number
  itemsPerPage: number
  segments: Array<{ id: string; name: string }>
  campaigns: Array<{ id: string; title: string }>
  isLoadingCampaigns?: boolean
  assetsByContentId: Record<string, ContentAssetWithDetails[]>
  outstandPosts: any[]
  onUpdateContentStatus: (contentId: string, newStatus: string) => Promise<void>
  onContentClick: (content: ContentItem) => void
  onRatingChange: (contentId: string, rating: number) => void
  onPageChange: (page: number) => void
  onItemsPerPageChange: (value: string) => void
  onPublish: (content: ContentItem) => void
}

export function ContentTypeViews({
  viewType,
  isLoading,
  filteredContent,
  currentPage,
  itemsPerPage,
  segments,
  campaigns,
  isLoadingCampaigns,
  assetsByContentId,
  outstandPosts,
  onUpdateContentStatus,
  onContentClick,
  onRatingChange,
  onPageChange,
  onItemsPerPageChange,
  onPublish,
}: ContentTypeViewsProps) {
  const kanbanClass = viewType === "kanban"
    ? "m-0 flex-1 flex flex-col justify-start w-full h-full min-h-0 self-stretch flex-grow min-w-0 flex-1"
    : "space-y-4"

  return (
    <>
      {TYPE_TABS.map((tab) => {
        const items = tab === "all" ? filteredContent : filteredContent.filter((item) => item.type === tab)
        return (
          <TabsContent key={tab} value={tab} className={kanbanClass}>
            {isLoading ? (
              viewType === "kanban" ? <ContentSkeleton /> : <ContentTableSkeleton />
            ) : viewType === "kanban" ? (
              <ContentKanban
                contentItems={items}
                onUpdateContentStatus={onUpdateContentStatus}
                segments={segments}
                campaigns={campaigns}
                onContentClick={onContentClick}
                onRatingChange={onRatingChange}
                isLoadingCampaigns={isLoadingCampaigns}
                assetsByContentId={assetsByContentId}
                outstandPosts={outstandPosts}
                onPublish={onPublish}
              />
            ) : (
              <ContentTable
                contentItems={items}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                totalContent={items.length}
                onPageChange={onPageChange}
                onItemsPerPageChange={onItemsPerPageChange}
                onContentClick={onContentClick}
                segments={segments}
                campaigns={campaigns}
                onRatingChange={onRatingChange}
                assetsByContentId={assetsByContentId}
                outstandPosts={outstandPosts}
              />
            )}
          </TabsContent>
        )
      })}
    </>
  )
}
