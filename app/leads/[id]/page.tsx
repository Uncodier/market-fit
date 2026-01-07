"use client"

import React, { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { toast } from "sonner"
import { getLeadById, updateLead, deleteLead } from "@/app/leads/actions"
import { getSegments } from "@/app/segments/actions"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import { Lead, Segment, LEAD_STATUSES, STATUS_STYLES, AttributionData } from "@/app/leads/types"
import { Campaign } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import { ChevronLeft } from "@/app/components/ui/icons"
import { Card, CardContent } from "@/app/components/ui/card"
import { LeadDetail } from "@/app/leads/components/LeadDetail"
import { JourneyView } from "@/app/leads/components/JourneyView"
import { ConversationsView } from "@/app/leads/components/ConversationsView"
import { SalesView } from "@/app/leads/components/SalesView"
import { DigitalBehaviorView } from "@/app/leads/components/DigitalBehaviorView"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { LeadDetailSkeleton } from "@/app/leads/components/LeadDetailSkeleton"
import { Input } from "@/app/components/ui/input"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Badge } from "@/app/components/ui/badge"
import { StatusSegmentBar } from "@/app/leads/components/StatusSegmentBar"
import { AttributionModal } from "@/app/leads/components/AttributionModal"

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { currentSite } = useSite()
  const [lead, setLead] = useState<Lead | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showAttributionModal, setShowAttributionModal] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<"new" | "contacted" | "qualified" | "cold" | "converted" | "lost" | "not_qualified" | null>(null)
  
  // Extract id safely from params
  const leadId = Array.isArray(params.id) ? params.id[0] : params.id
  
  useEffect(() => {
    if (currentSite?.id && leadId) {
      // Reset title to default when component mounts and while loading
      document.title = 'Leads | Market Fit'
      const resetEvent = new CustomEvent('breadcrumb:update', {
        detail: {
          title: 'Lead Details',
          path: `/leads/${leadId}`,
          section: 'leads'
        }
      })
      window.dispatchEvent(resetEvent)
      
      loadLead()
      loadSegments()
      loadCampaigns()
    }
  }, [currentSite?.id, leadId])
  
  // Add effect to update the title in the topbar when lead is loaded
  useEffect(() => {
    if (lead) {
      // Update the page title for the browser tab
      document.title = `${lead.name} | Leads`
      
      // Emit a custom event to update the breadcrumb with lead name
      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: lead.name,
          path: `/leads/${lead.id}`,
          section: 'leads'
        }
      })
      
      // Ensure event is dispatched after DOM is updated
      setTimeout(() => {
        window.dispatchEvent(event)
        console.log('Breadcrumb update event dispatched:', lead.name)
      }, 0)
    }
    
    // Cleanup when component unmounts
    return () => {
      document.title = 'Leads | Market Fit'
    }
  }, [lead])
  
  // Add effect for component mount/unmount to ensure clean state
  useEffect(() => {
    // When component mounts, set default title
    document.title = 'Leads | Market Fit'
    
    // Cleanup when component unmounts
    return () => {
      document.title = 'Leads | Market Fit'
      const resetEvent = new CustomEvent('breadcrumb:update', {
        detail: {
          title: null,
          path: null,
          section: 'leads'
        }
      })
      window.dispatchEvent(resetEvent)
    }
  }, [])
  
  const loadLead = async () => {
    if (!currentSite?.id || !leadId) return
    
    setLoading(true)
    try {
      const result = await getLeadById(leadId as string, currentSite.id)
      
      if (result.error || !result.lead) {
        toast.error(result.error || "Lead not found")
        router.push("/leads")
        return
      }
      
      setLead(result.lead)
    } catch (error) {
      console.error("Error loading lead:", error)
      toast.error("Error loading lead")
      router.push("/leads")
    } finally {
      setLoading(false)
    }
  }
  
  const loadSegments = async () => {
    if (!currentSite?.id) return
    
    try {
      const result = await getSegments(currentSite.id)
      
      if (result.error) {
        console.error(result.error)
        return
      }
      
      setSegments(result.segments || [])
    } catch (error) {
      console.error("Error loading segments:", error)
    }
  }
  
  const loadCampaigns = async () => {
    if (!currentSite?.id) return
    
    try {
      const result = await getCampaigns(currentSite.id)
      
      if (result.error) {
        console.error(result.error)
        return
      }
      
      setCampaigns(result.data || [])
    } catch (error) {
      console.error("Error loading campaigns:", error)
    }
  }
  
  const handleUpdateLead = async (id: string, data: Partial<Lead>) => {
    if (!currentSite?.id || !lead) {
      toast.error("No site selected or lead not found")
      return
    }
    
    try {
      // Build updateData with explicit handling for null/empty values
      const updateData: any = {
        id,
        site_id: currentSite.id,
      }
      
      // Handle each field explicitly to allow null/empty values
      Object.entries(data).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'attribution') {
          // Allow explicit null/empty values
          if (value !== undefined) {
            updateData[key] = value
          }
        }
      })
      
      // Ensure required fields have fallback values only if not explicitly provided
      if (updateData.name === undefined) {
        updateData.name = lead.name || ""
      }
      if (updateData.email === undefined) {
        updateData.email = lead.email || ""
      }
      if (updateData.status === undefined) {
        updateData.status = lead.status || "new"
      }
      // Don't include company field if it hasn't changed - let the server use existing value
      // Only include it if it's explicitly provided in data
      
      // Only include attribution if it's explicitly provided and complete
      if (data.attribution) {
        updateData.attribution = data.attribution
      }
      
      const result = await updateLead(updateData)
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Update lead in local state
      setLead((prev: Lead | null) => prev ? { ...prev, ...data } : null)
      
      toast.success("Lead updated successfully")
    } catch (error) {
      console.error("Error updating lead:", error)
      toast.error("Error updating lead")
    }
  }
  
  const handleDeleteLead = async (id: string) => {
    try {
      const result = await deleteLead(id)
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      toast.success("Lead deleted successfully")
      router.push("/leads")
    } catch (error) {
      console.error("Error deleting lead:", error)
      toast.error("Error deleting lead")
    }
  }

  const handleGoBack = () => {
    router.push("/leads")
  }
  
  // Handler for status change
  const handleStatusChange = (status: "new" | "contacted" | "qualified" | "cold" | "converted" | "lost" | "not_qualified") => {
    if (status === "converted" || status === "lost") {
      // Show attribution modal for conversion or loss
      setPendingStatus(status)
      setShowAttributionModal(true)
    } else {
      // Direct update for other statuses
      if (lead) {
        handleUpdateLead(lead.id, { status })
      }
    }
  }

  const handleAttributionConfirm = async (attribution: AttributionData) => {
    if (lead && pendingStatus) {
      try {
        await handleUpdateLead(lead.id, { 
          status: pendingStatus,
          attribution: attribution
        })
        setPendingStatus(null)
      } catch (error) {
        console.error('Error updating lead with attribution:', error)
        toast.error("Error updating lead")
        setPendingStatus(null)
      }
    }
  }

  const handleAttributionCancel = () => {
    setPendingStatus(null)
    setShowAttributionModal(false)
  }
  
  if (loading) {
    // Set a default title while loading
    document.title = 'Leads | Market Fit'
    return <LeadDetailSkeleton />
  }
  
  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="journey">
        <StickyHeader>
          <div className="px-16 pt-0 flex-1">
            <div className="flex items-center justify-between w-full">
              <TabsList>
                <TabsTrigger value="journey">Customer Journey</TabsTrigger>
                <TabsTrigger value="conversations">Conversations</TabsTrigger>
                <TabsTrigger value="sales">Sales</TabsTrigger>
                <TabsTrigger value="digital-behavior">Digital Behavior</TabsTrigger>
              </TabsList>
              
              {lead && (
                <div className="flex items-center">
                  <StatusSegmentBar 
                    currentStatus={lead.status}
                    onStatusChange={handleStatusChange}
                  />
                </div>
              )}
            </div>
          </div>
        </StickyHeader>

        <div className="px-16" style={{ paddingTop: "32px" }}>
          {lead && (
            <div className="flex flex-row space-x-6">
              {/* Tab Content - Left Side (60%) */}
              <div className="w-[60%] min-w-0">
                <TabsContent value="journey" className="mt-0 pt-0">
                  <JourneyView leadId={lead.id} />
                </TabsContent>
                <TabsContent value="conversations" className="mt-0 pt-0">
                  <ConversationsView leadId={lead.id} />
                </TabsContent>
                <TabsContent value="sales" className="mt-0 pt-0">
                  <SalesView leadId={lead.id} />
                </TabsContent>
                <TabsContent value="digital-behavior" className="mt-0 pt-0">
                  <DigitalBehaviorView leadId={lead.id} />
                </TabsContent>
              </div>
              
              {/* Lead Details - Right Side (40%) - Always visible */}
              <div className="w-[40%] min-w-0">
                <Card className="h-fit">
                  <CardContent className="p-0 min-w-0">
                    <LeadDetail 
                      lead={lead} 
                      segments={segments}
                      campaigns={campaigns}
                      onUpdateLead={handleUpdateLead}
                      onClose={() => {}} 
                      onDeleteLead={handleDeleteLead}
                      hideStatus={true}
                      onStatusChange={handleStatusChange}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </Tabs>

      {/* Attribution Modal */}
      {pendingStatus && (pendingStatus === "converted" || pendingStatus === "lost") && (
        <AttributionModal
          isOpen={showAttributionModal}
          onOpenChange={setShowAttributionModal}
          leadName={lead?.name || ""}
          statusType={pendingStatus}
          onConfirm={handleAttributionConfirm}
          onCancel={handleAttributionCancel}
        />
      )}
    </div>
  )
}