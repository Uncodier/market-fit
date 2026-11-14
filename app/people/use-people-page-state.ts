import { useEffect, useState } from "react"
import { useLayout } from "@/app/context/LayoutContext"
import { RelationSelectValue } from "@/app/components/ui/relation-select"
import { useSite } from "@/app/context/SiteContext"
import { useBillingCheck } from "@/app/hooks/use-billing-check"
import { useBillingLimit } from "@/app/context/BillingLimitContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import pricingConfig from "@/app/config/pricing.json"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSearchParams } from "next/navigation"

import { useSavedFinderLists } from "./use-saved-finder-lists"

export function usePeoplePageState() {
  const searchParams = useSearchParams()
  const isArtifact = searchParams ? searchParams.get("artifact") === "true" : false
  const urlSort = searchParams ? searchParams.get('sort') : null
  const defaultSort = urlSort === 'updated_at' ? 'updated_at' : (urlSort === 'created_at' || urlSort === 'newest' ? 'newest' : (urlSort === 'oldest' ? 'oldest' : 'newest'))
  const [sortBy, setSortBy] = useState(defaultSort)

  const { t } = useLocalization()
  const { isLayoutCollapsed } = useLayout()
  const isMobile = useIsMobile()
  const { currentSite } = useSite()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [sidebarLeft, setSidebarLeft] = useState("256px")
  const [peopleTab, setPeopleTab] = useState<"search" | "saved">("search")
  // Mobile two-step: step 1 = filters, step 2 = results
  const [showResultsOnMobile, setShowResultsOnMobile] = useState(false)
  // pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [pageJump, setPageJump] = useState<string>("")

  // remote data state
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [totalResults, setTotalResults] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [addingToLeads, setAddingToLeads] = useState(false)
  const [isSegmentModalOpen, setIsSegmentModalOpen] = useState(false)

  const { creditsAvailable } = useBillingCheck()
  const { showBillingLimit, showBillingLimitFromError } = useBillingLimit()
  const enrichmentCostPerLead = pricingConfig.pricing_map.find(p => p.name === "Enrichment (Details)")?.cost_per_call || 0.1
  const requiredCredits = Math.ceil(totalResults * enrichmentCostPerLead * 10) / 10 // rounding to 1 decimal
  const hasEnoughCredits = creditsAvailable >= requiredCredits
  const [segmentsLoading, setSegmentsLoading] = useState(false)
  const [availableSegments, setAvailableSegments] = useState<Array<{ id: string; name: string }>>([])
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | 'none'>('none')
  const [icpName, setIcpName] = useState<string>("")
  const [isIcpModalOpen, setIsIcpModalOpen] = useState(false)
  const { lists: availableIcps, loading: icpListLoading, error: icpListError, refresh: refreshIcps, remove: removeIcp, rename: renameIcp } = useSavedFinderLists(currentSite?.id, peopleTab === 'saved')
  const [selectedIcpId, setSelectedIcpId] = useState<string | 'none'>('none')
  const [collapsibleVersion, setCollapsibleVersion] = useState(0)
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([])
  const [isEnriching, setIsEnriching] = useState(false)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [addedPersonIds, setAddedPersonIds] = useState<Set<string>>(new Set())
  const [isEditIcpModalOpen, setIsEditIcpModalOpen] = useState(false)
  const [editingIcp, setEditingIcp] = useState<{ id: string; name: string | null; role_query_id: string } | null>(null)
  const [editingIcpName, setEditingIcpName] = useState<string>("")
  const [editingIcpSegmentValue, setEditingIcpSegmentValue] = useState<RelationSelectValue>(null)
  const [editingIcpSegmentsLoading, setEditingIcpSegmentsLoading] = useState(false)
  // Persist collapsed/expanded state for Saved lists tab so it survives tab switches
  const [savedSectionOpenDefaults, setSavedSectionOpenDefaults] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setSidebarLeft(isMobile ? "0px" : isArtifact ? "0px" : isLayoutCollapsed ? "64px" : "256px")
  }, [isLayoutCollapsed, isMobile, isArtifact])

  useEffect(() => {
    document.title = "Find People | Market Fit"
    const event = new CustomEvent("breadcrumb:update", {
      detail: { title: "Find People", path: "/people", section: "Find People" }
    })
    window.dispatchEvent(event)
    return () => { document.title = "Market Fit" }
  }, [])

  // Update TopBar breadcrumb with results count
  useEffect(() => {
    // Only update the breadcrumb item label with the results, let the base path stay
    const event = new CustomEvent("breadcrumb:update", {
      detail: {
        title: `Find People (${(totalResults || 0).toLocaleString()} results)`,
        path: "/people",
        section: "Find People"
      }
    })
    window.dispatchEvent(event)
  }, [totalResults])
  return {
    searchParams,
    isArtifact,
    urlSort,
    defaultSort,
    sortBy,
    setSortBy,
    t,
    isLayoutCollapsed,
    isMobile,
    currentSite,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    sidebarLeft,
    setSidebarLeft,
    peopleTab,
    setPeopleTab,
    showResultsOnMobile,
    setShowResultsOnMobile,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    pageJump,
    setPageJump,
    searchResults,
    setSearchResults,
    totalResults,
    setTotalResults,
    error,
    setError,
    expandedGroups,
    setExpandedGroups,
    addingToLeads,
    setAddingToLeads,
    isSegmentModalOpen,
    setIsSegmentModalOpen,
    creditsAvailable,
    showBillingLimit,
    showBillingLimitFromError,
    enrichmentCostPerLead,
    requiredCredits,
    hasEnoughCredits,
    segmentsLoading,
    setSegmentsLoading,
    availableSegments,
    setAvailableSegments,
    selectedSegmentId,
    setSelectedSegmentId,
    icpName,
    setIcpName,
    isIcpModalOpen,
    setIsIcpModalOpen,
    availableIcps,
    icpListLoading,
    icpListError,
    refreshIcps,
    removeIcp,
    renameIcp,
    selectedIcpId,
    setSelectedIcpId,
    collapsibleVersion,
    setCollapsibleVersion,
    selectedPersonIds,
    setSelectedPersonIds,
    isEnriching,
    setIsEnriching,
    isConfirmModalOpen,
    setIsConfirmModalOpen,
    addedPersonIds,
    setAddedPersonIds,
    isEditIcpModalOpen,
    setIsEditIcpModalOpen,
    editingIcp,
    setEditingIcp,
    editingIcpName,
    setEditingIcpName,
    editingIcpSegmentValue,
    setEditingIcpSegmentValue,
    editingIcpSegmentsLoading,
    setEditingIcpSegmentsLoading,
    savedSectionOpenDefaults,
    setSavedSectionOpenDefaults,
  }
}
export type PeoplePageState = ReturnType<typeof usePeoplePageState>
