import type { RequirementDetailRow, RequirementCampaignRow, RequirementSegmentRow, RequirementQueryResult } from "./requirement-detail-types"
"use client"

import { toast } from "sonner"
import { markdownToHTML } from "../utils"

import { createClient } from "@/lib/supabase/client"

import type { RequirementState } from "./use-requirement-state"
export function createRequirementLoader(state: RequirementState) {
  const { params, requirement, setRequirement, setIsLoading, error, setError, setHasRequirementStatus, setNodes, setConnections, setEditForm, campaigns, setCampaigns, segments, setSegments, editor } = state
  // Main function to load requirement data
  const loadRequirement = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Get an authenticated supabase client
      const supabase = createClient()
      
      // Fetch the requirement directly from Supabase
      const { data: requirement, error: requirementError }: RequirementQueryResult<RequirementDetailRow> = await supabase
        .from("requirements")
        .select(`
          *,
          requirement_segments(segment_id),
          campaign_requirements(campaign_id),
          metadata
        `)
        .eq("id", params.id)
        .single()
      
      if (requirementError) {
        console.error("Error fetching requirement:", requirementError)
        setError(requirementError.message || "Error loading requirement")
        return
      }
      
      if (!requirement) {
        setError("Requirement not found")
        return
      }
      
      // Check if requirement has any status
      const { data: statusData, error: statusError } = await supabase
        .from('requirement_status')
        .select('id')
        .eq('requirement_id', requirement.id)
        .limit(1)

      if (!statusError && statusData && statusData.length > 0) {
        setHasRequirementStatus(true)
      } else {
        setHasRequirementStatus(false)
      }
      
      // Parse nodes from metadata if they exist
      if (requirement.metadata && requirement.metadata.workflow_nodes) {
        setNodes(requirement.metadata.workflow_nodes);
      }
      if (requirement.metadata && requirement.metadata.workflow_connections) {
        setConnections(requirement.metadata.workflow_connections);
      }
      
      // Fetch segments for the site
      const { data: segments, error: segmentsError }: RequirementQueryResult<RequirementSegmentRow[]> = await supabase
        .from("segments")
        .select("*")
        .eq("site_id", requirement.site_id)
      
      if (segmentsError) {
        console.error("Error fetching segments:", segmentsError)
      }
      
      // Fetch campaigns for the site
      const { data: campaigns, error: campaignsError }: RequirementQueryResult<RequirementCampaignRow[]> = await supabase
        .from("campaigns")
        .select("id, title, description, metadata")
        .eq("site_id", requirement.site_id)
      
      if (campaignsError) {
        console.error("Error fetching campaigns:", campaignsError)
      }
      
      // Create maps for segment and campaign lookups
      const segmentsMap = new Map<string, string>()
      if (segments) {
        segments.forEach((segment: { id: string, name: string }) => {
          segmentsMap.set(segment.id, segment.name)
        })
      }
      
      const campaignsMap = new Map<string, string>()
      const campaignsOutsourcedMap = new Map<string, boolean>()
      if (campaigns) {
        campaigns.forEach((campaign) => {
          campaignsMap.set(campaign.id, campaign.title)
          campaignsOutsourcedMap.set(campaign.id, campaign.metadata?.payment_status?.outsourced || false)
        })
      }
      
      // Extract related segment IDs
      const segmentIds = (requirement.requirement_segments || []).map((sr) => sr.segment_id)
      
      // Get segment names
      const segmentNames = segmentIds.map((id: string) => segmentsMap.get(id) || "Unknown")
      
      // Extract related campaign IDs
      const campaignIds = (requirement.campaign_requirements || []).map((cr) => cr.campaign_id)
      
      // Get campaign names
      const campaignNames = campaignIds.map((id: string) => campaignsMap.get(id) || "Unknown")
      
      // Get the first campaign as the selected one (if any)
      const campaign_id = campaignIds.length > 0 ? campaignIds[0] : ""
      
      // Check if any of the related campaigns is outsourced
      const campaignOutsourced = campaignIds.some((id: string) => 
        campaignsOutsourcedMap.get(id) === true
      );
      
      // Format the requirement
      const formattedRequirement: NonNullable<RequirementState["requirement"]> & { campaignValue: RequirementState["editForm"]["campaignValue"] } = {
        id: requirement.id,
        siteId: requirement.site_id,
        title: requirement.title,
        description: requirement.description || "",
        instructions: requirement.instructions || "",
        type: requirement.type || "task",
        priority: requirement.priority || "medium",
        status: requirement.status || "backlog",
        completionStatus: requirement.completion_status || "pending",
        source: requirement.source || "",
        budget: requirement.budget || null,
        createdAt: requirement.created_at || new Date().toISOString(),
        segments: segmentIds,
        segmentNames: segmentNames,
        campaigns: campaignIds,
        campaignNames: campaignNames,
        campaign_id: campaign_id, // Use the first campaign_id (if it exists)
        campaignValue: campaign_id ? { mode: "existing", id: campaign_id, label: campaignsMap.get(campaign_id) || "Unknown" } : null,
        outsourceInstructions: requirement.instructions || "", // Initialize with instructions since it is the same field
        campaignOutsourced: campaignOutsourced,
        metadata: requirement.metadata || {}
      }
      
      // Debug log for metadata
      console.log("Requirement metadata:", requirement.metadata);
      console.log("Formatted requirement:", formattedRequirement);
      
      // Process segments for the dropdown
      const formattedSegments = segments?.map((segment) => ({
        id: segment.id,
        name: segment.name,
        description: segment.description || "",
      })) || []
      
      // Process campaigns for the dropdown
      // And add the segments information to each campaign
      const formattedCampaigns = campaigns?.map((campaign) => {
        // For each campaign, we will look for related segments
        const campaignWithSegments = {
          id: campaign.id,
          title: campaign.title,
          description: campaign.description || "",
          segments: [] as string[],
          segmentNames: [] as string[]
        }
        
        // We could load the campaign segments here if necessary
        
        return campaignWithSegments
      }) || []
      
      // Update state
      setRequirement(formattedRequirement)
      setCampaigns(formattedCampaigns)
      setSegments(formattedSegments)
      setEditForm({
        title: formattedRequirement.title,
        description: formattedRequirement.description,
        instructions: formattedRequirement.instructions,
        type: formattedRequirement.type,
        priority: formattedRequirement.priority,
        status: formattedRequirement.status,
        completionStatus: formattedRequirement.completionStatus,
        source: formattedRequirement.source,
        budget: formattedRequirement.budget,
        segments: formattedRequirement.segments || [],
        campaigns: formattedRequirement.campaigns || [],
        campaign_id: formattedRequirement.campaign_id || "",
        campaignValue: formattedRequirement.campaignValue,
        segmentNames: formattedRequirement.segmentNames || [],
        campaignNames: formattedRequirement.campaignNames || [],
        outsourceInstructions: formattedRequirement.instructions || "", // Keep them in sync
      })

      // Set editor content
      if (editor) {
        const formattedHTML = markdownToHTML(formattedRequirement.instructions || '');
        editor.commands.setContent(formattedHTML);
      }
    } catch (error) {
      console.error("Error loading requirement:", error)
      setError("Failed to load requirement data. Please try again.")
      toast.error("Failed to load requirement")
    } finally {
      setIsLoading(false)
    }
  }
  return loadRequirement
}
