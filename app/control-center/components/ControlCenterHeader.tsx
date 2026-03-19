"use client"

import { cn } from "@/lib/utils"
import { SidebarToggle } from "./SidebarToggle"
import { SearchInput } from "@/app/components/ui/search-input"
import { useLocalization } from "@/app/context/LocalizationContext"


interface ControlCenterHeaderProps {
  isSidebarCollapsed: boolean
  toggleSidebar: () => void
  leftContent?: React.ReactNode
  rightContent?: React.ReactNode
}

export function ControlCenterHeader({
  isSidebarCollapsed,
  toggleSidebar,
  leftContent,
  rightContent,
}: ControlCenterHeaderProps) {
  const { t } = useLocalization()

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
        "w-full flex items-center justify-between transition-[padding,margin] duration-300 ease-in-out pr-4 lg:pr-8",
        "ml-14 md:ml-[72px]"
      )}>
        <div className="flex items-center gap-2">
          {leftContent}
        </div>
        <div className="flex items-center gap-4">
          {rightContent}
        </div>
      </div>
    </div>
  )
} 