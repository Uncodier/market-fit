"use client"

import React, { useMemo } from "react"
import { cn } from "@/lib/utils"
import { useResponsiveTabsFit } from "./use-responsive-tabs-fit"
import { TabsList, TabsTrigger, tabsListClassName, tabsTriggerClassName } from "@/app/components/ui/tabs"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/app/components/ui/dropdown-menu"
import { MoreHorizontal } from "@/app/components/ui/icons"

export interface TabAction {
  label: string
  icon: React.ReactNode
  onSelect: () => void
}

export interface TabItem {
  value: string
  label: React.ReactNode
  icon?: React.ReactNode
  leadingAction?: TabAction
  trailingAction?: TabAction
}

interface ResponsiveTabsListProps {
  tabs: TabItem[]
  activeTab: string
  onTabChange: (value: string) => void
  className?: string
  containerClassName?: string
  triggerClassName?: string
  onPreferredWidthChange?: (width: number) => void
}

export function ResponsiveTabsList({
  tabs,
  activeTab,
  onTabChange,
  className,
  containerClassName,
  triggerClassName,
  onPreferredWidthChange,
}: ResponsiveTabsListProps) {
  const measurementContent = useMemo(() => [tabs, className, triggerClassName, containerClassName],
    [tabs, className, triggerClassName, containerClassName])
  const { containerRef, measurementRef, visibleIndices } = useResponsiveTabsFit(
    tabs.length, tabs.findIndex(tab => tab.value === activeTab),
    measurementContent, onPreferredWidthChange,
  )
  const indices = visibleIndices ?? tabs.map((_, index) => index)
  const visibleTabs = indices.map(index => tabs[index]).filter(Boolean)
  const hiddenTabs = tabs.filter((_, index) => !indices.includes(index))
  const listClassName = cn("inline-flex min-w-0 max-w-full flex-nowrap justify-start", className)
  const tabClassName = cn("rounded-[inherit] shrink-0", triggerClassName)
  const overflowClassName = "inline-flex max-w-full shrink-0 items-center justify-center whitespace-nowrap rounded-[inherit] px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 text-muted-foreground hover:text-foreground"
  const renderTabContent = (tab: TabItem) => (
    <span className={`flex min-w-0 max-w-[200px] items-center gap-2 whitespace-nowrap py-0 ${
      tab.leadingAction || tab.trailingAction ? "px-7" : "px-2"
    }`}>
      {tab.icon && (
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center leading-none [&>svg]:block [&>svg]:h-4 [&>svg]:w-4">
          {tab.icon}
        </span>
      )}
      <span className="truncate">{tab.label}</span>
    </span>
  )
  const renderOverflowContent = (count: number) => (
    <span className="flex min-w-0 items-center gap-1 overflow-hidden">
      <MoreHorizontal className="h-4 w-4 shrink-0" />
      <span className="text-xs" data-overflow-count>{count}</span>
    </span>
  )

  const renderAction = (
    action: TabAction,
    position: "leading" | "trailing",
    compact = false,
  ) => (
    <button
      type="button"
      aria-label={action.label}
      title={action.label}
      className={
        compact
          ? "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-black/10 hover:text-foreground dark:hover:bg-white/10"
          : `absolute top-1/2 z-10 inline-flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-black/10 hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100 dark:hover:bg-white/10 ${
              position === "leading" ? "left-1.5" : "right-1.5"
            }`
      }
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        action.onSelect()
      }}
    >
      {action.icon}
    </button>
  )

  return (
    <div
      className={`flex items-center w-full min-w-0 ${containerClassName || ''}`}
      ref={containerRef}
    >
      {/* Intrinsic copies share styles without registering hidden tabs in Radix navigation. */}
      <div className="absolute h-0 w-0 overflow-hidden pointer-events-none" aria-hidden="true" inert>
        <div
          ref={measurementRef}
          className={cn(tabsListClassName, listClassName, "!w-max !max-w-none !justify-start")}
        >
          {tabs.map(tab => (
            <div key={tab.value} data-state={tab.value === activeTab ? "active" : "inactive"}
              data-tab-measure className={cn(tabsTriggerClassName, tabClassName)}>
              {renderTabContent(tab)}
            </div>
          ))}
          <button type="button" tabIndex={-1} data-overflow-measure className={overflowClassName}>
            {renderOverflowContent(tabs.length)}
          </button>
        </div>
      </div>

      <TabsList className={cn(listClassName, "overflow-hidden")}>
        {visibleTabs.map((tab) => {
          const hasActions = Boolean(tab.leadingAction || tab.trailingAction)
          const trigger = (
            <TabsTrigger
              value={tab.value}
              className={tabClassName}
            >
              {renderTabContent(tab)}
            </TabsTrigger>
          )

          if (!hasActions) {
            return <React.Fragment key={tab.value}>{trigger}</React.Fragment>
          }

          return (
            <div
              key={tab.value}
              className="group relative inline-flex shrink-0 items-center self-center rounded-[inherit]"
            >
              {trigger}
              {tab.leadingAction && renderAction(tab.leadingAction, "leading")}
              {tab.trailingAction && renderAction(tab.trailingAction, "trailing")}
            </div>
          )
        })}

        {hiddenTabs.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={overflowClassName}
                title="More options"
                aria-label="More options"
              >
                {renderOverflowContent(hiddenTabs.length)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
              {hiddenTabs.map((tab) => (
                <DropdownMenuItem 
                  key={tab.value} 
                  onClick={() => onTabChange(tab.value)}
                  className={tab.value === activeTab ? 'bg-muted font-medium' : ''}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {tab.icon && (
                        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center leading-none [&>svg]:block [&>svg]:h-4 [&>svg]:w-4">
                          {tab.icon}
                        </span>
                      )}
                      <span className="truncate">{tab.label}</span>
                    </div>
                    {(tab.leadingAction || tab.trailingAction) && (
                      <div className="flex shrink-0 items-center gap-1">
                        {tab.leadingAction &&
                          renderAction(tab.leadingAction, "leading", true)}
                        {tab.trailingAction &&
                          renderAction(tab.trailingAction, "trailing", true)}
                      </div>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TabsList>
    </div>
  )
}
