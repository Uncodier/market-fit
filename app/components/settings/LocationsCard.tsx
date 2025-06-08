"use client"

import { useFormContext } from "react-hook-form"
import { useState } from "react"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { PlusCircle, Trash2 } from "../ui/icons"

export function LocationsCard() {
  const form = useFormContext<SiteFormValues>()
  const [locationsList, setLocationsList] = useState<{name: string, address?: string, country?: string}[]>(
    form.getValues("locations") || []
  )
  const [pendingLocation, setPendingLocation] = useState(false)

  // Add location
  const addLocation = () => {
    const newLocations = [...locationsList, { name: "", address: "", country: "" }]
    setLocationsList(newLocations)
    form.setValue("locations", newLocations)
    setPendingLocation(true)
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
    pendingLocation || location.name || location.address || location.country
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
          {displayLocations.map((location, index) => (
            <div key={index} className="flex items-start gap-4 p-4 border border-border rounded-lg bg-muted/30">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
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
                          placeholder="Full address"
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
              
              <Button
                size="icon"
                variant="ghost"
                type="button"
                onClick={() => removeLocation(index)}
                className="h-10 w-10 mt-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          
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