"use client"

import { Checkbox } from "@/app/components/ui/checkbox"
import { Campaign } from "@/app/types"

export function CampaignAudienceList({
  campaign,
  siteSegments,
  onUpdate,
}: {
  campaign: Campaign
  siteSegments: Array<{ id: string; name: string; description?: string | null }>
  onUpdate: (data: { segments: string[] }) => Promise<void>
}) {
  const selected = campaign.segments || []

  const toggle = async (segmentId: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...selected, segmentId]))
      : selected.filter((id) => id !== segmentId)
    await onUpdate({ segments: next })
  }

  if (siteSegments.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">No segments available.</p>
  }

  return (
    <div className="min-w-0">
      {siteSegments.map((segment) => {
        const checked = selected.includes(segment.id)
        return (
          <label
            key={segment.id}
            htmlFor={`campaign-segment-${segment.id}`}
            className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0 cursor-pointer"
          >
            <Checkbox
              id={`campaign-segment-${segment.id}`}
              checked={checked}
              onCheckedChange={(value) => void toggle(segment.id, value === true)}
            />
            <span className="min-w-0">
              <span className="text-sm block truncate">{segment.name}</span>
              {segment.description && (
                <span className="text-xs text-muted-foreground block truncate">{segment.description}</span>
              )}
            </span>
          </label>
        )
      })}
    </div>
  )
}
