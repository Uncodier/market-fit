"use client"

import { useFormContext } from "react-hook-form"
import { useState, useCallback, useEffect, useMemo } from "react"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { PlusCircle, Trash2, ChevronDown, ChevronRight } from "../ui/icons"
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

interface ServiceAvailableRestrictionsSectionProps {
  onSave?: (data: SiteFormValuesType) => void
}

interface FlatIncludedAddress {
  locationIndex: number
  addressIndex: number
  locationName: string
  address: {
    name: string
    address: string
    city: string
    state: string
    zip: string
    country: string
  }
}

export function ServiceAvailableRestrictionsSection({ onSave }: ServiceAvailableRestrictionsSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [expandedAddresses, setExpandedAddresses] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingAddress, setIsSavingAddress] = useState<string | null>(null)

  // Get all included addresses from all locations as a flat list
  const includedAddresses = useMemo(() => {
    const locations = form.watch("locations") || []
    const flat: FlatIncludedAddress[] = []
    
    locations.forEach((location: any, locationIndex: number) => {
      if (location.restrictions?.included_addresses) {
        location.restrictions.included_addresses.forEach((addr: any, addressIndex: number) => {
          flat.push({
            locationIndex,
            addressIndex,
            locationName: location.name || `Location ${locationIndex + 1}`,
            address: {
              name: addr.name || "",
              address: addr.address || "",
              city: addr.city || "",
              state: addr.state || "",
              zip: addr.zip || "",
              country: addr.country || ""
            }
          })
        })
      }
    })
    
    return flat
  }, [form.watch("locations")])

  // Emit restrictions update event whenever list changes
  useEffect(() => {
    if (includedAddresses.length > 0) {
      const addressesData = includedAddresses.map((item, index) => ({
        id: `service-available-${index}`,
        title: item.address.name || `${item.locationName} - Address ${index + 1}`,
      }));
      
      window.dispatchEvent(new CustomEvent('serviceAvailableRestrictionsUpdated', { 
        detail: addressesData 
      }));
    }
  }, [includedAddresses]);

  const toggleExpanded = useCallback((key: string) => {
    const newExpanded = new Set(expandedAddresses)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedAddresses(newExpanded)
  }, [expandedAddresses])

  // Add new included address to the first location (or create one if none exist)
  const addIncludedAddress = useCallback(() => {
    const locations = form.getValues("locations") || []
    let targetLocationIndex = 0
    
    // Find first location or create one
    if (locations.length === 0) {
      const newLocation = {
        name: "",
        address: "",
        city: "",
        state: "",
        zip: "",
        country: "",
        restrictions: {
          enabled: true,
          included_addresses: [],
          excluded_addresses: []
        }
      }
      locations.push(newLocation)
      form.setValue("locations", locations)
    }
    
    const newAddress = {
      name: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      country: ""
    }
    
    const updatedLocations = [...locations]
    if (!updatedLocations[targetLocationIndex].restrictions) {
      updatedLocations[targetLocationIndex].restrictions = {
        enabled: true,
        included_addresses: [],
        excluded_addresses: []
      }
    }
    
    updatedLocations[targetLocationIndex].restrictions.included_addresses = [
      newAddress,
      ...(updatedLocations[targetLocationIndex].restrictions.included_addresses || [])
    ]
    
    form.setValue("locations", updatedLocations)
    
    // Expand the new address
    const newKey = `${targetLocationIndex}-0`
    setExpandedAddresses(new Set([newKey, ...Array.from(expandedAddresses).map(k => {
      const [locIdx, addrIdx] = k.split('-').map(Number)
      return `${locIdx}-${addrIdx + 1}`
    })]))
  }, [form, expandedAddresses])

  // Remove included address
  const removeIncludedAddress = useCallback((locationIndex: number, addressIndex: number) => {
    const locations = form.getValues("locations") || []
    const updatedLocations = [...locations]
    
    if (updatedLocations[locationIndex]?.restrictions?.included_addresses) {
      updatedLocations[locationIndex].restrictions.included_addresses = 
        updatedLocations[locationIndex].restrictions.included_addresses.filter((_: any, i: number) => i !== addressIndex)
      
      form.setValue("locations", updatedLocations)
      
      // Update expanded keys
      const keyToRemove = `${locationIndex}-${addressIndex}`
      const newExpanded = new Set(expandedAddresses)
      newExpanded.delete(keyToRemove)
      
      // Adjust indices for addresses after the removed one
      const adjustedExpanded = new Set<string>()
      newExpanded.forEach(k => {
        const [locIdx, addrIdx] = k.split('-').map(Number)
        if (locIdx === locationIndex && addrIdx > addressIndex) {
          adjustedExpanded.add(`${locIdx}-${addrIdx - 1}`)
        } else {
          adjustedExpanded.add(k)
        }
      })
      setExpandedAddresses(adjustedExpanded)
    }
  }, [form, expandedAddresses])

  // Update included address field
  const updateIncludedAddress = useCallback((locationIndex: number, addressIndex: number, field: string, value: string) => {
    const locations = form.getValues("locations") || []
    const updatedLocations = [...locations]
    
    if (updatedLocations[locationIndex]?.restrictions?.included_addresses) {
      const updatedAddresses = [...updatedLocations[locationIndex].restrictions.included_addresses]
      updatedAddresses[addressIndex] = {
        ...updatedAddresses[addressIndex],
        [field]: value
      }
      
      updatedLocations[locationIndex].restrictions.included_addresses = updatedAddresses
      form.setValue("locations", updatedLocations)
    }
  }, [form])

  // Save individual address
  const handleSaveAddress = async (locationIndex: number, addressIndex: number) => {
    if (!onSave) return
    const key = `${locationIndex}-${addressIndex}`
    setIsSavingAddress(key)
    setIsSaving(true)
    try {
      const formData = form.getValues()
      await onSave(formData)
    } catch (error) {
      console.error("Error saving address:", error)
    } finally {
      setIsSaving(false)
      setIsSavingAddress(null)
    }
  }

  return (
    <div id="service-available-restrictions" className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Service Available Restrictions</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Specify addresses where service is available
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addIncludedAddress}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Address
        </Button>
      </div>

      {/* Address Cards */}
      {includedAddresses.map((item, index) => {
        const key = `${item.locationIndex}-${item.addressIndex}`
        const isExpanded = expandedAddresses.has(key)
        
        return (
          <Card key={key} id={`service-available-${index}`} className="border border-border">
            {/* Collapsible Header */}
            <CardHeader 
              className="px-8 py-6 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleExpanded(key)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-2 w-2 bg-muted-foreground rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg font-semibold truncate">
                      {item.address.name || `Address ${index + 1}`}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {item.locationName} • {[item.address.city, item.address.state, item.address.country].filter(Boolean).join(', ') || 'No location specified'}
                    </p>
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
              <CardContent className="space-y-6 px-8 pt-8 pb-8 border-t bg-green-50/30 dark:bg-green-950/10">
                <FormField
                  control={form.control}
                  name={`locations.${item.locationIndex}.restrictions.included_addresses.${item.addressIndex}.name`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Address name (e.g., Mexico)"
                          value={item.address.name}
                          onChange={(e) => {
                            field.onChange(e)
                            updateIncludedAddress(item.locationIndex, item.addressIndex, 'name', e.target.value)
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
                  name={`locations.${item.locationIndex}.restrictions.included_addresses.${item.addressIndex}.address`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Street address"
                          value={item.address.address}
                          onChange={(e) => {
                            field.onChange(e)
                            updateIncludedAddress(item.locationIndex, item.addressIndex, 'address', e.target.value)
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
                    name={`locations.${item.locationIndex}.restrictions.included_addresses.${item.addressIndex}.city`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="City"
                            value={item.address.city}
                            onChange={(e) => {
                              field.onChange(e)
                              updateIncludedAddress(item.locationIndex, item.addressIndex, 'city', e.target.value)
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
                    name={`locations.${item.locationIndex}.restrictions.included_addresses.${item.addressIndex}.state`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="State"
                            value={item.address.state}
                            onChange={(e) => {
                              field.onChange(e)
                              updateIncludedAddress(item.locationIndex, item.addressIndex, 'state', e.target.value)
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
                    name={`locations.${item.locationIndex}.restrictions.included_addresses.${item.addressIndex}.zip`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="ZIP"
                            value={item.address.zip}
                            onChange={(e) => {
                              field.onChange(e)
                              updateIncludedAddress(item.locationIndex, item.addressIndex, 'zip', e.target.value)
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
                  name={`locations.${item.locationIndex}.restrictions.included_addresses.${item.addressIndex}.country`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Country"
                          value={item.address.country}
                          onChange={(e) => {
                            field.onChange(e)
                            updateIncludedAddress(item.locationIndex, item.addressIndex, 'country', e.target.value)
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
                        Remove Address
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Address</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove this included address? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => removeIncludedAddress(item.locationIndex, item.addressIndex)}
                          className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
                        >
                          Remove Address
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSaveAddress(item.locationIndex, item.addressIndex)}
                    disabled={isSaving && isSavingAddress === key}
                  >
                    {isSaving && isSavingAddress === key ? "Saving..." : "Save Address"}
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
