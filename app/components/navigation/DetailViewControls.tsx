"use client"

import { NavigationLink } from "@/app/components/navigation/NavigationLink"
import { Button } from "@/app/components/ui/button"
import { ChevronDown, ChevronUp } from "@/app/components/ui/icons"
import { ToolbarIconButton } from "@/app/components/ui/toolbar-icon-button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { DETAIL_VIEW_LEAVE_EVENT } from "@/lib/navigation/detail-view-navigation"

export function DetailViewControls({ neighbors, disabled = false }: {
  neighbors: { previous: string | null; next: string | null }
  disabled?: boolean
}) {
  return (
    <div role="group" aria-label="Record navigation" className="flex items-center gap-1">
      {[
        { href: neighbors.previous, label: "Previous record", Icon: ChevronUp },
        { href: neighbors.next, label: "Next record", Icon: ChevronDown },
      ].map(({ href, label, Icon }) => href && !disabled ? (
        <TooltipProvider key={label} delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                <NavigationLink href={href} replace aria-label={label} onNavigate={event => {
                  if (!window.dispatchEvent(new Event(DETAIL_VIEW_LEAVE_EVENT, { cancelable: true }))) event.preventDefault()
                }}><Icon aria-hidden /></NavigationLink>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <ToolbarIconButton key={label} label={label} className="h-8 w-8" disabled>
          <Icon aria-hidden />
        </ToolbarIconButton>
      ))}
    </div>
  )
}
