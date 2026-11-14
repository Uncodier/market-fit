import { useCallback, useEffect } from "react"
import { toast } from "sonner"
import { apiClient } from "@/app/services/api-client-service"
import { getSegments } from "@/app/segments/actions"
import { createClient } from "@/lib/supabase/client"
import type { createFinderQuery } from "./finder-api"
import type { PeoplePageState } from "./use-people-page-state"
import type { PeopleFilters } from "./use-people-filters"
import type { usePeopleResultGroups } from "./use-people-result-groups"

type Dependencies = Pick<PeoplePageState & PeopleFilters & ReturnType<typeof usePeopleResultGroups>, "currentSite" | "currentPage" | "totalResults" | "setAddingToLeads" | "setIsSegmentModalOpen" | "showBillingLimitFromError" | "setSegmentsLoading" | "availableSegments" | "setAvailableSegments" | "selectedSegmentId" | "icpName" | "setIcpName" | "selectedPersonIds" | "setSelectedPersonIds" | "setIsEnriching" | "setIsConfirmModalOpen" | "setAddedPersonIds" | "buildFinderPayload" | "groupedResults">

export function usePeopleLeadActions(dependencies: Dependencies & { createQuery: typeof createFinderQuery }) {
  const {
    createQuery,
  } = dependencies
  const {
    currentSite,
    currentPage,
    totalResults,
    setAddingToLeads,
    setIsSegmentModalOpen,
    showBillingLimitFromError,
    setSegmentsLoading,
    availableSegments,
    setAvailableSegments,
    selectedSegmentId,
    icpName,
    setIcpName,
    selectedPersonIds,
    setSelectedPersonIds,
    setIsEnriching,
    setIsConfirmModalOpen,
    setAddedPersonIds,
    buildFinderPayload,
    groupedResults,
  } = dependencies
  // Open modal and fetch segments
  const handleAddToLeads = async () => {
    setIsSegmentModalOpen(true)
    if (!currentSite?.id) return
    // Load only once per open if empty
    if (availableSegments.length > 0) return
    try {
      setSegmentsLoading(true)
      const res = await getSegments(currentSite.id)
      if (res?.segments) {
        setAvailableSegments(res.segments.map((s: any) => ({ id: s.id, name: s.name })))
      }
    } catch (e) {
      console.error('[People] Load segments error:', e)
    } finally {
      setSegmentsLoading(false)
    }
  }

  // Confirm add to leads with selected segment
  const handleConfirmAddToLeads = async () => {
    try {
      setAddingToLeads(true)
      const payload = buildFinderPayload(currentPage) as any
      if (currentSite?.id) {
        payload.site_id = currentSite.id
      }
      if (selectedSegmentId && selectedSegmentId !== 'none') {
        payload.segment_id = selectedSegmentId
      }
      if (icpName && icpName.trim().length > 0) {
        payload.campaign_name = icpName.trim()
      }
      // Add total_targets with current search results total
      payload.total_targets = totalResults
      const res = await createQuery(payload)
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to create query')
      }
      toast.success('Leads enrichment started successfully. Your campaigns and segments will be updated.')
      setIsSegmentModalOpen(false)
      setIcpName("")
    } catch (e: any) {
      console.error('[People] Add to leads error:', e)
      if (!showBillingLimitFromError(e)) {
        toast.error(e?.message || 'Failed to add leads')
      }
    } finally {
      setAddingToLeads(false)
    }
  }
  // Function to check if leads exist for people in search results
  const checkLeadsForPeople = useCallback(async (groups: typeof groupedResults, siteId: string): Promise<Set<string>> => {
    if (!siteId || groups.length === 0) {
      return new Set()
    }

    try {
      const supabase = createClient()

      // Query all leads for the site (only name and company fields for efficiency)
      const { data: leads, error } = await supabase
        .from('leads')
        .select('name, company, companies(name)')
        .eq('site_id', siteId)

      if (error) {
        console.error('Error fetching leads for matching:', error)
        return new Set()
      }

      if (!leads || leads.length === 0) {
        return new Set()
      }

      // Create a Set of matched person IDs
      const matchedPersonIds = new Set<string>()

      // Helper function to normalize strings for comparison
      const normalize = (str: string | null | undefined): string => {
        if (!str) return ''
        // Remove extra spaces, convert to lowercase, and trim
        return str
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ' ') // Replace multiple spaces with single space
          .trim()
      }

      // Helper function to get company name from lead
      const getLeadCompanyName = (lead: any): string | null => {
        // Check companies relation first
        if (lead.companies?.name) {
          return lead.companies.name
        }
        // Check company JSONB field
        if (lead.company) {
          if (typeof lead.company === 'string') {
            return lead.company
          }
          if (typeof lead.company === 'object' && lead.company.name) {
            return lead.company.name
          }
        }
        return null
      }

      // For each person in results, check if a matching lead exists
      for (const group of groups) {
        const personName = normalize(group.personName)
        const companyName = group.companyName && group.companyName !== '—'
          ? normalize(group.companyName)
          : null

        let foundMatch = false

        // Check each lead for a match
        for (const lead of leads) {
          const leadName = normalize(lead.name)

          // Match by name (required)
          if (leadName === personName) {
            const leadCompanyName = normalize(getLeadCompanyName(lead))

            // If person has company declared, validate company match
            if (companyName) {
              // If lead also has company, they must match
              if (leadCompanyName) {
                if (leadCompanyName === companyName) {
                  matchedPersonIds.add(group.personId)
                  foundMatch = true
                  console.log('✅ Match found (name + company):', {
                    personName: group.personName,
                    personCompany: group.companyName,
                    leadName: lead.name,
                    leadCompany: getLeadCompanyName(lead)
                  })
                  break
                } else {
                  // Companies don't match - log for debugging
                  console.log('❌ Name matches but companies differ:', {
                    personName: group.personName,
                    personCompany: group.companyName,
                    leadName: lead.name,
                    leadCompany: getLeadCompanyName(lead),
                    normalizedPersonCompany: companyName,
                    normalizedLeadCompany: leadCompanyName
                  })
                }
              } else {
                // Person has company but lead doesn't - still match by name only
                // (company might not have been set when lead was created)
                matchedPersonIds.add(group.personId)
                foundMatch = true
                console.log('✅ Match found (name only, person has company but lead doesn\'t):', {
                  personName: group.personName,
                  personCompany: group.companyName,
                  leadName: lead.name
                })
                break
              }
            } else {
              // No company declared in person, name match is sufficient
              matchedPersonIds.add(group.personId)
              foundMatch = true
              console.log('✅ Match found (name only):', {
                personName: group.personName,
                leadName: lead.name
              })
              break
            }
          }
        }

        if (!foundMatch && personName) {
          // Log potential matches for debugging
          const potentialMatches = leads.filter((lead: any) => {
            const leadName = normalize(lead.name)
            return leadName.includes(personName) || personName.includes(leadName)
          })
          if (potentialMatches.length > 0) {
            console.log('⚠️ No exact match but found similar names:', {
              personName: group.personName,
              personCompany: group.companyName,
              similarLeads: potentialMatches.map((l: any) => ({ name: l.name, company: getLeadCompanyName(l) }))
            })
          }
        }
      }

      // Debug logging
      console.log('🔍 Lead matching check:', {
        totalPeople: groups.length,
        totalLeads: leads.length,
        matchedCount: matchedPersonIds.size,
        siteId: siteId
      })

      return matchedPersonIds
    } catch (error) {
      console.error('Error in checkLeadsForPeople:', error)
      return new Set()
    }
  }, [])

  // Background check to see if people already have leads in the site
  useEffect(() => {
    const runCheck = async () => {
      if (!currentSite?.id || groupedResults.length === 0) {
        setAddedPersonIds(new Set())
        return
      }

      console.log('🔍 Starting lead check for people:', {
        siteId: currentSite.id,
        peopleCount: groupedResults.length
      })

      try {
        const matchedIds = await checkLeadsForPeople(groupedResults, currentSite.id)
        console.log('🔍 Lead check completed, matched IDs:', Array.from(matchedIds))
        setAddedPersonIds(matchedIds)
      } catch (error) {
        console.error('Error checking leads for people:', error)
        setAddedPersonIds(new Set())
      }
    }

    runCheck()
  }, [groupedResults, currentSite?.id, checkLeadsForPeople])
  const togglePersonSelection = (personId: string) => {
    setSelectedPersonIds(prev => {
      if (prev.includes(personId)) {
        return prev.filter(id => id !== personId)
      } else {
        return [...prev, personId]
      }
    })
  }

  const handleEnrich = async () => {
    if (!currentSite?.id) {
      toast.error('Site ID is required')
      return
    }

    if (selectedPersonIds.length === 0) {
      toast.error('No people selected')
      return
    }

    setIsEnriching(true)
    setIsConfirmModalOpen(false)

    try {
      let successCount = 0
      let errorCount = 0

      for (const personId of selectedPersonIds) {
        try {
          const response = await apiClient.post('/api/workflow/enrichLead', {
            site_id: currentSite.id,
            person_id: personId
          })

          if (response.success) {
            successCount++
          } else {
            errorCount++
            console.error(`Failed to enrich person ${personId}:`, response.error)
          }
        } catch (error) {
          errorCount++
          console.error(`Error enriching person ${personId}:`, error)
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully enriched ${successCount} ${successCount === 1 ? 'person' : 'people'}`)
        setSelectedPersonIds([])
      }

      if (errorCount > 0) {
        toast.error(`Failed to enrich ${errorCount} ${errorCount === 1 ? 'person' : 'people'}`)
      }
    } catch (error) {
      console.error('Error in enrich process:', error)
      toast.error('An error occurred while enriching leads')
    } finally {
      setIsEnriching(false)
    }
  }
  return { handleAddToLeads, handleConfirmAddToLeads, checkLeadsForPeople, togglePersonSelection, handleEnrich }
}
