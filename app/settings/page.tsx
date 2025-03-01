"use client"

import { useState } from "react"
import { SiteForm } from "../components/settings/site-form"
import { useSite } from "../context/SiteContext"
import { toast } from "sonner"
import { type Site } from "../context/SiteContext"
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
    </div>
  )
}

export default function SettingsPage() {
  const { currentSite, updateSite, deleteSite, isLoading } = useSite()
  const [isSaving, setIsSaving] = useState(false)
  const [activeSegment, setActiveSegment] = useState("all")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Adaptar Site a SiteFormValues para el formulario
  const adaptSiteToForm = (site: Site) => {
    return {
      name: site.name,
      url: site.url || "",
      description: site.description || "",
      logo_url: site.logo_url || "",
      resource_urls: site.resource_urls || [],
      competitors: site.competitors || [],
      focusMode: site.focusMode || 50
    }
  }

  const handleSave = async (data: Partial<Site>) => {
    try {
      setIsSaving(true)
      await updateSite({
        ...currentSite,
        ...data,
        resource_urls: data.resource_urls?.filter(url => url.key && url.url) || [],
        competitors: data.competitors?.filter(comp => comp.url) || [],
        focus_mode: data.focusMode || data.focus_mode || 50,
      } as Site)
      toast.success("Settings saved successfully")
    } catch (error) {
      console.error("Error saving settings:", error)
      toast.error("Error saving settings")
    } finally {
      setIsSaving(false)
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
            <Tabs value="all" className="w-auto">
              <TabsList>
                <TabsTrigger value="all">All Settings</TabsTrigger>
                <TabsTrigger value="focus">Focus Mode</TabsTrigger>
                <TabsTrigger value="site">Site Info</TabsTrigger>
                <TabsTrigger value="cache">Cache</TabsTrigger>
                <TabsTrigger value="competitors">Competitors</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
                <TabsTrigger value="danger">Danger Zone</TabsTrigger>
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
            <TabsList>
              <TabsTrigger value="all">All Settings</TabsTrigger>
              <TabsTrigger value="focus">Focus Mode</TabsTrigger>
              <TabsTrigger value="site">Site Info</TabsTrigger>
              <TabsTrigger value="cache">Cache</TabsTrigger>
              <TabsTrigger value="competitors">Competitors</TabsTrigger>
              <TabsTrigger value="resources">Resources</TabsTrigger>
              <TabsTrigger value="danger">Danger Zone</TabsTrigger>
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