"use client"

import { cn } from "@/lib/utils"
import { SidebarToggle } from "./SidebarToggle"
import { useLocalization } from "@/app/context/LocalizationContext"


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

  return (
    <div 
      className="border-b flex-none h-[71px] flex items-center fixed z-[99] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-all duration-300 ease-in-out"
      style={{
        left: 0,
        width: '100%',
      }}
    >
      <div className="hidden md:block absolute top-0" style={{ left: sidebarLeft, transition: 'left 300ms ease-in-out' }}>
        <SidebarToggle
          isCollapsed={isSidebarCollapsed}
          onToggle={toggleSidebar}
          className="absolute top-0 left-0"
        />
      </div>
      
      <div className={cn(
        "w-full flex items-center justify-between transition-all duration-300 ease-in-out px-4 lg:px-8"
      )}
      style={{
        paddingLeft: `calc(${sidebarLeft} + ${!isSidebarCollapsed ? "319px" : "0px"} + 1rem)`
      }}>
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
