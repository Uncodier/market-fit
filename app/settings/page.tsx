"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useSimpleRefreshPrevention } from "../hooks/use-prevent-refresh"
import { useSite } from "../context/SiteContext"
import { useTheme } from "../context/ThemeContext"
import { type Site, type SiteSettings } from "../context/SiteContext"
import { Button } from "../components/ui/button"
import { StickyHeader } from "../components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Skeleton } from "../components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { SiteForm } from "../components/settings/site-form"
import { type SiteFormValues } from "../components/settings/form-schema"
import { adaptSiteToForm, type AdaptedSiteFormValues } from "../components/settings/data-adapter"
import { handleSaveGeneral, handleSaveCompany, handleSaveBranding, handleSaveMarketing, handleSaveCustomerJourney, handleSaveSocial, handleSaveChannels, handleSaveActivities } from "../components/settings/save-handlers"
import { useAuthContext } from "../components/auth/auth-provider"
import { QuickNav, type QuickNavSection } from "../components/ui/quick-nav"

function SettingsFormSkeleton() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-1/4" />
          </CardTitle>
          <Skeleton className="h-4 w-2/3 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-1/3" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-10 w-24" />
              </div>
            ))}
            <Skeleton className="h-10 w-32" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-1/3" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-10 w-24" />
              </div>
            ))}
            <Skeleton className="h-10 w-32" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-1/4" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-12 w-full" />
            <div className="flex justify-end">
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-1/4" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-6 w-12" />
          </div>
        </CardContent>
      </Card>

      {/* Activities skeleton */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              <Skeleton className="h-6 w-24" />
            </CardTitle>
            <Skeleton className="h-9 w-32" />
          </div>
          <Skeleton className="h-4 w-2/3 mt-2" />
        </CardHeader>
      </Card>
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-3/4 mt-2" />
                </div>
                <Skeleton className="h-9 w-40" />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-1/4" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Section configurations for quick navigation
const generalSections: QuickNavSection[] = [
  { id: "site-information", title: "Site Information" },
  { id: "web-resources", title: "Web Resources" },
]

const channelsSections: QuickNavSection[] = [
  { id: "website-channel", title: "Website Channel" },
  { id: "agent-email-channel", title: "Agent Email Channel" },
  { id: "agent-whatsapp-channel", title: "Agent WhatsApp Channel" },
]

const getInitialSocialSections = (): QuickNavSection[] => [
  { 
    id: "social-networks-section", 
    title: "Social Networks",
    children: []
  },
]

const getInitialTeamSections = (): QuickNavSection[] => [
  { 
    id: "team-members", 
    title: "Team Members",
    children: []
  },
]

const getInitialCopywritingSections = (): QuickNavSection[] => [
  { 
    id: "copywriting-collection", 
    title: "Copywriting Collection",
    children: []
  },
]

const activitiesSections: QuickNavSection[] = [
  { 
    id: "activities", 
    title: "Activities",
    children: [
      { id: "activity-daily_resume_and_stand_up", title: "Daily Resume and Stand Up" },
      { id: "activity-local_lead_generation", title: "Local Lead Generation" },
      { id: "activity-icp_lead_generation", title: "ICP Lead Generation" },
      { id: "activity-leads_initial_cold_outreach", title: "Leads Initial Cold Outreach" },
      { id: "activity-leads_follow_up", title: "Leads Follow Up" },
      { id: "activity-email_sync", title: "Email Sync" },
      { id: "activity-assign_leads_to_team", title: "Assign Leads to Team" },
      { id: "activity-notify_team_on_inbound_conversations", title: "Notify Team on Inbound Conversations" },
      { id: "activity-supervise_conversations", title: "Supervise Conversations" },
    ]
  },
]

export default function SettingsPage() {
  const { currentSite, updateSite, deleteSite, isLoading, updateSettings, refreshSites } = useSite()
  const { theme } = useTheme()
  const { user } = useAuthContext()
  const [isSaving, setIsSaving] = useState(false)
  const [activeSegment, setActiveSegment] = useState("general")
  const searchParams = useSearchParams()
  const [formKey, setFormKey] = useState(0)
  const [teamSections, setTeamSections] = useState<QuickNavSection[]>(getInitialTeamSections())
  const [copywritingSections, setCopywritingSections] = useState<QuickNavSection[]>(getInitialCopywritingSections())
  const [socialSections, setSocialSections] = useState<QuickNavSection[]>(getInitialSocialSections())

  // Simple refresh prevention specifically for settings page
  useSimpleRefreshPrevention()
  
  // Listen for team members updates
  useEffect(() => {
    const handleTeamMembersUpdate = (event: CustomEvent) => {
      const members = event.detail as { id: string; title: string }[];
      setTeamSections([
        {
          id: "team-members",
          title: "Team Members",
          children: members
        }
      ]);
    };

    window.addEventListener('teamMembersUpdated', handleTeamMembersUpdate as EventListener);
    return () => {
      window.removeEventListener('teamMembersUpdated', handleTeamMembersUpdate as EventListener);
    };
  }, []);

  // Listen for copywriting updates
  useEffect(() => {
    const handleCopywritingUpdate = (event: CustomEvent) => {
      const items = event.detail as { id: string; title: string }[];
      setCopywritingSections([
        {
          id: "copywriting-collection",
          title: "Copywriting Collection",
          children: items
        }
      ]);
    };

    window.addEventListener('copywritingUpdated', handleCopywritingUpdate as EventListener);
    return () => {
      window.removeEventListener('copywritingUpdated', handleCopywritingUpdate as EventListener);
    };
  }, []);

  // Listen for social networks updates
  useEffect(() => {
    const handleSocialNetworksUpdate = (event: CustomEvent) => {
      const networks = event.detail as { id: string; title: string }[];
      setSocialSections([
        {
          id: "social-networks-section",
          title: "Social Networks",
          children: networks
        }
      ]);
    };

    window.addEventListener('socialNetworksUpdated', handleSocialNetworksUpdate as EventListener);
    return () => {
      window.removeEventListener('socialNetworksUpdated', handleSocialNetworksUpdate as EventListener);
    };
  }, []);

  // Sync tab from URL (?tab=channels)
  useEffect(() => {
    const tab = searchParams.get('tab') || searchParams.get('segment')
    if (tab && ["general", "channels", "team", "activities"].includes(tab)) {
      setActiveSegment(tab)
    }
  }, [searchParams])

  // Debug log para verificar el estado de prevención
  useEffect(() => {
    const logPreventionStatus = () => {
      const preventRefresh = sessionStorage.getItem('preventAutoRefresh')
      const justBecameVisible = sessionStorage.getItem('JUST_BECAME_VISIBLE')
      const justGainedFocus = sessionStorage.getItem('JUST_GAINED_FOCUS')
      
      console.log('🔍 Settings page prevention status:', {
        preventRefresh: preventRefresh === 'true',
        justBecameVisible: justBecameVisible === 'true',
        justGainedFocus: justGainedFocus === 'true'
      })
    }
    
    // Log initial status
    logPreventionStatus()
    
    // Log status every few seconds for debugging
    const interval = setInterval(logPreventionStatus, 3000)
    
    return () => clearInterval(interval)
  }, [])

  // Update form key only when the site ID actually changes (new site selected)
  // Use a ref to track the previous site ID to prevent unnecessary form resets
  const prevSiteIdRef = useRef<string | null>(null)
  
  useEffect(() => {
    if (currentSite?.id && currentSite.id !== prevSiteIdRef.current) {
      console.log("Settings: Site ID changed, updating formKey for site:", currentSite.id);
      console.log("Settings: Previous site ID was:", prevSiteIdRef.current);
      setFormKey(prev => prev + 1)
      prevSiteIdRef.current = currentSite.id
    } else if (currentSite && currentSite.id === prevSiteIdRef.current) {
      console.log("Settings: Same site ID, not updating formKey:", currentSite.id);
    }
  }, [currentSite?.id])

  // Wrapper functions for save handlers
  const saveOptions = {
    currentSite: currentSite!,
    updateSite,
    updateSettings,
    refreshSites,
    setIsSaving
  }

  const onSaveGeneral = async (data: SiteFormValues) => {
    if (!currentSite) return
    await handleSaveGeneral(data, saveOptions)
  }

  const onSaveCompany = async (data: SiteFormValues) => {
    if (!currentSite) return
    await handleSaveCompany(data, saveOptions)
  }

  const onSaveBranding = async (data: SiteFormValues) => {
    if (!currentSite) return
    await handleSaveBranding(data, saveOptions)
  }

  const onSaveMarketing = async (data: SiteFormValues) => {
    if (!currentSite) return
    await handleSaveMarketing(data, saveOptions)
  }

  const onSaveCustomerJourney = async (data: SiteFormValues) => {
    if (!currentSite) return
    await handleSaveCustomerJourney(data, saveOptions)
  }

  const onSaveSocial = async (data: SiteFormValues) => {
    if (!currentSite) return
    await handleSaveSocial(data, saveOptions)
  }

  const onSaveChannels = async (data: SiteFormValues) => {
    if (!currentSite) return
    await handleSaveChannels(data, saveOptions)
  }

  const onSaveActivities = async (data: SiteFormValues) => {
    if (!currentSite) return
    await handleSaveActivities(data, saveOptions)
  }

  // Simple approach - just track when data changes
  const adaptedSiteData = useMemo(() => {
    if (!currentSite) return null;
    return adaptSiteToForm(currentSite);
  }, [currentSite]);

  // Get current sections based on active segment
  const getCurrentSections = (): QuickNavSection[] => {
    switch (activeSegment) {
      case "general":
        return generalSections
      case "channels":
        return channelsSections
      case "team":
        return teamSections
      case "activities":
        return activitiesSections
      default:
        return []
    }
  }

  // Only show skeleton when initially loading, not when saving
  if (isLoading) {
    return (
      <div className="flex-1">
        <StickyHeader>
          <div className="flex items-center justify-between px-16 w-full">
            <Tabs value="general" className="w-auto">
              <TabsList>
                <TabsTrigger value="general">General Settings</TabsTrigger>
                <TabsTrigger value="channels">Agent Channels</TabsTrigger>
                <TabsTrigger value="team">Team</TabsTrigger>
                <TabsTrigger value="activities">Activities</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </StickyHeader>
        <div className="py-8 pb-16">
          <div className="flex gap-8 justify-center max-w-[1200px] mx-auto">
            <div className="flex-1 max-w-[880px] px-16">
              <SettingsFormSkeleton />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!currentSite) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">No site selected</p>
      </div>
    )
  }

  return (
    <div className="flex-1">
      <StickyHeader>
        <div className="flex items-center justify-between px-16 w-full">
          <Tabs value={activeSegment} onValueChange={setActiveSegment} className="w-auto">
            <TabsList className="flex">
              <TabsTrigger value="general" className="whitespace-nowrap">General Settings</TabsTrigger>
              <TabsTrigger value="channels" className="whitespace-nowrap">Agent Channels</TabsTrigger>
              <TabsTrigger value="team" className="whitespace-nowrap">Team</TabsTrigger>
              <TabsTrigger value="activities" className="whitespace-nowrap">Activities</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </StickyHeader>
      <div className="py-8 pb-16">
        <div className="flex gap-8 justify-center max-w-[1200px] mx-auto">
          <div className="flex-1 max-w-[880px] px-16">
          <SiteForm
            key={formKey}
            id="settings-form"
            initialData={adaptedSiteData || undefined}
            onSaveGeneral={onSaveGeneral}
            onSaveCompany={onSaveCompany}
            onSaveBranding={onSaveBranding}
            onSaveMarketing={onSaveMarketing}
            onSaveCustomerJourney={onSaveCustomerJourney}
            onSaveSocial={onSaveSocial}
            onSaveChannels={onSaveChannels}
            onSaveActivities={onSaveActivities}
            activeSegment={activeSegment}
            siteId={currentSite.id}
          />
          </div>
          <QuickNav sections={getCurrentSections()} />
        </div>
      </div>
    </div>
  )
} 