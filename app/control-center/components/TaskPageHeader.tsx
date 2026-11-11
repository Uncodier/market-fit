"use client"

import type { ReactNode } from "react"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer, FilterContainer, FilterSection } from "@/app/components/ui/mobile-filters-drawer"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ControlCenterHeader } from "./ControlCenterHeader"

interface TaskPageHeaderProps {
  isMobile: boolean
  isSidebarCollapsed: boolean
  toggleSidebar: () => void
  sidebarLeft: string
  leftContent: ReactNode
  rightContent: ReactNode
  viewContent: ReactNode
}

export function TaskPageHeader({
  isMobile, isSidebarCollapsed, toggleSidebar, sidebarLeft,
  leftContent, rightContent, viewContent,
}: TaskPageHeaderProps) {
  const { t } = useLocalization()

  if (isMobile) {
    return (
      <StickyHeader>
        <div className="flex min-w-0 w-full items-center justify-between gap-2">
          <MobileFiltersDrawer>
            <FilterContainer>
              <FilterSection title={t("common.search") || "Search"}>
                {leftContent}
              </FilterSection>
              <FilterSection title={t("controlCenter.sortBy") || "Sort by"}>
                {rightContent}
              </FilterSection>
            </FilterContainer>
          </MobileFiltersDrawer>
          <div className="ml-auto shrink-0">{viewContent}</div>
        </div>
      </StickyHeader>
    )
  }

  return (
    <ControlCenterHeader
      isSidebarCollapsed={isSidebarCollapsed}
      toggleSidebar={toggleSidebar}
      sidebarLeft={sidebarLeft}
      leftContent={leftContent}
      rightContent={<div className="flex items-center gap-2">{rightContent}{viewContent}</div>}
    />
  )
}