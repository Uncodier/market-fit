"use client"

import { useFormContext } from "react-hook-form"
import { useState } from "react"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { PlusCircle, Trash2, ChevronDown, ChevronRight, Home } from "../ui/icons"

export function LocationsCard() {
  const form = useFormContext<SiteFormValues>()
  const [locationsList, setLocationsList] = useState<{name: string, address?: string, city?: string, state?: string, zip?: string, country?: string}[]>(
    form.getValues("locations") || []
  )
  const [pendingLocation, setPendingLocation] = useState(false)
  const [expandedLocations, setExpandedLocations] = useState<Set<number>>(new Set())

  // Toggle location expansion
  const toggleLocationExpansion = (index: number) => {
    const newExpanded = new Set(expandedLocations)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedLocations(newExpanded)
  }

  // Add location
  const addLocation = () => {
    const newIndex = locationsList.length
    const newLocations = [...locationsList, { name: "", address: "", city: "", state: "", zip: "", country: "" }]
    setLocationsList(newLocations)
    form.setValue("locations", newLocations)
    setPendingLocation(true)
    // Auto-expand the new location
    setExpandedLocations(prev => new Set([...Array.from(prev), newIndex]))
  }

  // Remove location
  const removeLocation = (index: number) => {
    const newLocations = locationsList.filter((_, i) => i !== index)
    setLocationsList(newLocations)
    form.setValue("locations", newLocations)
    
    if (newLocations.length === 0) {
      setPendingLocation(false)
    }
  }
  
  // Handle location field update
  const handleLocationUpdate = (index: number, field: string, value: string) => {
    const newLocations = [...locationsList]
    newLocations[index] = {
      ...newLocations[index],
      [field]: value
    }
    setLocationsList(newLocations)
    form.setValue("locations", newLocations)
    
    // If any field has a value, we no longer need pending state
    if (value) {
      setPendingLocation(false)
    }
  }

  // Filter locations to only show those with values or pending
  const displayLocations = locationsList.filter(location => 
    pendingLocation || location.name || location.address || location.city || location.state || location.zip || location.country
  )

  return (
    <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="px-8 py-6">
        <CardTitle className="text-xl font-semibold">Office Locations</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Add your company's office locations and addresses
        </p>
      </CardHeader>
      <CardContent className="space-y-6 px-8 pb-8">
        <div className="space-y-4">
          {displayLocations.map((location, index) => {
            const isExpanded = expandedLocations.has(index)
            
            return (
              <div key={index} className="border border-border rounded-lg overflow-hidden">
                {/* Collapsible Header */}
                <div className="p-4 bg-muted/30">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => toggleLocationExpansion(index)}
                      className="p-1 hover:bg-muted/50 rounded transition-colors h-10 w-10 flex items-center justify-center"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    
                    <div className="flex items-center gap-2 flex-1">
                      <Home className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {location.name || "New Location"}
                      </span>
                      {(location.city || location.state || location.country) && (
                        <span className="text-sm text-muted-foreground">
                          • {[location.city, location.state, location.country].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                    
                    <Button
                      size="icon"
                      variant="ghost"
                      type="button"
                      onClick={() => removeLocation(index)}
                      className="h-10 w-10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="p-4 space-y-4 border-t border-border">
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
                              placeholder="Street address"
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
                                placeholder="City"
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
                                placeholder="State/Province"
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
                                placeholder="ZIP/Postal Code"
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
                              placeholder="Country"
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
                  </div>
                )}
              </div>
            )
          })}
          
          <Button
            variant="outline"
            className="w-full"
            type="button"
            onClick={addLocation}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Location
          </Button>
        </div>
      </CardContent>
    </Card>
  )
} 