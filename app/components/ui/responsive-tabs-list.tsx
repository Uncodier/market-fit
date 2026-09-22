"use client"

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react"
import { TabsList, TabsTrigger } from "@/app/components/ui/tabs"
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
  const containerRef = useRef<HTMLDivElement>(null)
  const hiddenContainerRef = useRef<HTMLDivElement>(null)
  
  const [maxVisibleTabs, setMaxVisibleTabs] = useState(tabs.length)
  const [tabWidths, setTabWidths] = useState<number[]>([])

  // 1. Measure all tabs once on mount or when tabs change
  useLayoutEffect(() => {
    if (hiddenContainerRef.current) {
      // Need a tiny delay sometimes to ensure fonts/styles have loaded
      const measure = () => {
        if (!hiddenContainerRef.current) return
        const widths = Array.from(hiddenContainerRef.current.children).map(
          (child) => (child as HTMLElement).getBoundingClientRect().width
        )
        // Add a small safety buffer (8px) to each tab width
        const bufferedWidths = widths.map((width) => Math.ceil(width) + 8)
        setTabWidths(bufferedWidths)

        const gap = 4
        const listPadding = 16
        const preferredWidth =
          bufferedWidths.reduce((total, width) => total + width, 0) +
          Math.max(0, bufferedWidths.length - 1) * gap +
          listPadding
        onPreferredWidthChange?.(preferredWidth)
      }
      
      measure()
      // Recalculate slightly later to be safe
      const timer = setTimeout(measure, 100)
      return () => clearTimeout(timer)
    }
  }, [tabs, onPreferredWidthChange, triggerClassName])

  // 2. Calculate how many tabs fit based on exact pixel widths
  const calculateMaxVisibleTabs = useCallback(() => {
    if (!containerRef.current || tabWidths.length === 0) return

    const containerW = containerRef.current.clientWidth
    if (containerW === 0) return

    const moreButtonWidth = 65 // "..." button width + gap buffer
    const gap = 4 // gap between tabs
    const paddingBuffer = 16 // padding of TabsList container itself (8px each side)

    const availableWidth = containerW - paddingBuffer

    let currentWidth = 0
    let maxTabs = 0

    // Si todo cabe perfectamente sin el botón More, devolvemos length
    const totalNeededWidth = tabWidths.reduce((acc, w) => acc + w + gap, 0) - gap
    if (totalNeededWidth <= availableWidth) {
      setMaxVisibleTabs(tabs.length)
      return
    }

    for (let i = 0; i < tabs.length; i++) {
      const tabW = tabWidths[i]
      
      // Si necesitamos cortar, hay que sumar siempre el botón de More
      const widthNeeded = currentWidth + tabW + gap + moreButtonWidth

      if (widthNeeded <= availableWidth) {
        currentWidth += tabW + gap
        maxTabs = i + 1
      } else {
        break // Stop fitting tabs
      }
    }

    // Always show at least 1 tab to avoid empty states
    setMaxVisibleTabs(Math.max(1, maxTabs))
  }, [tabs.length, tabWidths])

  // 3. React to window resize to recalculate the fit
  useEffect(() => {
    if (!containerRef.current) return

    let timeoutId: NodeJS.Timeout
    const observer = new ResizeObserver(() => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(calculateMaxVisibleTabs, 50)
    })

    observer.observe(containerRef.current)
    calculateMaxVisibleTabs()

    return () => {
      observer.disconnect()
      clearTimeout(timeoutId)
    }
  }, [calculateMaxVisibleTabs])

  const needsOverflow = tabs.length > maxVisibleTabs
  let visibleTabs: TabItem[] = []
  let hiddenTabs: TabItem[] = []

  if (!needsOverflow) {
    visibleTabs = tabs
  } else {
    const effectiveMax = maxVisibleTabs
    const activeTabIndex = tabs.findIndex(t => t.value === activeTab)

    if (activeTabIndex === -1 || activeTabIndex < effectiveMax) {
      visibleTabs = tabs.slice(0, effectiveMax)
      hiddenTabs = tabs.slice(effectiveMax)
    } else {
      // Ensure the active tab is always visible by swapping the last visible tab with the active one
      visibleTabs = [
        ...tabs.slice(0, effectiveMax - 1),
        tabs[activeTabIndex]
      ]
      hiddenTabs = [
        ...tabs.slice(effectiveMax - 1, activeTabIndex),
        ...tabs.slice(activeTabIndex + 1)
      ]
    }
  }

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
      {/* Hidden container purely for taking precise width measurements of each tab */}
      <div 
        ref={hiddenContainerRef} 
        className="absolute top-0 left-0 h-0 overflow-hidden opacity-0 pointer-events-none flex gap-1 whitespace-nowrap"
        aria-hidden="true"
      >
        {tabs.map((tab) => (
          <div 
            key={tab.value} 
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ${triggerClassName || ''}`}
          >
            <span
              className={`flex items-center gap-2 whitespace-nowrap py-0 ${
                tab.leadingAction || tab.trailingAction ? "px-7" : "px-2"
              }`}
            >
              {tab.icon && (
                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center leading-none [&>svg]:block [&>svg]:h-4 [&>svg]:w-4">
                  {tab.icon}
                </span>
              )}
              <span>{tab.label}</span>
            </span>
          </div>
        ))}
      </div>

      <TabsList className={`inline-flex max-w-full flex-nowrap justify-start ${className || ''}`}>
        {visibleTabs.map((tab) => (
          <div key={tab.value} className="group relative shrink-0">
            <TabsTrigger
              value={tab.value}
              className={`rounded-[inherit] ${triggerClassName || ''}`}
            >
              <span
                className={`flex max-w-[200px] items-center gap-2 whitespace-nowrap py-0 ${
                  tab.leadingAction || tab.trailingAction ? "px-7" : "px-2"
                }`}
              >
                {tab.icon && (
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center leading-none [&>svg]:block [&>svg]:h-4 [&>svg]:w-4">
                    {tab.icon}
                  </span>
                )}
                <span className="truncate">{tab.label}</span>
              </span>
            </TabsTrigger>
            {tab.leadingAction && renderAction(tab.leadingAction, "leading")}
            {tab.trailingAction && renderAction(tab.trailingAction, "trailing")}
          </div>
        ))}

        {needsOverflow && hiddenTabs.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-[inherit] px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 text-muted-foreground hover:text-foreground"
                title="More options"
              >
                <span className="flex items-center gap-1">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="text-xs">{hiddenTabs.length}</span>
                </span>
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
