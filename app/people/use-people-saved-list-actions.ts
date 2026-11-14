
import { toast } from "sonner"
import { apiClient } from "@/app/services/api-client-service"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { getSegments } from "@/app/segments/actions"
import { createClient } from "@/lib/supabase/client"
import { type SavedFinderList } from "./use-saved-finder-lists"
import type { PeopleSearchState } from "./use-people-workspace"
import type { PeopleFilters } from "./use-people-filters"
import type { FinderRequest } from "./finder-request-types"
import { applySavedFinderFilters } from "./hydrate-finder-filters"

type Dependencies = PeopleFilters & Pick<PeopleSearchState, "currentSite" | "setCurrentPage" | "executeSearch" | "isSearchPending" | "availableSegments" | "setAvailableSegments" | "setIsIcpModalOpen" | "removeIcp" | "renameIcp" | "setCollapsibleVersion" | "setIsEditIcpModalOpen" | "editingIcp" | "setEditingIcp" | "editingIcpName" | "setEditingIcpName" | "editingIcpSegmentValue" | "setEditingIcpSegmentValue" | "setEditingIcpSegmentsLoading">

export function usePeopleSavedListActions(dependencies: Dependencies) {
  const {
    currentSite,
    setCurrentPage,
    executeSearch,
    isSearchPending,
    availableSegments,
    setAvailableSegments,
    setIsIcpModalOpen,
    removeIcp,
    renameIcp,
    setCollapsibleVersion,
    setIsEditIcpModalOpen,
    editingIcp,
    setEditingIcp,
    editingIcpName,
    setEditingIcpName,
    editingIcpSegmentValue,
    setEditingIcpSegmentValue,
    setEditingIcpSegmentsLoading,
    setSectionOpenDefaults,
  } = dependencies
  // Helper function to load ICP data
  const handleLoadIcp = async (icpId: string) => {
    if (isSearchPending()) return
    try {
      const url = `/api/finder/icp?icp_id=${encodeURIComponent(icpId)}${currentSite?.id ? `&site_id=${encodeURIComponent(currentSite.id)}` : ''}`
      const res = await apiClient.get<{ role_query?: { query?: FinderRequest } }>(url)
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to load saved list')
      }
      if (isSearchPending()) return
      const q: FinderRequest = res.data?.role_query?.query || {}
      applySavedFinderFilters(q, dependencies)
      // Set collapsible defaults based on saved filters.
      const openDefaults = {
        name: Boolean(
          (Array.isArray(q.person_name) ? q.person_name.length > 0 : q.person_name) ||
          q.person_headline ||
          (q.person_linkedin_public_identifiers && q.person_linkedin_public_identifiers.length > 0)
        ),
        jobTitle: Boolean(
          (Array.isArray(q.role_title) ? q.role_title.length > 0 : q.role_title) ||
          q.role_description || q.role_position_start_date || q.role_position_end_date || q.role_is_current
        ),
        personIndustry: Boolean((q.person_industries && q.person_industries.length) || (q.person_industries_exclude && q.person_industries_exclude.length)),
        personLocation: Boolean(q.person_locations?.length || q.person_location_names?.length),
        skills: Boolean(q.person_skills && q.person_skills.length),
        personLinkedin: Boolean(q.person_linkedin_public_identifiers && q.person_linkedin_public_identifiers.length),
        company: Boolean(q.organizations || q.organization_description || q.organization_linkedin_public_identifiers),
        domains: Boolean((q.organization_domains && q.organization_domains.length) || q.organizations_bulk_domain),
        compLocInd: Boolean((q.organization_locations && q.organization_locations.length) || (q.organization_industries && q.organization_industries.length) || (q.organization_industries_exclude && q.organization_industries_exclude.length) || (q.organization_keywords && q.organization_keywords.length)),
        sizeFounded: Boolean(q.organization_employees_start || q.organization_employees_end || q.organization_revenue_start || q.organization_revenue_end || q.organization_founded_date_start || q.organization_founded_date_end),
        foundedDate: Boolean(q.organization_founded_date_start || q.organization_founded_date_end),
        companyLinkedin: Boolean(q.organization_linkedin_public_identifiers && q.organization_linkedin_public_identifiers.length),
        jobPostings: Boolean(
          (Array.isArray(q.job_post_title) ? q.job_post_title.length > 0 : q.job_post_title) ||
          (Array.isArray(q.job_post_description) ? q.job_post_description.length > 0 : q.job_post_description) ||
          q.job_post_is_remote || q.job_post_is_active || q.job_post_date_featured_start || q.job_post_date_featured_end ||
          (q.job_post_locations && q.job_post_locations.length) || (q.job_post_locations_exclude && q.job_post_locations_exclude.length)
        ),
        funding: Boolean(q.funding_types || typeof q.funding_total_start === 'number' || typeof q.funding_total_end === 'number' || q.funding_event_date_featured_start || q.funding_event_date_featured_end),
        technologies: Boolean(q.organization_web_technologies && q.organization_web_technologies.length),
        signals: Boolean(q.simple_event_source || q.simple_event_reason || q.simple_event_date_featured_start || q.simple_event_date_featured_end),
        crmActivity: Boolean(q.require_deal || q.require_site_visit),
      }
      setSectionOpenDefaults(openDefaults)
      setCollapsibleVersion(v => v + 1)
      setIsIcpModalOpen(false)
      toast.success('Saved list loaded')
      // Trigger search with the full saved query so all API fields are sent (avoid dropping any field)
      setCurrentPage(1)
      const payloadFromQ: FinderRequest = { ...q, page: 0 }
      if (currentSite?.id) {
        payloadFromQ.site_id = currentSite.id
      }
      await executeSearch(payloadFromQ)
    } catch (e) {
      console.error('[People] Load saved list error:', e)
      toast.error('Failed to load saved list')
    }
  }

  // Helper function to delete ICP
  const handleDeleteIcp = async (icpId: string) => {
    try {
      const url = `/api/finder/icp?icp_id=${encodeURIComponent(icpId)}${currentSite?.id ? `&site_id=${encodeURIComponent(currentSite.id)}` : ''}`
      const res = await apiClient.delete(url)
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to delete saved list')
      }
      // Remove from local state
      removeIcp(icpId)
      toast.success('Saved list deleted')
    } catch (e) {
      console.error('[People] Delete saved list error:', e)
      toast.error('Failed to delete saved list')
    }
  }

  // Helper function to edit ICP name and segment
  const handleEditIcp = async () => {
    if (!editingIcp || !editingIcpName.trim()) {
      toast.error('Please enter a name')
      return
    }
    if (!currentSite) return
    const editingSiteId = currentSite.id
    try {
      const supabase = createClient()

      let resolvedSegmentId = null;
      if (editingIcpSegmentValue) {
        const { id, error } = await resolveRelationId("segment", editingIcpSegmentValue, currentSite.id);
        if (error) throw new Error(error);
        resolvedSegmentId = id;
      }

      // Update ICP name
      const { error: updateError } = await supabase
        .from('icp_mining')
        .update({ name: editingIcpName.trim() })
        .eq('id', editingIcp.id)
        .eq('site_id', editingSiteId)

      if (updateError) throw updateError

      // Update segment association if changed
      if (resolvedSegmentId) {
        // Get current segment associations
        const { data: currentSegments, error: segError } = await supabase
          .from('role_query_segments')
          .select('segment_id')
          .eq('role_query_id', editingIcp.role_query_id)

        if (segError) throw segError

        const currentSegmentIds = (currentSegments || []).map((s: { segment_id: string }) => s.segment_id)

        // If the selected segment is not in the current associations, add it
        if (!currentSegmentIds.includes(resolvedSegmentId)) {
          // Remove all existing associations
          const { error: deleteError } = await supabase
            .from('role_query_segments')
            .delete()
            .eq('role_query_id', editingIcp.role_query_id)

          if (deleteError) throw deleteError

          // Add new association
          const { error: insertError } = await supabase
            .from('role_query_segments')
            .insert({
              role_query_id: editingIcp.role_query_id,
              segment_id: resolvedSegmentId
            })

          if (insertError) throw insertError
        }
      }

      // Update local state
      renameIcp(editingIcp.id, editingIcpName.trim())

      setIsEditIcpModalOpen(false)
      setEditingIcp(null)
      setEditingIcpName("")
      setEditingIcpSegmentValue(null)
      toast.success('Saved list updated')
    } catch (e) {
      console.error('[People] Edit saved list error:', e)
      toast.error('Failed to update saved list')
    }
  }
  const handleOpenEditIcp = async (icp: SavedFinderList) => {
    setEditingIcp({ id: icp.id, name: icp.name, role_query_id: icp.role_query_id })
    setEditingIcpName(icp.name || "")

    let segments = availableSegments
    if (segments.length === 0 && currentSite?.id) {
      try {
        const response = await getSegments(currentSite.id)
        if (response?.segments) {
          segments = response.segments.map((segment: { id: string; name: string }) => ({ id: segment.id, name: segment.name }))
          setAvailableSegments(segments)
        }
      } catch (error) {
        console.error('[People] Load segments error:', error)
      }
    }

    try {
      setEditingIcpSegmentsLoading(true)
      const { data, error } = await createClient()
        .from('role_query_segments')
        .select('segment_id')
        .eq('role_query_id', icp.role_query_id)
        .limit(1)

      if (error) throw error
      const segmentId = data?.[0]?.segment_id
      const segment = segments.find(item => item.id === segmentId)
      setEditingIcpSegmentValue(segmentId ? {
        mode: 'existing', id: segmentId, label: segment?.name || 'Unknown',
      } : null)
    } catch (error) {
      console.error('[People] Load segment error:', error)
      setEditingIcpSegmentValue(null)
    } finally {
      setEditingIcpSegmentsLoading(false)
    }

    setIsEditIcpModalOpen(true)
  }
  return { handleLoadIcp, handleDeleteIcp, handleEditIcp, handleOpenEditIcp }
}
