"use client"

import { useState, useRef } from "react"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { RepositoriesSection } from "@/app/components/applications/RepositoriesSection"
import { useLocalization } from "@/app/context/LocalizationContext"
import { SearchInput } from "@/app/components/ui/search-input"
import { ViewSelector, ViewType } from "@/app/components/view-selector"
import { useMobileView } from "@/app/hooks/use-mobile-view"

export default function RepositoriesPage() {
  const { t } = useLocalization()
  const [searchQuery, setSearchQuery] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [viewMode, setViewMode] = useMobileView("table")

  return (
    <div className="flex-1 min-w-0 w-full p-0 min-h-[calc(100dvh-64px)] flex flex-col">
      <StickyHeader>
        <div className="w-full pt-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <SearchInput 
                  value={searchQuery}
                  onSearch={setSearchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("applications.searchRepositories") || "Search repositories..."}
                  ref={searchInputRef}
                  className="bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"
                  alwaysExpanded={false}
                />
              </div>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <ViewSelector currentView={viewMode} onViewChange={setViewMode} />
            </div>
          </div>
        </div>
      </StickyHeader>
      <div className="p-8 space-y-4 bg-muted/30 flex-1">
        <div className={viewMode === 'kanban' ? "overflow-x-auto pb-4 -mx-8" : "px-0"}>
          <div className={viewMode === 'kanban' ? "min-w-fit px-16" : ""}>
            <RepositoriesSection searchQuery={searchQuery} viewMode={viewMode} />
          </div>
        </div>
      </div>
    </div>
  )
}
