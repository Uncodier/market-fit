import React from "react"
import { Segment } from "../page"
import { ContentIdeasKanban } from "./ContentIdeasKanban"

interface SegmentThemesTabProps {
  segment: Segment
}

export function SegmentThemesTab({ segment }: SegmentThemesTabProps) {
  return (
    <div className="space-y-6">
      <ContentIdeasKanban segment={segment} />
    </div>
  )
}

export default SegmentThemesTab; 