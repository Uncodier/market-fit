"use client"

import type { ReactNode } from "react"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { ControlCenterHeader } from "@/app/control-center/components/ControlCenterHeader"
import { Button } from "@/app/components/ui/button"
import { MoreVertical, X } from "@/app/components/ui/icons"

interface RecordsPageHeaderProps {
  isMobile: boolean
  isToolbarVisible: boolean
  onToolbarVisibilityChange: (visible: boolean) => void
  isSidebarCollapsed: boolean
  toggleSidebar: () => void
  sidebarLeft: string
  children: ReactNode
}

export function RecordsPageHeader({
  isMobile, isToolbarVisible, onToolbarVisibilityChange,
  isSidebarCollapsed, toggleSidebar, sidebarLeft, children,
}: RecordsPageHeaderProps) {
  if (isMobile) {
    return (
      <StickyHeader>
        <div className="flex min-w-0 w-full items-center justify-between gap-2 md:gap-0">{children}</div>
      </StickyHeader>
    )
  }

  return (
    <div className="relative">
      {isToolbarVisible ? (
        <ControlCenterHeader
          isSidebarCollapsed={isSidebarCollapsed}
          toggleSidebar={toggleSidebar}
          sidebarLeft={sidebarLeft}
          leftContent={children}
          rightContent={
            <Button variant="ghost" size="icon" aria-label="Hide record toolbar"
              onClick={() => onToolbarVisibilityChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          }
        />
      ) : (
        <Button variant="secondary" size="icon" className="absolute right-4 top-4 z-[100] rounded-full"
          aria-label="Show record toolbar" onClick={() => onToolbarVisibilityChange(true)}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}