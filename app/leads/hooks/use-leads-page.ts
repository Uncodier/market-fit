"use client"

import { useEffect, useMemo, useState } from "react"
import type React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import { useMobileView } from "@/app/hooks/use-mobile-view"
import { useCommandK } from "@/app/hooks/use-command-k"
import { navigateToLead } from "@/lib/navigation/navigation-helpers"
import type { LeadFilters } from "@/app/components/kanban-view"
import type { Lead } from "../types"
import { filterLeads, getDefaultLeadSort, groupLeadsByCompany, type LeadSortOption } from "../list-helpers"
import { useLeadsData } from "./use-leads-data"
import { useLeadJourneyStages } from "./use-lead-journey-stages"
import { useLeadsKanban } from "./use-leads-kanban"
import { useLeadOperations } from "./use-lead-operations"
import { useLeadsBulkActions } from "./use-leads-bulk-actions"

export function useLeadsPage() {
  const searchParams = useSearchParams()
  const urlSort = searchParams ? searchParams.get('sort') : null
  const defaultSort = getDefaultLeadSort(urlSort)
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [activeTab, setActiveTab] = useState("all")
  const [viewType, setViewType] = useMobileView("table")
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [filters, setFilters] = useState<LeadFilters>({
    status: [],
    segments: [],
    origin: [],
    journeyStages: []
  })
  const { currentSite } = useSite()
  const { user } = useAuth()
  const [sortBy, setSortBy] = useState<LeadSortOption>(defaultSort)
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({})

  const data = useLeadsData(currentSite)
  const { dbLeads, loading, mutateLeads, searchQuery, setSearchQuery } = data
  const journey = useLeadJourneyStages(dbLeads, currentSite)
  const { leadJourneyStages } = journey
  const kanban = useLeadsKanban(currentSite, viewType, loading, mutateLeads)
  const operations = useLeadOperations(currentSite, dbLeads, mutateLeads)
  const bulk = useLeadsBulkActions(currentSite, user, dbLeads, mutateLeads)

  useCommandK()

  const filteredLeads = filterLeads(dbLeads, activeTab, filters, leadJourneyStages, searchQuery, sortBy)
  const companyGroups = useMemo(() => {
    const groups = groupLeadsByCompany(filteredLeads || [], leadJourneyStages || {}, expandedCompanies || {}, sortBy)
    
    // Log what companies are being shown on the page
    console.log(`📊 Page: Showing ${groups.length} companies for tab "${activeTab}"`)
    groups.forEach((group, index) => {
      console.log(`📊 Page Company ${index + 1}: "${group.companyName}" (${group.leadCount} leads, stage: ${group.mostAdvancedStage})`)
    })
    
    return groups
  }, [filteredLeads, leadJourneyStages, expandedCompanies, activeTab, sortBy])

  // Pagination handlers keep the existing reset behavior.
  function handlePageChange(page: number) {
    setCurrentPage(page)
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab])

  function handleItemsPerPageChange(value: string) {
    setItemsPerPage(Number(value))
    setCurrentPage(1)
  }
  
  const handleToggleCompanyExpansion = (companyKey: string) => {
    setExpandedCompanies(prev => ({
      ...prev,
      [companyKey]: !prev[companyKey]
    }))
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1)
  }

  const handleLeadClick = (lead: Lead) => {
    navigateToLead({
      leadId: lead.id,
      leadName: lead.name,
      router
    })
  };

  const handleApplyFilters = (newFilters: LeadFilters) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }
  
  const handleClearFilters = () => {
    setFilters({
      status: [],
      segments: [],
      origin: [],
      journeyStages: []
    })
    setSearchQuery("")
    setCurrentPage(1)
  }
  
  const handleOpenFilterModal = () => {
    setIsFilterModalOpen(true)
  }

  return {
    ...data, ...journey, ...kanban, ...operations, ...bulk,
    currentPage, itemsPerPage, activeTab, setActiveTab, viewType, setViewType,
    isFilterModalOpen, setIsFilterModalOpen, filters, sortBy,
    handleSortChange: (value: string) => setSortBy(value as LeadSortOption),
    filteredLeads, companyGroups, handlePageChange, handleItemsPerPageChange,
    handleToggleCompanyExpansion, handleSearchChange, handleLeadClick,
    handleApplyFilters, handleClearFilters, handleOpenFilterModal
  }
}
