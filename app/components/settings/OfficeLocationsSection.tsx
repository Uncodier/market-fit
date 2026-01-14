"use client"

import { useFormContext } from "react-hook-form"
import { useState, useCallback, useEffect } from "react"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { PlusCircle, Trash2, ChevronDown, ChevronRight, Home } from "../ui/icons"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
import { ActionFooter } from "../ui/card-footer"
import { type SiteFormValues as SiteFormValuesType } from "./form-schema"
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
  const form = useFormContext<SiteFormValues>()
  const [locationsList, setLocationsList] = useState(() => {
    const locations = form.getValues("locations") || []
    return locations.map(normalizeLocation)
  })
  const [expandedLocations, setExpandedLocations] = useState<Set<number>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingLocation, setIsSavingLocation] = useState<number | null>(null)

  // Emit locations update event whenever list changes
  useEffect(() => {
    if (locationsList.length > 0) {
      const locationsData = locationsList.map((location, index) => ({
        id: `office-location-${index}`,
        title: location.name || `Location ${index + 1}`,
      }));
      
      window.dispatchEvent(new CustomEvent('officeLocationsUpdated', { 
        detail: locationsData 
      }));
    }
  }, [locationsList]);

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
    form.setValue("locations", newLocations)
    // Auto-expand the new location (now at index 0)
    setExpandedLocations(new Set([0, ...Array.from(expandedLocations).map(i => i + 1)]))
  }, [form, locationsList, expandedLocations])

  // Remove location
  const removeLocation = useCallback((index: number) => {
    const newLocations = locationsList.filter((_, i) => i !== index)
    setLocationsList(newLocations)
    form.setValue("locations", newLocations)
    
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
  }, [form, locationsList, expandedLocations])
  
  // Handle location field update
  const handleLocationUpdate = useCallback((index: number, field: string, value: string) => {
    const newLocations = [...locationsList]
    newLocations[index] = {
      ...newLocations[index],
      [field]: value
    }
    setLocationsList(newLocations)
    form.setValue("locations", newLocations)
  }, [form, locationsList])

  // Save individual location
  const handleSaveLocation = async (index: number) => {
    if (!onSave) return
    setIsSavingLocation(index)
    setIsSaving(true)
    try {
      const formData = form.getValues()
      await onSave(formData)
    } catch (error) {
      console.error("Error saving location:", error)
    } finally {
      setIsSaving(false)
      setIsSavingLocation(null)
    }
  }

  return (
    <div id="office-locations" className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Office Locations</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Add your company's office locations and addresses
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addLocation}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Location
        </Button>
      </div>

      {/* Location Cards */}
      {locationsList.map((location, index) => {
        const isExpanded = expandedLocations.has(index)
        
        return (
          <Card key={index} id={`office-location-${index}`} className="border border-border">
            {/* Collapsible Header */}
            <CardHeader 
              className="px-8 py-6 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleLocationExpansion(index)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <Home className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg font-semibold truncate">
                      {location.name || "New Location"}
                    </CardTitle>
                    {(location.city || location.state || location.country) && (
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {[location.city, location.state, location.country].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>

            {/* Collapsible Content */}
            {isExpanded && (
              <>
              <CardContent className="space-y-6 px-8 pt-8 pb-8 border-t">
                <FormField
                  control={form.control}
                  name={`locations.${index}.name`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Office name (e.g., Headquarters)"
                          value={location.name}
                          onChange={(e) => {
                            field.onChange(e)
                            handleLocationUpdate(index, 'name', e.target.value)
                          }}
                          className="bg-background h-12 text-base"
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
                          placeholder="Street address"
                          value={location.address || ""}
                          onChange={(e) => {
                            field.onChange(e)
                            handleLocationUpdate(index, 'address', e.target.value)
                          }}
                          className="bg-background h-12 text-base"
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
                            placeholder="City"
                            value={location.city || ""}
                            onChange={(e) => {
                              field.onChange(e)
                              handleLocationUpdate(index, 'city', e.target.value)
                            }}
                            className="bg-background h-12 text-base"
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
                            placeholder="State/Province"
                            value={location.state || ""}
                            onChange={(e) => {
                              field.onChange(e)
                              handleLocationUpdate(index, 'state', e.target.value)
                            }}
                            className="bg-background h-12 text-base"
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
                            placeholder="ZIP/Postal Code"
                            value={location.zip || ""}
                            onChange={(e) => {
                              field.onChange(e)
                              handleLocationUpdate(index, 'zip', e.target.value)
                            }}
                            className="bg-background h-12 text-base"
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
                          placeholder="Country"
                          value={location.country || ""}
                          onChange={(e) => {
                            field.onChange(e)
                            handleLocationUpdate(index, 'country', e.target.value)
                          }}
                          className="bg-background h-12 text-base"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>

              {/* Card Footer with individual buttons */}
              <ActionFooter>
                <div className="flex items-center gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove Location
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Location</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove this office location? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => removeLocation(index)}
                          className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
                        >
                          Remove Location
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSaveLocation(index)}
                    disabled={isSaving && isSavingLocation === index}
                  >
                    {isSaving && isSavingLocation === index ? "Saving..." : "Save Location"}
                  </Button>
                </div>
              </ActionFooter>
              </>
            )}
          </Card>
        )
      })}
    </div>
  )
}
