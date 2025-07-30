"use client"

import { useFormContext } from "react-hook-form"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormControl, FormMessage, FormLabel } from "../ui/form"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { PlusCircle, Trash2, Shield } from "../ui/icons"

interface RegionalRestrictionsSectionProps {
  locationIndex: number
  location: any
  onAddIncludedAddress: (locationIndex: number) => void
  onAddExcludedAddress: (locationIndex: number) => void
  onRemoveIncludedAddress: (locationIndex: number, addressIndex: number) => void
  onRemoveExcludedAddress: (locationIndex: number, addressIndex: number) => void
  onIncludedAddressUpdate: (locationIndex: number, addressIndex: number, field: string, value: string) => void
  onExcludedAddressUpdate: (locationIndex: number, addressIndex: number, field: string, value: string) => void
  globalEnabled: boolean
}

export function RegionalRestrictionsSection({
  locationIndex,
  location,
  onAddIncludedAddress,
  onAddExcludedAddress,
  onRemoveIncludedAddress,
  onRemoveExcludedAddress,
  onIncludedAddressUpdate,
  onExcludedAddressUpdate,
  globalEnabled
}: RegionalRestrictionsSectionProps) {
  const form = useFormContext<SiteFormValues>()

  return (
    <div className="border border-border rounded-lg p-4 bg-muted/5 dark:bg-muted/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <FormLabel className="text-sm font-medium">
            {location.name || `Location ${locationIndex + 1}`}
          </FormLabel>
        </div>
      </div>
      
      {globalEnabled && (
        <div className="space-y-6">
          {/* Included Addresses Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              <FormLabel className="text-sm font-medium text-green-600 dark:text-green-400">Only in these addresses</FormLabel>
              <span className="text-xs text-muted-foreground">(Service available only in specified locations)</span>
            </div>
            
            <div className="space-y-3">
              {location.restrictions?.included_addresses?.map((includedAddress: any, addressIndex: number) => (
                <div key={addressIndex} className="p-3 border border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-950/30">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">
                      Included Address {addressIndex + 1}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      type="button"
                      onClick={() => onRemoveIncludedAddress(locationIndex, addressIndex)}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <Input
                      placeholder="Address name (e.g., Mexico)"
                      value={includedAddress.name || ""}
                      onChange={(e) => onIncludedAddressUpdate(locationIndex, addressIndex, 'name', e.target.value)}
                      className="bg-background text-sm"
                    />
                    
                    <Input
                      placeholder="Street address"
                      value={includedAddress.address || ""}
                      onChange={(e) => onIncludedAddressUpdate(locationIndex, addressIndex, 'address', e.target.value)}
                      className="bg-background text-sm"
                    />
                    
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        placeholder="City"
                        value={includedAddress.city || ""}
                        onChange={(e) => onIncludedAddressUpdate(locationIndex, addressIndex, 'city', e.target.value)}
                        className="bg-background text-sm"
                      />
                      <Input
                        placeholder="State"
                        value={includedAddress.state || ""}
                        onChange={(e) => onIncludedAddressUpdate(locationIndex, addressIndex, 'state', e.target.value)}
                        className="bg-background text-sm"
                      />
                      <Input
                        placeholder="ZIP"
                        value={includedAddress.zip || ""}
                        onChange={(e) => onIncludedAddressUpdate(locationIndex, addressIndex, 'zip', e.target.value)}
                        className="bg-background text-sm"
                      />
                    </div>
                    
                    <Input
                      placeholder="Country"
                      value={includedAddress.country || ""}
                      onChange={(e) => onIncludedAddressUpdate(locationIndex, addressIndex, 'country', e.target.value)}
                      className="bg-background text-sm"
                    />
                  </div>
                </div>
              ))}
              
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => onAddIncludedAddress(locationIndex)}
                className="w-full border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/50"
              >
                <PlusCircle className="mr-2 h-3 w-3" />
                Add Included Address
              </Button>
            </div>
          </div>

          {/* Excluded Addresses Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-red-500 rounded-full"></div>
              <FormLabel className="text-sm font-medium text-red-600 dark:text-red-400">Except in these addresses</FormLabel>
              <span className="text-xs text-muted-foreground">(Service NOT available in specified locations)</span>
            </div>
            
            <div className="space-y-3">
              {location.restrictions?.excluded_addresses?.map((excludedAddress: any, addressIndex: number) => (
                <div key={addressIndex} className="p-3 border border-red-200 dark:border-red-700/50 rounded-lg bg-red-50 dark:bg-red-950/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-red-700 dark:text-red-400">
                      Excluded Address {addressIndex + 1}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      type="button"
                      onClick={() => onRemoveExcludedAddress(locationIndex, addressIndex)}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <Input
                      placeholder="Address name (e.g., Guadalajara)"
                      value={excludedAddress.name || ""}
                      onChange={(e) => onExcludedAddressUpdate(locationIndex, addressIndex, 'name', e.target.value)}
                      className="bg-background text-sm"
                    />
                    
                    <Input
                      placeholder="Street address"
                      value={excludedAddress.address || ""}
                      onChange={(e) => onExcludedAddressUpdate(locationIndex, addressIndex, 'address', e.target.value)}
                      className="bg-background text-sm"
                    />
                    
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        placeholder="City"
                        value={excludedAddress.city || ""}
                        onChange={(e) => onExcludedAddressUpdate(locationIndex, addressIndex, 'city', e.target.value)}
                        className="bg-background text-sm"
                      />
                      <Input
                        placeholder="State"
                        value={excludedAddress.state || ""}
                        onChange={(e) => onExcludedAddressUpdate(locationIndex, addressIndex, 'state', e.target.value)}
                        className="bg-background text-sm"
                      />
                      <Input
                        placeholder="ZIP"
                        value={excludedAddress.zip || ""}
                        onChange={(e) => onExcludedAddressUpdate(locationIndex, addressIndex, 'zip', e.target.value)}
                        className="bg-background text-sm"
                      />
                    </div>
                    
                    <Input
                      placeholder="Country"
                      value={excludedAddress.country || ""}
                      onChange={(e) => onExcludedAddressUpdate(locationIndex, addressIndex, 'country', e.target.value)}
                      className="bg-background text-sm"
                    />
                  </div>
                </div>
              ))}
              
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => onAddExcludedAddress(locationIndex)}
                className="w-full border-red-300 dark:border-red-600/50 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <PlusCircle className="mr-2 h-3 w-3" />
                Add Excluded Address
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 