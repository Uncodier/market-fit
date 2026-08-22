"use client"

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react"
import { TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/app/components/ui/dropdown-menu"
import { MoreHorizontal } from "@/app/components/ui/icons"

export interface TabItem {
  value: string
  label: React.ReactNode
  icon?: React.ReactNode
}

interface ResponsiveTabsListProps {
  tabs: TabItem[]
  activeTab: string
  onTabChange: (value: string) => void
  className?: string
}

export function ResponsiveTabsList({ tabs, activeTab, onTabChange, className }: ResponsiveTabsListProps) {
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
        setTabWidths(widths.map(w => w + 8))
      }
      
      measure()
      // Recalculate slightly later to be safe
      const timer = setTimeout(measure, 100)
      return () => clearTimeout(timer)
    }
  }, [tabs])

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

  return (
    <div className="flex items-center w-full min-w-0" ref={containerRef}>
      {/* Hidden container purely for taking precise width measurements of each tab */}
      <div 
        ref={hiddenContainerRef} 
        className="absolute top-0 left-0 h-0 overflow-hidden opacity-0 pointer-events-none flex gap-1 whitespace-nowrap"
        aria-hidden="true"
      >
        {tabs.map((tab) => (
          <div 
            key={tab.value} 
            className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium"
          >
            <span className="flex items-center gap-2 whitespace-nowrap px-2 py-0">
              {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
            </span>
          </div>
        ))}
      </div>

      <TabsList className={`flex flex-nowrap justify-start w-full overflow-hidden ${className || ''}`}>
        {visibleTabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            <span className="flex items-center gap-2 whitespace-nowrap truncate max-w-[200px] px-2 py-0">
              {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
              <span className="truncate">{tab.label}</span>
            </span>
          </TabsTrigger>
        ))}

        {needsOverflow && hiddenTabs.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-muted/50 text-muted-foreground"
                title="Más opciones"
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
                  <div className="flex items-center gap-2 w-full">
                    {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
                    <span className="truncate">{tab.label}</span>
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
