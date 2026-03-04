"use client"

import { cn } from "@/lib/utils"
import { SidebarToggle } from "./SidebarToggle"



interface ControlCenterHeaderProps {
  isSidebarCollapsed: boolean
  toggleSidebar: () => void
  rightContent?: React.ReactNode
}

export function ControlCenterHeader({
  isSidebarCollapsed,
  toggleSidebar,
  rightContent
}: ControlCenterHeaderProps) {
  return (
    <div className="border-b flex-none h-[71px] flex items-center fixed w-[-webkit-fill-available] z-[999] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* SidebarToggle positioned absolutely - hidden on mobile */}
      <div className="hidden md:block">
        <SidebarToggle
          isCollapsed={isSidebarCollapsed}
          onToggle={toggleSidebar}
          className="absolute top-0 left-0"
        />
      </div>
      
      <div className={cn(
        "w-full flex items-center justify-between transition-[padding,margin] duration-300 ease-in-out mr-16",
        "ml-4 md:ml-[120px]"
      )}>
        <div className="flex items-center gap-8">
          {/* Filter button moved to TaskStatusFilter in sidebar */}
        </div>
        {rightContent}
      </div>
    </div>
  )
} 