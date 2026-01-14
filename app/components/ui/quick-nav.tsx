"use client"

import { useEffect, useState, useRef } from "react"
import { cn } from "@/app/lib/utils"

export interface QuickNavSection {
  id: string
  title: string
  icon?: string
  children?: QuickNavSection[]
}

interface QuickNavProps {
  sections: QuickNavSection[]
  className?: string
}

export function QuickNav({ sections, className }: QuickNavProps) {
  const [activeSection, setActiveSection] = useState<string>("")
  const observerRef = useRef<IntersectionObserver | null>(null)
  const isManualClickRef = useRef(false)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const intersectingRef = useRef<Map<string, IntersectionObserverEntry>>(new Map())

  useEffect(() => {
    if (sections.length === 0) {
      setActiveSection("")
      return
    }
    
    // Reset state when sections change
    setActiveSection("")
    isManualClickRef.current = false
    intersectingRef.current.clear()

    // Get all section IDs (including children)
    const getAllSectionIds = (sections: QuickNavSection[]): string[] => {
      const ids: string[] = []
      sections.forEach(section => {
        ids.push(section.id)
        if (section.children) {
          ids.push(...getAllSectionIds(section.children))
        }
      })
      return ids
    }

    const allSectionIds = getAllSectionIds(sections)

    // Set initial active section after a small delay to ensure DOM is ready
    const initTimer = setTimeout(() => {
      if (allSectionIds.length > 0) {
        let foundVisibleSection = false
        let bestMatch = { id: allSectionIds[0], score: -Infinity }
        
        // Find the most visible element
        for (const sectionId of allSectionIds) {
          const element = document.getElementById(sectionId)
          if (element) {
            const rect = element.getBoundingClientRect()
            // Check if any part is visible
            if (rect.bottom > 0 && rect.top < window.innerHeight) {
              const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)
              const visibilityRatio = visibleHeight / rect.height
              const distanceFromTop = Math.abs(rect.top - 200)
              const score = (visibilityRatio * 1000) - distanceFromTop
              
              if (score > bestMatch.score) {
                bestMatch = { id: sectionId, score }
                foundVisibleSection = true
              }
            }
          }
        }
        
        setActiveSection(bestMatch.id)
      }
    }, 200)

    const updateActiveSection = () => {
      if (isManualClickRef.current) return

      const intersecting = Array.from(intersectingRef.current.values())
        .filter(entry => entry.isIntersecting)

      if (intersecting.length === 0) return

      // Find all section IDs to check for parent-child relationships
      const getAllIds = (sections: QuickNavSection[]): Set<string> => {
        const ids = new Set<string>()
        sections.forEach(section => {
          ids.add(section.id)
          if (section.children) {
            section.children.forEach(child => ids.add(child.id))
          }
        })
        return ids
      }

      const allIds = getAllIds(sections)

      // Score each intersecting element based on visibility and position
      const scored = intersecting.map(entry => {
        const rect = entry.boundingClientRect
        const distanceFromTop = Math.abs(rect.top - 200)
        
        // Calculate how much of the element is visible
        const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)
        const totalHeight = rect.height
        const visibilityRatio = visibleHeight / totalHeight
        
        // Prefer elements that are more visible and closer to the reading position
        const score = (visibilityRatio * 1000) - distanceFromTop
        
        return { entry, score, distanceFromTop, visibilityRatio }
      })

      // Sort by score (higher is better)
      scored.sort((a, b) => b.score - a.score)

      const newActiveId = scored[0].entry.target.id
      setActiveSection(prevActive => {
        // Only update if it's actually different to prevent unnecessary re-renders
        return prevActive !== newActiveId ? newActiveId : prevActive
      })
    }

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      // Update the intersecting map
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          intersectingRef.current.set(entry.target.id, entry)
        } else {
          intersectingRef.current.delete(entry.target.id)
        }
      })

      // Clear previous timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }

      // Debounce the update to prevent flickering
      updateTimeoutRef.current = setTimeout(() => {
        updateActiveSection()
      }, 100)
    }

    const observerOptions: IntersectionObserverInit = {
      root: null,
      rootMargin: "-180px 0px -50% 0px",
      threshold: [0, 0.25, 0.5, 0.75, 1],
    }

    const observer = new IntersectionObserver(observerCallback, observerOptions)
    observerRef.current = observer

    // Observe all sections including children with a small delay
    const observeTimer = setTimeout(() => {
      const observeSection = (section: QuickNavSection) => {
        const element = document.getElementById(section.id)
        if (element) {
          observer.observe(element)
        }
        if (section.children) {
          section.children.forEach(observeSection)
        }
      }

      sections.forEach(observeSection)
    }, 100)

    return () => {
      clearTimeout(initTimer)
      clearTimeout(observeTimer)
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
      observer.disconnect()
      intersectingRef.current.clear()
    }
  }, [sections])

  const handleSectionClick = (sectionId: string) => {
    // Immediately update active section
    setActiveSection(sectionId)
    isManualClickRef.current = true
    
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }

    // Reset manual click flag after scroll completes
    setTimeout(() => {
      isManualClickRef.current = false
    }, 1000)
  }

  const renderSection = (section: QuickNavSection, isChild = false) => (
    <div key={section.id}>
      <button
        onClick={() => handleSectionClick(section.id)}
        className={cn(
          "w-full text-left py-2 transition-colors relative rounded-md",
          isChild ? "pl-6 pr-3 text-xs" : "px-3 text-sm",
          activeSection === section.id
            ? "text-primary font-medium"
            : isChild 
              ? "text-muted-foreground/80 hover:text-foreground hover:bg-muted/50"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        <div className="flex items-center gap-2">
          {isChild && <span className="text-[6px] text-muted-foreground/60">●</span>}
          {section.icon && <span className="text-base">{section.icon}</span>}
          <span className="truncate">{section.title}</span>
        </div>
        {activeSection === section.id && (
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-r" />
        )}
      </button>
      {section.children && (
        <div className="space-y-0.5 mt-1 ml-3 border-l border-border/40 pl-0.5">
          {section.children.map((child) => renderSection(child, true))}
        </div>
      )}
    </div>
  )

  if (sections.length === 0) return null

  return (
    <div className={cn("hidden xl:block w-[240px] flex-shrink-0", className)}>
      <div className="sticky top-[167px] w-[240px] max-h-[calc(100vh-200px)] overflow-y-auto">
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            On this page
          </h4>
          <nav className="space-y-1">
            {sections.map((section) => renderSection(section))}
          </nav>
        </div>
      </div>
    </div>
  )
}
