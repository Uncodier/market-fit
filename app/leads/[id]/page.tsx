"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { toast } from "sonner"
import { getLeadById, updateLead, deleteLead } from "@/app/leads/actions"
import { getSegments } from "@/app/segments/actions"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import { Lead, Segment, AttributionData } from "@/app/leads/types"
import { Campaign } from "@/app/types"
import { LeadDetail } from "@/app/leads/components/LeadDetail"
import { LeadIdentityHeader } from "@/app/leads/components/LeadIdentityHeader"
import { JourneyView } from "@/app/leads/components/JourneyView"
import { ConversationsView } from "@/app/leads/components/ConversationsView"
import { SalesView } from "@/app/leads/components/SalesView"
import { DigitalBehaviorView } from "@/app/leads/components/DigitalBehaviorView"
import { DealsView } from "@/app/leads/components/DealsView"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { LeadDetailSkeleton } from "@/app/leads/components/LeadDetailSkeleton"
import { StatusSegmentBar } from "@/app/leads/components/StatusSegmentBar"
import { AttributionModal } from "@/app/leads/components/AttributionModal"

export default function LeadDetailPage(props: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(props.params);
  const router = useRouter()
  const { currentSite } = useSite()
  const [lead, setLead] = useState<Lead | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showAttributionModal, setShowAttributionModal] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<"new" | "contacted" | "qualified" | "cold" | "converted" | "lost" | "not_qualified" | null>(null)
  const [revealEmpty, setRevealEmpty] = useState(false)
  
  // Extract id safely from params
  const leadId = Array.isArray(unwrappedParams.id) ? unwrappedParams.id[0] : unwrappedParams.id
  
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
      // Build updateData - only include changed fields + id + site_id
      const updateData: any = {
        id,
        site_id: currentSite.id,
      }
      
      // Handle each field explicitly to allow null/empty values
      Object.entries(data).forEach(([key, value]) => {
        if (key !== 'id') {
          // Include all fields from data (which now only contains changed fields)
          if (value !== undefined) {
            updateData[key] = value
          }
        }
      })
      
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
          <div className="pt-0 flex-1 w-full">
            <div className="flex items-center justify-between w-full gap-4">
              <TabsList>
                <TabsTrigger value="journey">Customer Journey</TabsTrigger>
                <TabsTrigger value="conversations">Conversations</TabsTrigger>
                <TabsTrigger value="deals">Deals</TabsTrigger>
                <TabsTrigger value="sales">Sales</TabsTrigger>
                <TabsTrigger value="digital-behavior">Digital Behavior</TabsTrigger>
              </TabsList>
              {lead && (
                <div className="flex items-center overflow-x-auto shrink-0">
                  <StatusSegmentBar
                    currentStatus={lead.status}
                    onStatusChange={handleStatusChange}
                  />
                </div>
              )}
            </div>
          </div>
        </StickyHeader>

        {lead && (
          <div className="px-4 lg:px-8 py-5">
            <LeadIdentityHeader
              lead={lead}
              onUpdateLead={handleUpdateLead}
              onDeleteLead={handleDeleteLead}
              onRevealFields={() => setRevealEmpty(true)}
            />

            <div className="mt-5 flex flex-col lg:flex-row border-t border-border/50">
              <div className="w-full lg:min-w-0 lg:flex-1 pt-5 lg:pr-8">
                <TabsContent value="journey" className="mt-0 pt-0">
                  <JourneyView leadId={lead.id} leadStatus={lead.status} />
                </TabsContent>
                <TabsContent value="conversations" className="mt-0 pt-0">
                  <ConversationsView leadId={lead.id} />
                </TabsContent>
                <TabsContent value="deals" className="mt-0 pt-0">
                  <DealsView leadId={lead.id} />
                </TabsContent>
                <TabsContent value="sales" className="mt-0 pt-0">
                  <SalesView leadId={lead.id} />
                </TabsContent>
                <TabsContent value="digital-behavior" className="mt-0 pt-0">
                  <DigitalBehaviorView leadId={lead.id} />
                </TabsContent>
              </div>

              <aside className="w-full lg:w-[340px] xl:w-[380px] shrink-0 pt-5 lg:pl-8 lg:border-l border-border/50">
                <div className="lg:sticky lg:top-[calc(var(--topbar-height,64px)+71px+16px)] lg:max-h-[calc(100vh-var(--topbar-height,64px)-96px)] lg:overflow-y-auto">
                  <LeadDetail
                    lead={lead}
                    segments={segments}
                    campaigns={campaigns}
                    onUpdateLead={handleUpdateLead}
                    revealEmpty={revealEmpty}
                  />
                </div>
              </aside>
            </div>
          </div>
        )}
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