"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useSimpleRefreshPrevention } from "../hooks/use-prevent-refresh"
import { useSite } from "../context/SiteContext"
import { useTheme } from "../context/ThemeContext"
import { type Site, type SiteSettings } from "../context/SiteContext"
import { Button } from "../components/ui/button"
import { StickyHeader } from "../components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Skeleton } from "../components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog"
import { ContextForm } from "../components/settings/context-form"
import { type SiteFormValues } from "../components/settings/form-schema"
import { adaptSiteToForm, type AdaptedSiteFormValues } from "../components/settings/data-adapter"
import { handleDeleteSite, handleSaveGeneral, handleSaveCompany, handleSaveBranding, handleSaveMarketing, handleSaveCustomerJourney, handleSaveSocial, handleSaveCopywriting } from "../components/settings/save-handlers"
import { Input } from "../components/ui/input"
import { useAuthContext } from "../components/auth/auth-provider"
import { QuickNav, type QuickNavSection } from "../components/ui/quick-nav"

function ContextFormSkeleton() {
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
const getInitialCompanySections = (): QuickNavSection[] => [
  { id: "company-profile", title: "Company Profile" },
  { 
    id: "goals-quarterly", 
    title: "Business Goals",
    children: [
      { id: "goals-quarterly", title: "Quarter Goals" },
      { id: "goals-yearly", title: "Year Goals" },
      { id: "goals-five-year", title: "5 Year Goals" },
      { id: "goals-ten-year", title: "10 Year Goals" },
    ]
  },
  { 
    id: "swot-strengths", 
    title: "SWOT Analysis",
    children: [
      { id: "swot-strengths", title: "Strengths" },
      { id: "swot-weaknesses", title: "Weaknesses" },
      { id: "swot-opportunities", title: "Opportunities" },
      { id: "swot-threats", title: "Threats" },
    ]
  },
  { 
    id: "office-locations", 
    title: "Office Locations",
    children: []
  },
  { 
    id: "service-available-restrictions", 
    title: "Service Available Restrictions",
    children: []
  },
  { 
    id: "service-exclusions-addresses", 
    title: "Service Exclusions Addresses",
    children: []
  },
  { 
    id: "business-hours", 
    title: "Business Hours",
    children: []
  },
]

const brandingSections: QuickNavSection[] = [
  { 
    id: "brand-essence", 
    title: "Brand Pyramid",
    children: [
      { id: "brand-essence", title: "Brand Essence" },
      { id: "brand-personality", title: "Brand Personality" },
      { id: "brand-benefits", title: "Brand Benefits" },
      { id: "brand-attributes", title: "Brand Attributes" },
      { id: "brand-values", title: "Brand Values" },
      { id: "brand-promise", title: "Brand Promise" },
    ]
  },
  { id: "color-palette", title: "Color Palette" },
  { id: "typography", title: "Typography" },
  { id: "voice-tone", title: "Voice & Tone" },
  { id: "brand-guidelines", title: "Brand Guidelines" },
]

const marketingSections: QuickNavSection[] = [
  { id: "ai-focus-mode", title: "AI Focus Mode" },
  { id: "business-model", title: "Business Model" },
  { id: "marketing-budget", title: "Marketing Budget" },
  { id: "products", title: "Products" },
  { id: "services", title: "Services" },
  { id: "competitors", title: "Competitors" },
  { id: "marketing-channels", title: "Marketing Channels" },
]

const getInitialCopywritingSections = (): QuickNavSection[] => [
  { 
    id: "copywriting-collection", 
    title: "Copywriting Collection",
    children: []
  },
]

const customerJourneySections: QuickNavSection[] = [
  { 
    id: "journey-awareness", 
    title: "Customer Journey",
    children: [
      { id: "journey-awareness", title: "Awareness" },
      { id: "journey-consideration", title: "Consideration" },
      { id: "journey-decision", title: "Decision" },
      { id: "journey-purchase", title: "Purchase" },
      { id: "journey-retention", title: "Retention" },
      { id: "journey-referral", title: "Referral" },
    ]
  },
]

export default function ContextPage() {
  const { currentSite, updateSite, deleteSite, isLoading, updateSettings, refreshSites } = useSite()
  const { theme } = useTheme()
  const { user } = useAuthContext()
  const [isSaving, setIsSaving] = useState(false)
  const [activeSegment, setActiveSegment] = useState("company")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [confirmationName, setConfirmationName] = useState("")
  const [copywritingSections, setCopywritingSections] = useState<QuickNavSection[]>(getInitialCopywritingSections())
  const [companySectionsState, setCompanySectionsState] = useState<QuickNavSection[]>(getInitialCompanySections())

  // Simple refresh prevention specifically for context page
  useSimpleRefreshPrevention()

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

  // Listen for business hours updates
  useEffect(() => {
    const handleBusinessHoursUpdate = (event: CustomEvent) => {
      const items = event.detail as { id: string; title: string }[];
      setCompanySectionsState(prev => prev.map(section => {
        if (section.id === "business-hours") {
          return { ...section, children: items };
        }
        return section;
      }));
    };

    window.addEventListener('businessHoursUpdated', handleBusinessHoursUpdate as EventListener);
    return () => {
      window.removeEventListener('businessHoursUpdated', handleBusinessHoursUpdate as EventListener);
    };
  }, []);

  // Listen for office locations updates
  useEffect(() => {
    const handleOfficeLocationsUpdate = (event: CustomEvent) => {
      const items = event.detail as { id: string; title: string }[];
      setCompanySectionsState(prev => prev.map(section => {
        if (section.id === "office-locations") {
          return { ...section, children: items };
        }
        return section;
      }));
    };

    window.addEventListener('officeLocationsUpdated', handleOfficeLocationsUpdate as EventListener);
    return () => {
      window.removeEventListener('officeLocationsUpdated', handleOfficeLocationsUpdate as EventListener);
    };
  }, []);

  // Listen for service available restrictions updates
  useEffect(() => {
    const handleServiceAvailableRestrictionsUpdate = (event: CustomEvent) => {
      const items = event.detail as { id: string; title: string }[];
      setCompanySectionsState(prev => prev.map(section => {
        if (section.id === "service-available-restrictions") {
          return { ...section, children: items };
        }
        return section;
      }));
    };

    window.addEventListener('serviceAvailableRestrictionsUpdated', handleServiceAvailableRestrictionsUpdate as EventListener);
    return () => {
      window.removeEventListener('serviceAvailableRestrictionsUpdated', handleServiceAvailableRestrictionsUpdate as EventListener);
    };
  }, []);

  // Listen for service exclusions addresses updates
  useEffect(() => {
    const handleServiceExclusionsAddressesUpdate = (event: CustomEvent) => {
      const items = event.detail as { id: string; title: string }[];
      setCompanySectionsState(prev => prev.map(section => {
        if (section.id === "service-exclusions-addresses") {
          return { ...section, children: items };
        }
        return section;
      }));
    };

    window.addEventListener('serviceExclusionsAddressesUpdated', handleServiceExclusionsAddressesUpdate as EventListener);
    return () => {
      window.removeEventListener('serviceExclusionsAddressesUpdated', handleServiceExclusionsAddressesUpdate as EventListener);
    };
  }, [])

  // Debug log para verificar el estado de prevención
  useEffect(() => {
    const logPreventionStatus = () => {
      const preventRefresh = sessionStorage.getItem('preventAutoRefresh')
      const justBecameVisible = sessionStorage.getItem('JUST_BECAME_VISIBLE')
      const justGainedFocus = sessionStorage.getItem('JUST_GAINED_FOCUS')
      
      console.log('🔍 Context page prevention status:', {
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
      console.log("Context: Site ID changed, updating formKey for site:", currentSite.id);
      console.log("Context: Previous site ID was:", prevSiteIdRef.current);
      setFormKey(prev => prev + 1)
      prevSiteIdRef.current = currentSite.id
    } else if (currentSite && currentSite.id === prevSiteIdRef.current) {
      console.log("Context: Same site ID, not updating formKey:", currentSite.id);
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

  const onSaveCopywriting = async (data: SiteFormValues) => {
    if (!currentSite) return
    await handleSaveCopywriting(data, saveOptions)
  }

  // Wrapper functions for other handlers
  const onDeleteSite = async () => {
    if (confirmationName !== currentSite?.name) {
      return // Don't proceed if names don't match
    }
    await handleDeleteSite(currentSite, deleteSite, setIsSaving, setShowDeleteDialog)
    setConfirmationName("") // Reset confirmation after deletion
  }

  // Simple approach - just track when data changes
  const adaptedSiteData = useMemo(() => {
    if (!currentSite) return null;
    return adaptSiteToForm(currentSite);
  }, [currentSite]);

  // Get current sections based on active segment
  const getCurrentSections = (): QuickNavSection[] => {
    switch (activeSegment) {
      case "company":
        return companySectionsState
      case "branding":
        return brandingSections
      case "marketing":
        return marketingSections
      case "copywriting":
        return copywritingSections
      case "customer-journey":
        return customerJourneySections
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
            <Tabs value="company" className="w-auto">
              <TabsList>
                <TabsTrigger value="company">Company</TabsTrigger>
                <TabsTrigger value="branding">Branding</TabsTrigger>
                <TabsTrigger value="marketing">Marketing</TabsTrigger>
                <TabsTrigger value="copywriting">Copywriting</TabsTrigger>
                <TabsTrigger value="customer-journey">Customer Journey</TabsTrigger>
                {/* <TabsTrigger value="social">Social Networks</TabsTrigger> */}
              </TabsList>
            </Tabs>
          </div>
        </StickyHeader>
        <div className="py-8 pb-16">
          <div className="flex gap-8 justify-center max-w-[1200px] mx-auto">
            <div className="flex-1 max-w-[880px] px-16">
              <ContextFormSkeleton />
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
              <TabsTrigger value="company" className="whitespace-nowrap">Company</TabsTrigger>
              <TabsTrigger value="branding" className="whitespace-nowrap">Branding</TabsTrigger>
              <TabsTrigger value="marketing" className="whitespace-nowrap">Marketing</TabsTrigger>
              <TabsTrigger value="copywriting" className="whitespace-nowrap">Copywriting</TabsTrigger>
              <TabsTrigger value="customer-journey" className="whitespace-nowrap">Customer Journey</TabsTrigger>
              {/* <TabsTrigger value="social" className="whitespace-nowrap">Social Networks</TabsTrigger> */}
            </TabsList>
          </Tabs>
        </div>
      </StickyHeader>
      <div className="py-8 pb-16">
        <div className="flex gap-8 justify-center max-w-[1200px] mx-auto">
          <div className="flex-1 max-w-[880px] px-16">
          <ContextForm
            key={formKey}
            id="context-form"
            initialData={adaptedSiteData || undefined}
            onSaveGeneral={onSaveGeneral}
            onSaveCompany={onSaveCompany}
            onSaveBranding={onSaveBranding}
            onSaveMarketing={onSaveMarketing}
            onSaveCustomerJourney={onSaveCustomerJourney}
            onSaveSocial={onSaveSocial}
            onSaveCopywriting={onSaveCopywriting}
            onDeleteSite={() => setShowDeleteDialog(true)}
            isSaving={isSaving}
            activeSegment={activeSegment}
            siteId={currentSite.id}
          />
          </div>
          <QuickNav sections={getCurrentSections()} />
        </div>
      </div>
      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => {
        setShowDeleteDialog(open)
        if (!open) setConfirmationName("") // Reset when dialog closes
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Site</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the site
              "{currentSite?.name}" and all of its data including pages, assets, and settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-2">
              To confirm, type the site name <span className="font-semibold">"{currentSite?.name}"</span> below:
            </p>
            <div className="space-y-2">
              <Input
                type="text"
                value={confirmationName}
                onChange={(e) => setConfirmationName(e.target.value)}
                placeholder="Enter site name"
                disabled={isSaving}
                className={confirmationName === currentSite?.name ? "border-green-500 focus-visible:ring-green-500" : ""}
              />
              {confirmationName && confirmationName !== currentSite?.name && (
                <p className="text-xs text-red-500">
                  Site name doesn't match. Please type "{currentSite?.name}" exactly.
                </p>
              )}
              {confirmationName === currentSite?.name && (
                <p className="text-xs text-green-600">
                  ✓ Site name confirmed
                </p>
              )}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={onDeleteSite}
              className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSaving || confirmationName !== currentSite?.name}
            >
              {isSaving ? "Deleting..." : "Delete Site"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}