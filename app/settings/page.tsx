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
import { SiteForm } from "../components/settings/site-form"
import { type SiteFormValues } from "../components/settings/form-schema"
import { adaptSiteToForm, type AdaptedSiteFormValues } from "../components/settings/data-adapter"
import { handleSave, handleCacheAndRebuild, handleDeleteSite } from "../components/settings/save-handlers"
import { Input } from "../components/ui/input"

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
  const { currentSite, updateSite, deleteSite, isLoading, updateSettings, refreshSites } = useSite()
  const { theme } = useTheme()
  const [isSaving, setIsSaving] = useState(false)
  const [activeSegment, setActiveSegment] = useState("general")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [confirmationName, setConfirmationName] = useState("")

  // Simple refresh prevention specifically for settings page
  useSimpleRefreshPrevention()

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

  // Wrapper function for handleSave with context
  const onSave = async (data: SiteFormValues) => {
    if (!currentSite) return;
    
    await handleSave(data, {
      currentSite,
      updateSite,
      updateSettings,
      refreshSites,
      setIsSaving
    })
  }

  // Wrapper functions for other handlers
  const onCacheAndRebuild = async () => {
    await handleCacheAndRebuild(setIsSaving)
  }

  const onDeleteSite = async () => {
    if (confirmationName !== currentSite?.name) {
      return // Don't proceed if names don't match
    }
    await handleDeleteSite(currentSite, deleteSite, setIsSaving, setShowDeleteDialog)
    setConfirmationName("") // Reset confirmation after deletion
  }

  // Función para guardar manualmente (sin depender del submit)
  const handleManualSave = async () => {
    console.log("MANUAL SAVE: Obteniendo formulario");
    const formElement = document.getElementById('settings-form') as HTMLFormElement;
    if (!formElement) {
      console.error("MANUAL SAVE ERROR: No se encontró el formulario");
      return;
    }
    
    console.log("MANUAL SAVE: Disparando validación");
    // Obtener una referencia al formulario React Hook Form dentro del SiteForm
    // Esto es un hack, idealmente debería hacerse de otra manera
    const form = (window as any).__debug_form;
    if (!form) {
      console.error("MANUAL SAVE ERROR: No se pudo obtener el formulario");
      console.log("MANUAL SAVE FALLBACK: Usando evento submit directo");
      formElement.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      return;
    }
    
    console.log("MANUAL SAVE: Obteniendo valores del formulario");
    const formValues = form.getValues();
    console.log("MANUAL SAVE: Valores del formulario:", formValues);
    
    // Procesar con el handleSave normal
    await onSave(formValues);
  };

  // Simple approach - just track when data changes
  const adaptedSiteData = useMemo(() => {
    if (!currentSite) return null;
    return adaptSiteToForm(currentSite);
  }, [currentSite]);

  // Only show skeleton when initially loading, not when saving
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
                <TabsTrigger value="channels">Channels</TabsTrigger>
                <TabsTrigger value="team">Team</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button disabled>
              Save settings
            </Button>
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
              <TabsTrigger value="channels" className="whitespace-nowrap">Channels</TabsTrigger>
              <TabsTrigger value="team" className="whitespace-nowrap">Team</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Button 
              type="button"
              onClick={handleManualSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save settings"}
            </Button>
          </div>
        </div>
      </StickyHeader>
      <div className="px-16 py-8 pb-16 max-w-[880px] mx-auto">
        <SiteForm
          key={formKey}
          id="settings-form"
          initialData={adaptedSiteData || undefined}
          onSubmit={onSave}
          onDeleteSite={() => setShowDeleteDialog(true)}
          onCacheAndRebuild={onCacheAndRebuild}
          isSaving={isSaving}
          activeSegment={activeSegment}
          siteId={currentSite.id}
        />
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
              className="bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
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