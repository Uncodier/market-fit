"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Globe, LayoutGrid, CheckCircle2, PenSquare } from "@/app/components/ui/icons"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer } from "@/app/components/ui/mobile-filters-drawer"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/app/components/ui/dialog"
import { getSegments, updateSegmentUrl, updateSegmentStatus } from "./actions"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { Segment } from "@/app/types/segments"
import { SearchInput } from "@/app/components/ui/search-input"
import { useRouter } from "next/navigation"
import { navigateToSegment } from "@/app/hooks/use-navigation-history"
import { useLocalization } from "@/app/context/LocalizationContext"
import { SegmentsTable, SegmentsTableSkeleton } from "./components/SegmentsTable"

export default function SegmentsPage() {
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft">("all")
  const [activeSegments, setActiveSegments] = useState<Record<string, boolean>>({})
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false)
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [copiedUrlId, setCopiedUrlId] = useState<string | null>(null)

  const { data: segmentsData, isLoading, error, mutate: mutateSegments } = useSWR(
    currentSite?.id ? ["segments", currentSite.id] : null,
    async ([, siteId]) => {
      const result = await getSegments(siteId)
      if (result.error) throw new Error(result.error)
      return (result.segments || []) as Segment[]
    },
    {
      onSuccess: (data) => {
        setActiveSegments((prev) => {
          const next = { ...prev }
          data.forEach((segment) => {
            if (next[segment.id] === undefined) next[segment.id] = segment.is_active
          })
          return next
        })
      },
    }
  )

  const segments = segmentsData || []

  useEffect(() => {
    const event = new CustomEvent("breadcrumb:update", {
      detail: { title: t("layout.sidebar.segments") || "Segments" },
    })
    window.dispatchEvent(event)
  }, [t])

  const filteredSegments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return segments.filter((segment) => {
      const isActive = activeSegments[segment.id] ?? segment.is_active
      if (statusFilter === "active" && !isActive) return false
      if (statusFilter === "draft" && isActive) return false
      if (!query) return true
      const haystack = [
        segment.name,
        segment.description,
        segment.audience,
        segment.icp?.role,
        segment.icp?.industry,
        segment.icp?.location,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [segments, searchTerm, statusFilter, activeSegments])

  const toggleSegmentStatus = async (id: string) => {
    const previous = activeSegments[id]
    const next = !previous
    setActiveSegments((current) => ({ ...current, [id]: next }))
    const result = await updateSegmentStatus({ segmentId: id, isActive: next })
    if (result.error) {
      console.error("Error updating segment status:", result.error)
      setActiveSegments((current) => ({ ...current, [id]: previous }))
    }
  }

  const copySegmentUrl = async (segmentId: string) => {
    const segment = segments.find((item) => item.id === segmentId)
    if (!segment?.url) return
    try {
      await navigator.clipboard.writeText(segment.url)
      setCopiedUrlId(segmentId)
      setTimeout(() => setCopiedUrlId(null), 2000)
    } catch (err) {
      console.error("Error copying segment URL:", err)
    }
  }

  const handleConfigureUrl = (segmentId: string) => {
    const segment = segments.find((item) => item.id === segmentId)
    setSelectedSegmentId(segmentId)
    setUrlInput(segment?.url || "")
    setSaveError(null)
    setIsUrlModalOpen(true)
  }

  const handleSaveUrl = async () => {
    if (!selectedSegmentId) return
    try {
      setIsSaving(true)
      setSaveError(null)
      const result = await updateSegmentUrl({ segmentId: selectedSegmentId, url: urlInput })
      if (result.error) {
        setSaveError(result.error)
        return
      }
      mutateSegments((current) => {
        if (!current) return current
        return current.map((segment) =>
          segment.id === selectedSegmentId ? { ...segment, url: urlInput } : segment
        )
      }, { revalidate: false })
      setIsUrlModalOpen(false)
      setSelectedSegmentId(null)
      setUrlInput("")
    } catch (err) {
      console.error("Error saving segment URL:", err)
      setSaveError(t("segments.dialog.saveError") || "Could not save the segment URL")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex-1 min-w-0 w-full p-0 min-h-[calc(100dvh-var(--topbar-height,64px))] flex flex-col">
      <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)} className="flex-1 flex flex-col w-full h-full min-h-0">
        <StickyHeader>
          <div className="w-full pt-0">
            <div className="flex items-center gap-4">
              <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-lg md:rounded-full flex flex-col md:flex-row w-full md:max-w-full overflow-y-auto md:overflow-x-auto justify-start items-stretch md:items-center gap-1 md:gap-0">
                <TabsTrigger value="all" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap" title={t("segments.tabs.all") || "All Segments"}>
                  <LayoutGrid size={13} className="md:!hidden" />
                  <span className="tab-label">{t("segments.tabs.all") || "All Segments"}</span>
                </TabsTrigger>
                <TabsTrigger value="active" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap" title={t("segments.tabs.active") || "Active"}>
                  <CheckCircle2 size={13} className="md:!hidden" />
                  <span className="tab-label">{t("segments.tabs.active") || "Active"}</span>
                </TabsTrigger>
                <TabsTrigger value="draft" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap" title={t("segments.tabs.draft") || "Draft"}>
                  <PenSquare size={13} className="md:!hidden" />
                  <span className="tab-label">{t("segments.tabs.draft") || "Draft"}</span>
                </TabsTrigger>
              </TabsList>
              <SearchInput containerClassName="w-full" className="w-full h-10 md:h-9"
                data-command-k-input
                placeholder={t("segments.searchPlaceholder") || "Search segments..."}
                className="w-full"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)} />
            </div>
          </div>
        </StickyHeader>

        <div className="p-8 bg-muted/30 flex-1">
          {!currentSite || isLoading ? (
            <SegmentsTableSkeleton />
          ) : error ? (
            <div className="text-center space-y-3 py-12">
              <p className="text-sm text-red-500">{t("segments.table.loadError") || "Could not load segments."}</p>
              <p className="text-xs text-muted-foreground">
                {currentSite ? currentSite.name : (t("segments.table.noSite") || "No site selected")}
              </p>
            </div>
          ) : (
            <SegmentsTable
              segments={filteredSegments}
              activeById={activeSegments}
              searchQuery={searchTerm}
              onSegmentClick={(segment) => navigateToSegment({ segmentId: segment.id, segmentName: segment.name, router })}
              onToggleStatus={toggleSegmentStatus}
              onCopyUrl={copySegmentUrl}
              onConfigureUrl={handleConfigureUrl}
              copiedUrlId={copiedUrlId} />
          )}
        </div>
      </Tabs>

      <Dialog open={isUrlModalOpen} onOpenChange={setIsUrlModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("segments.dialog.configureUrl") || "Configure Segment URL"}</DialogTitle>
            <DialogDescription>
              {t("segments.dialog.configureUrlDesc") || "Enter the URL where this segment's content can be previewed."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="relative">
              <Globe className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
              <Input
                id="url"
                placeholder="https://example.com/segment-preview"
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                className="w-full h-12 pl-10"
                disabled={isSaving} />
            </div>
            {saveError ? <p className="text-sm text-red-500">{saveError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUrlModalOpen(false)} disabled={isSaving}>
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button onClick={handleSaveUrl} disabled={isSaving}>
              {isSaving ? (
                <>
                  <LoadingSkeleton variant="button" size="sm" />
                  {t("common.saving") || "Saving..."}
                </>
              ) : (
                t("common.save") || "Save URL"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
