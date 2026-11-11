"use client"

import type { ReactNode } from "react"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { ControlCenterHeader } from "@/app/control-center/components/ControlCenterHeader"

interface RecordsPageHeaderProps {
  isMobile: boolean
  isSidebarCollapsed: boolean
  toggleSidebar: () => void
  sidebarLeft: string
  children: ReactNode
}

export function RecordsPageHeader({
  isMobile,
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
    <ControlCenterHeader
      isSidebarCollapsed={isSidebarCollapsed}
      toggleSidebar={toggleSidebar}
      sidebarLeft={sidebarLeft}
      leftContent={children}
    />
  )
}