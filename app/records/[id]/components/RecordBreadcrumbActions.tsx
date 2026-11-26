"use client"

import { useSearchParams } from "next/navigation"
import { NavigationLink } from "@/app/components/navigation/NavigationLink"
import { TopBarActionPortal } from "@/app/components/navigation/topbar-primary-actions"
import { Button } from "@/app/components/ui/button"
import { ChevronDown, ChevronUp } from "@/app/components/ui/icons"
import { ToolbarIconButton } from "@/app/components/ui/toolbar-icon-button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { useOptionalSite } from "@/app/context/SiteContext"
import { getRecordNeighbors } from "../../lib/record-navigation"

export function RecordBreadcrumbActions({ recordId, siteId, isSaving }: {
  recordId: string
  siteId: string
  isSaving: boolean
}) {
  const viewKey = useSearchParams()?.get("recordView")
  const site = useOptionalSite()
  if (!viewKey || site?.isLoading || site?.currentSite?.id !== siteId) return null

  const neighbors = getRecordNeighbors(siteId, recordId, viewKey)
  if (!neighbors) return null

  return (
    <TopBarActionPortal slotId="record-breadcrumb-actions">
      <div role="group" aria-label="Record navigation" className="flex items-center gap-1">
        {[
          { href: neighbors.previous, label: "Previous record", Icon: ChevronUp },
          { href: neighbors.next, label: "Next record", Icon: ChevronDown },
        ].map(({ href, label, Icon }) => href && !isSaving ? (
          <TooltipProvider key={label} delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                  <NavigationLink href={href} replace aria-label={label}><Icon aria-hidden /></NavigationLink>
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
    </TopBarActionPortal>
  )
}