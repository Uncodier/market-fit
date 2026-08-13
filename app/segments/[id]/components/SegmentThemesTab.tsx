import React from "react"
import type { Segment } from "../page"
import { ContentIdeasKanban } from "./ContentIdeasKanban"
import { EmptyState } from "@/app/components/ui/empty-state"
import { FileText } from "@/app/components/ui/icons"

interface SegmentThemesTabProps {
  segment: Segment
}

export function SegmentThemesTab({ segment }: SegmentThemesTabProps) {
  // Check if the segment has topics data
  const hasTopicsData = segment.topics && 
    (segment.topics.blog?.length > 0 || segment.topics.newsletter?.length > 0);

  // If there's no topics data, show an empty state
  if (!hasTopicsData) {
    return (
      <EmptyState
        icon={<FileText className="h-12 w-12 text-primary/60" />}
        title="No Content Topics Available"
        description="There are no content topics for this segment yet. Generate topics to get ideas for blog posts, newsletters, and other content formats."
      />
    );
  }

  return (
    <div className="space-y-6">
      <ContentIdeasKanban segment={segment} />
    </div>
  )
}

export default SegmentThemesTab; 