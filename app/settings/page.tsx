"use client"

import { useState, useEffect } from "react"
import { useSite } from "../context/SiteContext"
import { toast } from "sonner"
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
import { SiteForm } from "../components/settings/site-form"
import { type SiteFormValues, type MarketingChannel } from "../components/settings/form-schema"

// Type definition for competitor URLs to match the form values
interface CompetitorWithMaybeOptionalName {
  url: string;
  name: string;
}

// Handle the type mismatch between our form values and the API types
type AdaptedSiteFormValues = Omit<SiteFormValues, 'competitors'> & {
  competitors: CompetitorWithMaybeOptionalName[];
}

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

export default function SettingsPage() {
  const { currentSite, updateSite, deleteSite, isLoading, updateSettings } = useSite()
  const [isSaving, setIsSaving] = useState(false)
  const [activeSegment, setActiveSegment] = useState("general")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [formKey, setFormKey] = useState(0)

  // Update form key when currentSite changes to force re-render
  useEffect(() => {
    if (currentSite) {
      setFormKey(prev => prev + 1)
    }
  }, [currentSite?.id])

  // Force re-render when settings change
  useEffect(() => {
    if (currentSite?.settings) {
      console.log("Settings changed, forcing form re-render")
      setFormKey(prev => prev + 1)
    }
  }, [currentSite?.settings])

  // Convert any existing marketing channels data to the correct format
  const formatMarketingChannels = (channels: any[]): MarketingChannel[] => {
    if (!channels || !Array.isArray(channels)) return [];
    
    return channels.map(channel => {
      if (typeof channel === 'string') {
        return { name: channel };
      } else if (typeof channel === 'object' && channel !== null) {
        return { 
          name: channel.name || '', 
          type: channel.type 
        };
      }
      return { name: '' };
    });
  }

  // Adaptar Site a SiteFormValues para el formulario
  const adaptSiteToForm = (site: Site): AdaptedSiteFormValues => {
    console.log("Adapting site to form:", site);
    
    return {
      name: site.name,
      url: site.url || "",
      description: site.description || "",
      logo_url: site.logo_url || "",
      resource_urls: site.resource_urls || [],
      // Leer competitors y focusMode desde settings en lugar de site
      competitors: site.settings?.competitors?.map(comp => ({
        url: comp.url || "",
        name: comp.name || "" // Ensure name is always a string
      })) || [],
      focusMode: site.settings?.focus_mode || 50,
      // Add company info
      about: site.settings?.about || "",
      company_size: site.settings?.company_size || "",
      industry: site.settings?.industry || "",
      products: Array.isArray(site.settings?.products) ? site.settings.products : [],
      services: Array.isArray(site.settings?.services) ? site.settings.services : [],
      locations: site.settings?.locations || [],
      // Add goals
      goals: site.settings?.goals || {
        quarter: "",
        year: "",
        five_year: "",
        ten_year: ""
      },
      swot: site.settings?.swot || {
        strengths: "",
        weaknesses: "",
        opportunities: "",
        threats: ""
      },
      // Add marketing info
      marketing_budget: site.settings?.marketing_budget || {
        total: 0,
        available: 0
      },
      marketing_channels: formatMarketingChannels(site.settings?.marketing_channels || []),
      social_media: site.settings?.social_media || [],
      // Add tracking info
      tracking: site.tracking || {
        track_visitors: false,
        track_actions: false,
        record_screen: false
      },
      analytics_provider: site.settings?.analytics_provider || "",
      analytics_id: site.settings?.analytics_id || "",
      tracking_code: site.settings?.tracking_code || "",
      // Add team info
      team_members: site.settings?.team_members || [],
      // Billing info
      billing: site.billing || {
        plan: "free",
        auto_renew: true
      }
    }
  }

  const handleSave = async (data: SiteFormValues) => {
    if (!currentSite) return;
    
    try {
      setIsSaving(true)
      
      console.log("Form data from site-form:", data);
      
      // Validate required fields
      if (!data.name?.trim()) {
        toast.error("Site name is required");
        setIsSaving(false);
        return;
      }

      if (!data.url?.trim()) {
        toast.error("Site URL is required");
        setIsSaving(false);
        return;
      }
      
      // Extract site-specific fields
      const { 
        name, url, description, logo_url, resource_urls, 
        competitors, focusMode, billing, tracking, ...settingsData 
      } = data;
      
      console.log("Social media before filtering:", settingsData.social_media);
      
      // Guardar inmediatamente el focusMode en localStorage para asegurar que persista
      if (typeof focusMode === 'number') {
        try {
          console.log(`Saving focus_mode to localStorage: site_${currentSite.id}_focus_mode = ${focusMode}`);
          localStorage.setItem(`site_${currentSite.id}_focus_mode`, String(focusMode));
        } catch (e) {
          console.error("Error saving focus_mode to localStorage:", e);
        }
      }
      
      // Filter out empty URLs
      const filteredResourceUrls = resource_urls?.filter((url: any) => url.key && url.url && url.key.trim() !== '' && url.url.trim() !== '') || [];
      const filteredCompetitors = competitors?.filter((comp: any) => comp.url && comp.url.trim() !== '') || [];
      
      // Filter out social media entries with empty URLs
      const filteredSocialMedia = settingsData.social_media?.filter((sm: any) => {
        // If platform is empty, don't include it
        if (!sm.platform || sm.platform.trim() === '') {
          return false;
        }
        
        // Keep entries with empty URLs
        if (!sm.url || sm.url.trim() === '') {
          return true;
        }
        
        // Validate URL format for non-empty entries
        const hasValidUrl = sm.url.match(/^https?:\/\/.+/);
        if (!hasValidUrl && sm.platform) {
          console.log(`Skipping social media entry with platform ${sm.platform} due to invalid URL format: "${sm.url}"`);
          return false;
        }
        return true;
      }) || [];
      
      console.log("Social media after filtering:", filteredSocialMedia);
      
      // Update site basic info
      const siteUpdate = {
        name,
        url,
        description: description || null,
        logo_url: logo_url || null,
        resource_urls: filteredResourceUrls,
        tracking: {
          track_visitors: tracking?.track_visitors === true,
          track_actions: tracking?.track_actions === true,
          record_screen: tracking?.record_screen === true
        }
      };
      
      // Create settings object with direct field access to prevent undefined values
      const settings = {
        site_id: currentSite.id, // Explicitly set the site_id to ensure it's always correct
        about: settingsData.about,
        company_size: settingsData.company_size,
        industry: settingsData.industry,
        products: Array.isArray(settingsData.products) ? settingsData.products : [],
        services: Array.isArray(settingsData.services) ? settingsData.services : [],
        swot: {
          strengths: settingsData.swot?.strengths || "",
          weaknesses: settingsData.swot?.weaknesses || "",
          opportunities: settingsData.swot?.opportunities || "",
          threats: settingsData.swot?.threats || ""
        },
        locations: settingsData.locations || [],
        marketing_budget: {
          total: settingsData.marketing_budget?.total || 0,
          available: settingsData.marketing_budget?.available || 0
        },
        marketing_channels: settingsData.marketing_channels || [],
        social_media: filteredSocialMedia,
        tracking_code: settingsData.tracking_code,
        analytics_provider: settingsData.analytics_provider,
        analytics_id: settingsData.analytics_id,
        team_members: settingsData.team_members || [],
        // Incluir competitors y focusMode en settings en lugar de site
        competitors: filteredCompetitors?.length > 0 ? filteredCompetitors : [],
        focusMode: focusMode || 50,
        focus_mode: focusMode || 50,
        // Include goals field
        goals: settingsData.goals || {
          quarter: "",
          year: "",
          five_year: "",
          ten_year: ""
        }
      };
      
      // Preserve existing settings ID if it exists
      if (currentSite.settings?.id) {
        (settings as any).id = currentSite.settings.id;
      }
      
      console.log("Final site update data:", siteUpdate);
      console.log("Final settings data to save with site_id:", settings.site_id);
      
      // First update the site
      await updateSite({
        ...currentSite,
        ...siteUpdate
      } as any);
      
      // Then update the settings
      await updateSettings(currentSite.id, settings as any);
      
      toast.success("Settings saved successfully");
      
      // Actualizar el currentSite localmente para mantener el focusMode consistente
      const updatedCurrentSite = {
        ...currentSite,
        ...siteUpdate,
        settings: {
          ...currentSite.settings,
          ...settings
        }
      } as any; // Use type assertion to avoid TypeScript errors
      
      // Force form re-render with updated data sólo si hay cambios reales
      setTimeout(() => {
        // Incrememntar el formKey para forzar la re-renderización
        setFormKey(prev => prev + 1);
      }, 500);
      
    } catch (error) {
      console.error("Error saving settings:", error);
      
      // Show more specific error message if available
      if (error instanceof Error) {
        toast.error(`Error: ${error.message}`);
      } else {
        toast.error("Error saving settings");
      }
    } finally {
      setIsSaving(false);
    }
  }

  // Función para manejar la acción de borrar caché y reconstruir
  const handleCacheAndRebuild = async () => {
    try {
      setIsSaving(true)
      // Aquí iría la lógica para borrar caché y reconstruir experimentos
      toast.success("Cache cleared and experiments rebuilt successfully")
    } catch (error) {
      console.error(error)
      toast.error("Error clearing cache and rebuilding experiments")
    } finally {
      setIsSaving(false)
    }
  }

  // Función para manejar la acción de borrar todo el sitio
  const handleDeleteSite = async () => {
    if (!currentSite) return

    try {
      setIsSaving(true)
      await deleteSite(currentSite.id)
      toast.success("Site deleted successfully")
    } catch (error) {
      console.error(error)
      toast.error("Error deleting site")
    } finally {
      setIsSaving(false)
      setShowDeleteDialog(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1">
        <StickyHeader>
          <div className="flex items-center justify-between px-16 w-full">
            <Tabs value="general" className="w-auto">
              <TabsList>
                <TabsTrigger value="general">General Settings</TabsTrigger>
                <TabsTrigger value="company">Company</TabsTrigger>
                <TabsTrigger value="marketing">Marketing</TabsTrigger>
                <TabsTrigger value="social">Social Networks</TabsTrigger>
                <TabsTrigger value="tracking">Tracking</TabsTrigger>
                <TabsTrigger value="team">Team</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button disabled>Save settings</Button>
          </div>
        </StickyHeader>
        <div className="px-16 py-8 pb-16 max-w-[880px] mx-auto">
          <SettingsFormSkeleton />
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
              <TabsTrigger value="company" className="whitespace-nowrap">Company</TabsTrigger>
              <TabsTrigger value="marketing" className="whitespace-nowrap">Marketing</TabsTrigger>
              <TabsTrigger value="social" className="whitespace-nowrap">Social Networks</TabsTrigger>
              <TabsTrigger value="tracking" className="whitespace-nowrap">Tracking</TabsTrigger>
              <TabsTrigger value="team" className="whitespace-nowrap">Team</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button 
            type="submit"
            form="settings-form"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save settings"}
          </Button>
        </div>
      </StickyHeader>
      <div className="px-16 py-8 pb-16 max-w-[880px] mx-auto">
        <SiteForm
          key={formKey}
          id="settings-form"
          initialData={adaptSiteToForm(currentSite)}
          onSubmit={handleSave}
          onDeleteSite={() => setShowDeleteDialog(true)}
          onCacheAndRebuild={handleCacheAndRebuild}
          isSaving={isSaving}
          activeSegment={activeSegment}
          siteId={currentSite.id}
        />
      </div>
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Site</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the site
              "{currentSite?.name}" and all of its data including pages, assets, and settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSite}
              className="bg-red-500 hover:bg-red-600 text-white"
              disabled={isSaving}
            >
              {isSaving ? "Deleting..." : "Delete Site"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 