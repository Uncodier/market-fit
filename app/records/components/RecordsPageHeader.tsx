"use client"

import type { ReactNode } from "react"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { SidebarToggle } from "@/app/control-center/components/SidebarToggle"

interface RecordsPageHeaderProps {
  isMobile: boolean
  isSidebarCollapsed: boolean
  toggleSidebar: () => void
  children: ReactNode
}

export function RecordsPageHeader({
  isMobile,
  isSidebarCollapsed, toggleSidebar, children,
}: RecordsPageHeaderProps) {
  return (
    <StickyHeader>
      <div className="flex w-full min-w-0 items-center gap-2 md:gap-3 md:py-3">
        {!isMobile && <SidebarToggle isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />}
        {children}
      </div>
    </StickyHeader>
  )
}