"use client"

import { Button } from "@/app/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip"
import { Loader, Sparkles } from "@/app/components/ui/icons"
import { EntityAvatar } from "@/app/components/documents/document-list"

export function LeadAssigneeCell({
  assigneeId,
  currentUserId,
  assigneeName,
  assigning,
  onToggle,
}: {
  assigneeId?: string | null
  currentUserId?: string
  assigneeName?: string
  assigning?: boolean
  onToggle: () => void
}) {
  const isYou = Boolean(assigneeId && currentUserId && assigneeId === currentUserId)
  const label = !assigneeId ? "AI" : isYou ? "You" : assigneeName || "Assigned"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 px-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          disabled={assigning}
          onClick={(event) => {
            event.stopPropagation()
            event.preventDefault()
            onToggle()
          }}
        >
          {assigning ? (
            <Loader className="h-3.5 w-3.5" />
          ) : assigneeId ? (
            <EntityAvatar name={label} className="h-7 w-7 text-[10px]" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
          )}
          <span className="max-w-[72px] truncate">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {assigneeId
          ? `Click to ${isYou ? "assign to AI Team" : "assign to me"}`
          : "Click to assign to me"}
      </TooltipContent>
    </Tooltip>
  )
}
