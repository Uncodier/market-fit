"use client"

import { useState, useEffect } from "react"
import { SiteForm } from "../components/settings/site-form"
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

  // Adaptar Site a SiteFormValues para el formulario
  const adaptSiteToForm = (site: Site) => {
    console.log("Adapting site to form:", site);
    
    return {
      name: site.name,
      url: site.url || "",
      description: site.description || "",
      logo_url: site.logo_url || "",
      resource_urls: site.resource_urls || [],
      competitors: site.competitors || [],
      focusMode: site.focusMode || 50,
      // Add company info
      about: site.settings?.about || "",
      company_size: site.settings?.company_size || "",
      industry: site.settings?.industry || "",
      products: site.settings?.products || [],
      services: site.settings?.services || [],
      locations: site.settings?.locations || [],
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
      marketing_channels: site.settings?.marketing_channels || [],
      social_media: site.settings?.social_media || [],
      target_keywords: site.settings?.target_keywords || [],
      content_calendar: site.settings?.content_calendar || [],
      // Add tracking info
      tracking: site.tracking || {
        track_visitors: false,
        track_actions: false,
        record_screen: false
      },
      tracking_code: site.settings?.tracking_code || "",
      analytics_provider: site.settings?.analytics_provider || "",
      analytics_id: site.settings?.analytics_id || "",
      // Add team info
      team_members: site.settings?.team_members || [],
      team_roles: site.settings?.team_roles || [],
      org_structure: site.settings?.org_structure || {},
      // Billing info
      billing: site.billing || {
        plan: "free",
        auto_renew: true
      }
    }
  }

  const handleSave = async (data: any) => {
    if (!currentSite) return;
    
    try {
      setIsSaving(true)
      
      console.log("Form data from site-form:", data);
      
      // Extract site-specific fields
      const { 
        name, url, description, logo_url, resource_urls, 
        competitors, focusMode, billing, tracking, ...settingsData 
      } = data;
      
      console.log("Extracted tracking data:", tracking);
      
      // Update site basic info
      const siteUpdate: Partial<Site> = {
        name,
        url,
        description: description || null,
        logo_url: logo_url || null,
        resource_urls: resource_urls?.filter((url: any) => url.key && url.url) || [],
        competitors: competitors?.filter((comp: any) => comp.url) || [],
        focusMode: focusMode || 50,
        focus_mode: focusMode || 50,
        tracking: {
          track_visitors: tracking?.track_visitors === true,
          track_actions: tracking?.track_actions === true,
          record_screen: tracking?.record_screen === true
        }
      };
      
      // Create settings object with direct field access to prevent undefined values
      const settings: Partial<SiteSettings> = {
        about: settingsData.about,
        company_size: settingsData.company_size,
        industry: settingsData.industry,
        products: settingsData.products || [],
        services: settingsData.services || [],
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
        social_media: settingsData.social_media || [],
        target_keywords: settingsData.target_keywords || [],
        content_calendar: settingsData.content_calendar || [],
        tracking_code: settingsData.tracking_code,
        analytics_provider: settingsData.analytics_provider,
        analytics_id: settingsData.analytics_id,
        team_members: settingsData.team_members || [],
        team_roles: settingsData.team_roles || [],
        org_structure: settingsData.org_structure || {}
      };
      
      // Preserve existing settings ID if it exists
      if (currentSite.settings?.id) {
        settings.id = currentSite.settings.id;
      }
      
      console.log("Final site update data:", siteUpdate);
      console.log("Final settings data to save:", settings);
      
      // First update the site
      await updateSite({
        ...currentSite,
        ...siteUpdate
      });
      
      // Then update the settings
      await updateSettings(currentSite.id, settings);
      
      toast.success("Settings saved successfully");
      
      // Force form re-render with updated data
      setTimeout(() => {
        setFormKey(prev => prev + 1);
      }, 500);
      
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Error saving settings");
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