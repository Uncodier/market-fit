"use client"

import { cn } from "@/lib/utils"
import { SidebarToggle } from "./SidebarToggle"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"

interface ControlCenterHeaderProps {
  isSidebarCollapsed: boolean
  toggleSidebar: () => void
  leftContent?: React.ReactNode
  rightContent?: React.ReactNode
  sidebarLeft?: string
}

export function ControlCenterHeader({
  isSidebarCollapsed,
  toggleSidebar,
  leftContent,
  rightContent,
  sidebarLeft = "256px"
}: ControlCenterHeaderProps) {
  const { t } = useLocalization()
  const isMobile = useIsMobile()

  return (
    <div 
      className="border-b flex-none h-[71px] flex items-center fixed z-[99] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-all duration-300 ease-in-out"
      style={{
        left: 0,
        width: '100%',
      }}
    >
      <div className={cn(
        "w-full flex items-center justify-between transition-all duration-300 ease-in-out px-4 lg:px-6"
      )}
      style={{
        paddingLeft: isMobile ? '1rem' : `calc(${sidebarLeft} + ${!isSidebarCollapsed ? "319px" : "0px"} + 1rem)`
      }}>
        <div className="flex items-center gap-1 md:gap-3">
          <div className="hidden md:flex items-center">
            <SidebarToggle
              isCollapsed={isSidebarCollapsed}
              onToggle={toggleSidebar}
            />
          </div>
          {leftContent}
        </div>
        <div className="flex items-center gap-4">
          {rightContent}
        </div>
      </div>
    </div>
  )
}
