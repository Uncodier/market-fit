"use client"

import { useFormContext } from "react-hook-form"
import { useState, useCallback, useEffect } from "react"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { PlusCircle, Trash2, ChevronDown, ChevronRight, Home } from "../ui/icons"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
  snapshotsDiffer,
} from "@/app/components/ui/section-card"
import { type SiteFormValues as SiteFormValuesType } from "./form-schema"
import { listLocations, upsertLocation, deleteLocation } from "@/app/inventory/actions"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog"

interface OfficeLocationsSectionProps {
  onSave?: (data: SiteFormValuesType) => void
}

// Helper function to ensure proper location structure
const normalizeLocation = (location: any) => ({
  id: location.id,
  name: location.name || "",
  address: location.address || "",
  city: location.city || "",
  state: location.state || "",
  zip: location.zip || "",
  country: location.country || "",
  restrictions: {
    enabled: location.restrictions?.enabled || false,
    included_addresses: location.restrictions?.included_addresses || [],
    excluded_addresses: location.restrictions?.excluded_addresses || []
  }
})

export function OfficeLocationsSection({ onSave }: OfficeLocationsSectionProps) {
  const { t } = useLocalization()
  const form = useFormContext<SiteFormValues>()
  const { currentSite } = useSite()
  const [locationsList, setLocationsList] = useState<any[]>([])
  const [savedLocations, setSavedLocations] = useState<any[]>([])
  const [expandedLocations, setExpandedLocations] = useState<Set<number>>(new Set())
  const [isSavingLocation, setIsSavingLocation] = useState<number | null>(null)
  
  // Load locations from db
  useEffect(() => {
    async function load() {
      if (!currentSite?.id) return;
      const res = await listLocations(currentSite.id);
      if (res.data) {
        const next = res.data.map(normalizeLocation)
        setLocationsList(next)
        setSavedLocations(next)
      }
    }
    load();
  }, [currentSite?.id]);

  // Emit locations update event whenever list changes
  useEffect(() => {
    if (locationsList.length > 0) {
      const locationsData = locationsList.map((location, index) => ({
        id: `office-location-${index}`,
        title: location.name || t("settings.company.locations.new"),
      }));
      
      window.dispatchEvent(new CustomEvent('officeLocationsUpdated', { 
        detail: locationsData 
      }));
    }
  }, [locationsList, t]);

  // Toggle location expansion
  const toggleLocationExpansion = useCallback((index: number) => {
    const newExpanded = new Set(expandedLocations)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedLocations(newExpanded)
  }, [expandedLocations])

  // Add location
  const addLocation = useCallback(() => {
    const newLocation = normalizeLocation({ name: "" })
    const newLocations = [newLocation, ...locationsList]
    setLocationsList(newLocations)
    // Auto-expand the new location (now at index 0)
    setExpandedLocations(new Set([0, ...Array.from(expandedLocations).map(i => i + 1)]))
  }, [locationsList, expandedLocations])

  // Remove location
  const removeLocation = useCallback(async (index: number) => {
    const locationToRemove = locationsList[index];
    
    // If it has an ID, it's saved in the database
    if (locationToRemove?.id && currentSite?.id) {
      const res = await deleteLocation(locationToRemove.id, currentSite.id);
      if (res.error) {
        toast.error(res.error);
        return; // Don't remove from UI if db deletion failed
      }
      toast.success(t("settings.company.locations.toast.removed"));
    }

    const newLocations = locationsList.filter((_, i) => i !== index)
    setLocationsList(newLocations)
    
    // Update expanded indices
    const newExpanded = new Set<number>()
    expandedLocations.forEach(expandedIndex => {
      if (expandedIndex < index) {
        newExpanded.add(expandedIndex)
      } else if (expandedIndex > index) {
        newExpanded.add(expandedIndex - 1)
      }
    })
    setExpandedLocations(newExpanded)
  }, [locationsList, expandedLocations, currentSite?.id, t])
  
  // Handle location field update
  const handleLocationUpdate = useCallback((index: number, field: string, value: string) => {
    const newLocations = [...locationsList]
    newLocations[index] = {
      ...newLocations[index],
      [field]: value
    }
    setLocationsList(newLocations)
  }, [locationsList])

  // Save individual location
  const handleSaveLocation = async (index: number) => {
    setIsSavingLocation(index)
    try {
      if (!currentSite?.id) return;
      const loc = locationsList[index]
      const payload = {
        id: loc.id,
        site_id: currentSite.id,
        name: loc.name,
        address: loc.address,
        city: loc.city,
        state: loc.state,
        zip: loc.zip,
        country: loc.country,
        is_active: true
      }
      
      const res = await upsertLocation(payload)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(t("settings.company.locations.toast.saved"))
        // Update local state with the returned location (which includes generated IDs)
        const updatedList = [...locationsList]
        updatedList[index] = normalizeLocation(res.data)
        updatedList[index].id = res.data.id
        setLocationsList(updatedList)
        setSavedLocations(updatedList)
      }
    } catch (error) {
      console.error("Error saving location:", error)
      toast.error(t("settings.company.locations.toast.error"))
    } finally {
      setIsSavingLocation(null)
    }
  }

  return (
    <div id="office-locations" className="space-y-4">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{t("settings.company.locations.title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("settings.company.locations.description")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addLocation}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          {t("settings.company.locations.add")}
        </Button>
      </div>

      {/* Location Cards */}
      {locationsList.map((location, index) => {
        const isExpanded = expandedLocations.has(index)
        
        return (
          <SectionCard key={index} id={`office-location-${index}`}>
            <SectionCardHeader
              className="cursor-pointer hover:bg-muted/40"
              onClick={() => toggleLocationExpansion(index)}
            >
              <div className="flex items-center justify-between w-full gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <SectionCardTitle className="truncate">
                      {location.name || t("settings.company.locations.new")}
                    </SectionCardTitle>
                    {(location.city || location.state || location.country) && (
                      <SectionCardDescription className="truncate mt-1">
                        {[location.city, location.state, location.country].filter(Boolean).join(', ')}
                      </SectionCardDescription>
                    )}
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </SectionCardHeader>

            {/* Collapsible Content */}
            {isExpanded && (
              <>
              <SectionCardContent className="border-t border-border/70 pt-4">
                <FormField
                  control={form.control}
                  name={`locations.${index}.name`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder={t("settings.company.locations.placeholder.name")}
                          value={location.name}
                          onChange={(e) => {
                            field.onChange(e)
                            handleLocationUpdate(index, 'name', e.target.value)
                          }}
                          className="bg-background"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name={`locations.${index}.address`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder={t("settings.company.locations.placeholder.address")}
                          value={location.address || ""}
                          onChange={(e) => {
                            field.onChange(e)
                            handleLocationUpdate(index, 'address', e.target.value)
                          }}
                          className="bg-background"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name={`locations.${index}.city`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder={t("settings.company.locations.placeholder.city")}
                            value={location.city || ""}
                            onChange={(e) => {
                              field.onChange(e)
                              handleLocationUpdate(index, 'city', e.target.value)
                            }}
                            className="bg-background"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name={`locations.${index}.state`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder={t("settings.company.locations.placeholder.state")}
                            value={location.state || ""}
                            onChange={(e) => {
                              field.onChange(e)
                              handleLocationUpdate(index, 'state', e.target.value)
                            }}
                            className="bg-background"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name={`locations.${index}.zip`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder={t("settings.company.locations.placeholder.zip")}
                            value={location.zip || ""}
                            onChange={(e) => {
                              field.onChange(e)
                              handleLocationUpdate(index, 'zip', e.target.value)
                            }}
                            className="bg-background"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name={`locations.${index}.country`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder={t("settings.company.locations.placeholder.country")}
                          value={location.country || ""}
                          onChange={(e) => {
                            field.onChange(e)
                            handleLocationUpdate(index, 'country', e.target.value)
                          }}
                          className="bg-background"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </SectionCardContent>
              <SectionCardFooter
                dirty={snapshotsDiffer(location, savedLocations[index])}
                saving={isSavingLocation === index}
                onSave={() => handleSaveLocation(index)}
                saveLabel={t("settings.company.locations.save")}
                savingLabel={t("settings.company.common.saving")}
              >
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t("settings.company.locations.remove")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("settings.company.locations.remove")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("settings.company.locations.removeConfirm")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("settings.company.common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => removeLocation(index)}
                        className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
                      >
                        {t("settings.company.locations.remove")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </SectionCardFooter>
              </>
            )}
          </SectionCard>
        )
      })}
    </div>
  )
}
