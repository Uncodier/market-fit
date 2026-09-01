"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useSite } from "@/app/context/SiteContext"
import { useToast } from "@/app/components/ui/use-toast"
import { useLocalization } from "@/app/context/LocalizationContext"
import { type RequirementFilters } from "@/app/components/ui/filter-modal"
import { retryOnError } from "@/app/hooks/use-optimistic-error"
import { updateRequirementPriority, updateRequirementStatus } from "./actions"
import {
  COMPLETION_STATUS,
  type Requirement,
  type RequirementPriority,
  type RequirementStatusType,
  type Segment,
} from "./types"

const EMPTY_FILTERS: RequirementFilters = {
  priority: [],
  completionStatus: [],
  status: [],
  segments: [],
}

const PRIORITY_ORDER: Record<RequirementPriority, number> = { high: 0, medium: 1, low: 2 }

export function useRequirementsList() {
  const { t } = useLocalization()
  const { toast } = useToast()
  const { currentSite } = useSite()
  const siteId = currentSite?.id
  const requestIdRef = useRef(0)

  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [visibleError, setVisibleError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"priority" | "newest" | "budget">("priority")
  const [filters, setFilters] = useState<RequirementFilters>(EMPTY_FILTERS)

  const loadRequirements = useCallback(async () => {
    if (!siteId) {
      setIsLoading(false)
      return
    }

    const requestId = ++requestIdRef.current
    const supabase = createClient()

    try {
      await retryOnError(async () => {
      if (requestId !== requestIdRef.current) return

      const { data: siteData, error: siteError } = await supabase
        .from("sites")
        .select("id, name")
        .eq("id", siteId)
        .single()

      if (siteError || !siteData) {
        throw new Error("The selected site does not exist or you don't have access to it")
      }

      const { data: segmentData, error: segmentError } = await supabase
        .from("segments")
        .select("*")
        .eq("site_id", siteId)

      if (segmentError) {
        throw new Error(`Error loading segments: ${segmentError.message}`)
      }

      let requirementsQuery = supabase
        .from("requirements")
        .select("*, requirement_segments(segment_id), campaign_requirements(campaign_id), metadata")
        .eq("site_id", siteId)

      if (activeTab === "pending") {
        requirementsQuery = requirementsQuery.eq("completion_status", COMPLETION_STATUS.PENDING)
      } else if (activeTab === "completed") {
        requirementsQuery = requirementsQuery.eq("completion_status", COMPLETION_STATUS.COMPLETED)
      } else if (activeTab === "rejected") {
        requirementsQuery = requirementsQuery.eq("completion_status", COMPLETION_STATUS.REJECTED)
      }

      if (filters.completionStatus.length > 0) {
        requirementsQuery = requirementsQuery.in("completion_status", filters.completionStatus)
      }
      if (filters.status.length > 0) {
        requirementsQuery = requirementsQuery.in("status", filters.status)
      }
      if (filters.priority.length > 0) {
        requirementsQuery = requirementsQuery.in("priority", filters.priority)
      }

      if (filters.segments.length > 0) {
        const { data: segmentRequirements, error: segmentFilterError } = await supabase
          .from("requirement_segments")
          .select("requirement_id")
          .in("segment_id", filters.segments)

        if (segmentFilterError) {
          throw new Error(`Error filtering by segments: ${segmentFilterError.message}`)
        }

        const requirementIds = segmentRequirements?.map((row: { requirement_id: string }) => row.requirement_id) || []
        if (requirementIds.length === 0) {
          if (requestId !== requestIdRef.current) return
          setSegments((segmentData || []).map((segment: Segment) => ({
            id: segment.id,
            name: segment.name,
            description: segment.description || "",
          })))
          setRequirements([])
          setVisibleError(null)
          setIsLoading(false)
          return
        }
        requirementsQuery = requirementsQuery.in("id", requirementIds)
      }

      const { data: requirementData, error: requirementError } = await requirementsQuery
      if (requirementError) {
        throw new Error(`Error loading requirements: ${requirementError.message}`)
      }

      const { data: campaignData, error: campaignError } = await supabase
        .from("campaigns")
        .select("id, title, metadata")
        .eq("site_id", siteId)

      if (campaignError) {
        console.warn("Error loading campaigns:", campaignError.message)
      }

      const mappedSegments = (segmentData || []).map((segment: Segment) => ({
        id: segment.id,
        name: segment.name,
        description: segment.description || "",
      }))

      const campaignsMap = new Map<string, string>()
      const campaignsOutsourcedMap = new Map<string, boolean>()
      ;(campaignData || []).forEach((campaign: { id: string; title: string; metadata?: { payment_status?: { outsourced?: boolean } } }) => {
        campaignsMap.set(campaign.id, campaign.title)
        campaignsOutsourcedMap.set(campaign.id, campaign.metadata?.payment_status?.outsourced || false)
      })

      const mappedRequirements: Requirement[] = (requirementData || []).map((req: Record<string, unknown>) => {
        const segmentIds = ((req.requirement_segments as Array<{ segment_id: string }>) || []).map((row) => row.segment_id)
        const campaignIds = ((req.campaign_requirements as Array<{ campaign_id: string }>) || []).map((row) => row.campaign_id)
        return {
          id: String(req.id),
          title: String(req.title || ""),
          description: String(req.description || ""),
          type: (req.type as Requirement["type"]) || "task",
          priority: (req.priority as RequirementPriority) || "medium",
          status: (req.status as RequirementStatusType) || "backlog",
          completionStatus: (req.completion_status as Requirement["completionStatus"]) || "pending",
          source: String(req.source || ""),
          budget: (req.budget as number | null) || null,
          createdAt: String(req.created_at || new Date().toISOString()),
          segments: segmentIds,
          segmentNames: mappedSegments.filter((segment) => segmentIds.includes(segment.id)).map((segment) => segment.name),
          campaigns: campaignIds,
          campaignNames: campaignIds.filter((id) => campaignsMap.has(id)).map((id) => campaignsMap.get(id) || ""),
          metadata: (req.metadata as Requirement["metadata"]) || {},
          campaignOutsourced: campaignIds.some((id) => campaignsOutsourcedMap.get(id) === true),
        }
      })

      if (requestId !== requestIdRef.current) return
      setSegments(mappedSegments)
      setRequirements(mappedRequirements)
      setVisibleError(null)
      setIsLoading(false)
      })
    } catch (error: unknown) {
      if (requestId !== requestIdRef.current) return
      setVisibleError(error instanceof Error ? error.message : "Error loading data")
      setIsLoading(false)
    }
  }, [siteId, activeTab, filters])

  useEffect(() => {
    if (!siteId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    loadRequirements()
  }, [siteId, activeTab, filters, loadRequirements])

  useEffect(() => {
    const handleReload = () => {
      loadRequirements()
    }
    window.addEventListener('requirements:reload', handleReload)
    return () => {
      window.removeEventListener('requirements:reload', handleReload)
    }
  }, [loadRequirements])

  const filteredRequirements = useMemo(() => {
    let filtered = [...requirements]
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((req) =>
        req.title.toLowerCase().includes(query)
        || req.description.toLowerCase().includes(query)
        || (req.campaignNames || []).some((name) => name.toLowerCase().includes(query))
      )
    }
    filtered.sort((a, b) => {
      if (sortBy === "priority") return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      return (b.budget || 0) - (a.budget || 0)
    })
    return filtered
  }, [requirements, searchQuery, sortBy])

  const handleUpdateStatus = async (id: string, status: RequirementStatusType) => {
    try {
      const { error } = await updateRequirementStatus(id, status)
      if (error) throw new Error(error)
      setRequirements((prev) => prev.map((req) => (req.id === id ? { ...req, status } : req)))
    } catch (error) {
      toast({
        title: t("requirements.error.title") || "Error",
        variant: "destructive",
        description: error instanceof Error ? error.message : t("requirements.error.updateStatus") || "Error updating status",
      })
      throw error
    }
  }

  const handleUpdatePriority = async (id: string, priority: RequirementPriority) => {
    try {
      const { error } = await updateRequirementPriority(id, priority)
      if (error) throw new Error(error)
      setRequirements((prev) => prev.map((req) => (req.id === id ? { ...req, priority } : req)))
    } catch (error) {
      toast({
        title: t("requirements.error.title") || "Error",
        variant: "destructive",
        description: error instanceof Error ? error.message : t("requirements.error.updatePriority") || "Error updating priority",
      })
      throw error
    }
  }

  const handleClearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setSearchQuery("")
    setActiveTab("all")
  }

  return {
    currentSite,
    requirements,
    filteredRequirements,
    segments,
    isLoading,
    visibleError,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    filters,
    setFilters,
    handleUpdateStatus,
    handleUpdatePriority,
    handleClearFilters,
  }
}
