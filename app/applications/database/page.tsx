"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { AppsListSection } from "@/app/components/applications/AppsListSection"
import { useLocalization } from "@/app/context/LocalizationContext"
import { SearchInput } from "@/app/components/ui/search-input"
import { ViewSelector, ViewType } from "@/app/components/view-selector"
import { useMobileView } from "@/app/hooks/use-mobile-view"
import { useSearchParams } from "next/navigation"

function DatabasePageContent() {
  const { t } = useLocalization()
  const [searchQuery, setSearchQuery] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [viewMode, setViewMode] = useMobileView("kanban")
  const searchParams = useSearchParams()
  const isArtifact = searchParams.get("artifact") === "true"
  const robotInstanceId = searchParams.get("robotInstanceId")

  const handleSearch = (value: string) => {
    setSearchQuery(value)
  }

  return (
    <div className={`flex-1 min-w-0 w-full p-0 flex flex-col ${isArtifact ? 'h-full min-h-full' : 'min-h-[calc(100dvh-64px)]'}`}>
      <StickyHeader>
        <div className="w-full pt-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <SearchInput
                  placeholder={t('applications.search') || 'Search databases...'}
                  value={searchQuery}
                  onSearch={handleSearch}
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
        {viewMode === 'kanban' ? (
          <div className="overflow-x-auto pb-4 -mx-8">
            <div className="min-w-fit px-8">
              <AppsListSection searchQuery={searchQuery} viewMode={viewMode} robotInstanceId={robotInstanceId || undefined} />
            </div>
          </div>
        ) : (
          <AppsListSection searchQuery={searchQuery} viewMode={viewMode} robotInstanceId={robotInstanceId || undefined} />
        )}
      </div>
    </div>
  )
}

export default function DatabasePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
      <DatabasePageContent />
    </Suspense>
  )
}
