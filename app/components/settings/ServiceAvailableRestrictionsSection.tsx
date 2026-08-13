"use client"

import { useFormContext } from "react-hook-form"
import { useState, useCallback, useEffect, useMemo } from "react"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { PlusCircle, Trash2, ChevronDown, ChevronRight } from "../ui/icons"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
  isSectionDirty,
} from "@/app/components/ui/section-card"
import { type SiteFormValues as SiteFormValuesType } from "./form-schema"
import { useLocalization } from "@/app/context/LocalizationContext"
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
  const { t } = useLocalization()
  const form = useFormContext<SiteFormValues>()
  const { dirtyFields } = form.formState
  const [expandedAddresses, setExpandedAddresses] = useState<Set<string>>(new Set())
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
        title: item.address.name || `${item.locationName} - ${t("settings.company.restrictions.addressN", { n: index + 1 })}`,
      }));
      
      window.dispatchEvent(new CustomEvent('serviceAvailableRestrictionsUpdated', { 
        detail: addressesData 
      }));
    }
  }, [includedAddresses, t]);

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
    try {
      const formData = form.getValues()
      await onSave(formData)
      form.reset(formData)
    } catch (error) {
      console.error("Error saving address:", error)
    } finally {
      setIsSavingAddress(null)
    }
  }

  return (
    <div id="service-available-restrictions" className="space-y-4">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{t("settings.company.restrictions.title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("settings.company.restrictions.description")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addIncludedAddress}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          {t("settings.company.restrictions.add")}
        </Button>
      </div>

      {/* Address Cards */}
      {includedAddresses.map((item, index) => {
        const key = `${item.locationIndex}-${item.addressIndex}`
        const isExpanded = expandedAddresses.has(key)
        
        return (
          <SectionCard key={key} id={`service-available-${index}`}>
            <SectionCardHeader
              className="cursor-pointer hover:bg-muted/40"
              onClick={() => toggleExpanded(key)}
            >
              <div className="flex items-center justify-between w-full gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-1.5 w-1.5 bg-muted-foreground rounded-full" />
                  <div className="flex-1 min-w-0">
                    <SectionCardTitle className="truncate">
                      {item.address.name || t("settings.company.restrictions.addressN", { n: index + 1 })}
                    </SectionCardTitle>
                    <SectionCardDescription className="truncate mt-1">
                      {item.locationName} • {[item.address.city, item.address.state, item.address.country].filter(Boolean).join(', ') || t("settings.company.restrictions.noLocation")}
                    </SectionCardDescription>
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
              <SectionCardContent className="border-t border-border/70 pt-4 bg-green-50/30 dark:bg-green-950/10">
                <FormField
                  control={form.control}
                  name={`locations.${item.locationIndex}.restrictions.included_addresses.${item.addressIndex}.name`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder={t("settings.company.restrictions.placeholder.name")}
                          value={item.address.name}
                          onChange={(e) => {
                            field.onChange(e)
                            updateIncludedAddress(item.locationIndex, item.addressIndex, 'name', e.target.value)
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
                  name={`locations.${item.locationIndex}.restrictions.included_addresses.${item.addressIndex}.address`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder={t("settings.company.locations.placeholder.address")}
                          value={item.address.address}
                          onChange={(e) => {
                            field.onChange(e)
                            updateIncludedAddress(item.locationIndex, item.addressIndex, 'address', e.target.value)
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
                    name={`locations.${item.locationIndex}.restrictions.included_addresses.${item.addressIndex}.city`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder={t("settings.company.locations.placeholder.city")}
                            value={item.address.city}
                            onChange={(e) => {
                              field.onChange(e)
                              updateIncludedAddress(item.locationIndex, item.addressIndex, 'city', e.target.value)
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
                    name={`locations.${item.locationIndex}.restrictions.included_addresses.${item.addressIndex}.state`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder={t("settings.company.locations.placeholder.state")}
                            value={item.address.state}
                            onChange={(e) => {
                              field.onChange(e)
                              updateIncludedAddress(item.locationIndex, item.addressIndex, 'state', e.target.value)
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
                    name={`locations.${item.locationIndex}.restrictions.included_addresses.${item.addressIndex}.zip`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder={t("settings.company.locations.placeholder.zip")}
                            value={item.address.zip}
                            onChange={(e) => {
                              field.onChange(e)
                              updateIncludedAddress(item.locationIndex, item.addressIndex, 'zip', e.target.value)
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
                  name={`locations.${item.locationIndex}.restrictions.included_addresses.${item.addressIndex}.country`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder={t("settings.company.locations.placeholder.country")}
                          value={item.address.country}
                          onChange={(e) => {
                            field.onChange(e)
                            updateIncludedAddress(item.locationIndex, item.addressIndex, 'country', e.target.value)
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
                dirty={isSectionDirty(dirtyFields, `locations.${item.locationIndex}`)}
                saving={isSavingAddress === key}
                onSave={() => handleSaveAddress(item.locationIndex, item.addressIndex)}
                saveLabel={t("settings.company.restrictions.save")}
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
                      {t("settings.company.restrictions.remove")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("settings.company.restrictions.remove")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("settings.company.restrictions.removeConfirm")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("settings.company.common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => removeIncludedAddress(item.locationIndex, item.addressIndex)}
                        className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
                      >
                        {t("settings.company.restrictions.remove")}
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
