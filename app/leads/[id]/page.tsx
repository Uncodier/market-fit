"use client"

import React, { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { toast } from "sonner"
import { getLeadById, updateLead, deleteLead } from "@/app/leads/actions"
import { getSegments } from "@/app/segments/actions"
import { getCampaigns } from "@/app/control-center/actions/campaigns/read"
import { Lead, Segment } from "@/app/leads/types"
import { Campaign } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import { ChevronLeft } from "@/app/components/ui/icons"
import { Card, CardContent } from "@/app/components/ui/card"
import { LeadDetail } from "@/app/leads/components/LeadDetail"
import { JourneyView } from "@/app/leads/components/JourneyView"
import { JourneySummary } from "@/app/leads/components/JourneySummary"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { LeadDetailSkeleton } from "@/app/leads/components/LeadDetailSkeleton"
import { Input } from "@/app/components/ui/input"
import { Skeleton } from "@/app/components/ui/skeleton"

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { currentSite } = useSite()
  const [lead, setLead] = useState<Lead | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (currentSite?.id && params.id) {
      // Reset title to default when component mounts and while loading
      document.title = 'Leads | Market Fit'
      const resetEvent = new CustomEvent('breadcrumb:update', {
        detail: {
          title: 'Lead Details',
          path: `/leads/${params.id}`,
          section: 'leads'
        }
      })
      window.dispatchEvent(resetEvent)
      
      loadLead()
      loadSegments()
      loadCampaigns()
    }
  }, [currentSite?.id, params.id])
  
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
    if (!currentSite?.id || !params.id) return
    
    setLoading(true)
    try {
      const result = await getLeadById(params.id as string, currentSite.id)
      
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
    if (!currentSite?.id) {
      toast.error("No site selected")
      return
    }
    
    try {
      // Make sure the required fields are present
      const updateData = {
        id,
        name: data.name || lead?.name || "",
        email: data.email || lead?.email || "",
        status: data.status || lead?.status || "new",
        site_id: currentSite.id,
        ...data
      }
      
      const result = await updateLead(updateData)
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Update lead in local state
      setLead(prev => prev ? { ...prev, ...data } : null)
      
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
  
  if (loading) {
    // Set a default title while loading
    document.title = 'Leads | Market Fit'
    return <LeadDetailSkeleton />
  }
  
  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="journey">
        <StickyHeader showAIButton={true}>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <TabsList>
                <TabsTrigger value="journey">Customer Journey</TabsTrigger>
                <TabsTrigger value="summary">Journey Summary</TabsTrigger>
              </TabsList>
            </div>
          </div>
        </StickyHeader>

        <div className="px-16" style={{ paddingTop: "32px" }}>
          {lead && (
            <div className="flex flex-row space-x-6">
              {/* Tab Content - Left Side (60%) */}
              <div className="w-[60%]">
                <TabsContent value="journey" className="mt-0 pt-0">
                  <JourneyView leadId={lead.id} />
                </TabsContent>
                <TabsContent value="summary" className="mt-0 pt-0">
                  <JourneySummary leadId={lead.id} />
                </TabsContent>
              </div>
              
              {/* Lead Details - Right Side (40%) - Always visible */}
              <div className="w-[40%]">
                <Card>
                  <CardContent className="p-0">
                    <LeadDetail 
                      lead={lead} 
                      segments={segments}
                      campaigns={campaigns}
                      onUpdateLead={handleUpdateLead}
                      onClose={() => {}} 
                      onDeleteLead={handleDeleteLead}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </Tabs>
    </div>
  )
}