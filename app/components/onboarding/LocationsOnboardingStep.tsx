"use client"

import { useState } from "react"
import { useFormContext } from "react-hook-form"
import { FormField, FormItem, FormControl, FormLabel, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { Switch } from "../ui/switch"
import { PlusCircle, Trash2, Home, Shield } from "../ui/icons"
import { RegionalRestrictionsSection } from "../settings/RegionalRestrictionsSection"

interface LocationsOnboardingStepProps {
  locations: any[]
  onAddLocation: () => void
  onRemoveLocation: (index: number) => void
  onAddIncludedAddress: (locationIndex: number) => void
  onAddExcludedAddress: (locationIndex: number) => void
  onRemoveIncludedAddress: (locationIndex: number, addressIndex: number) => void
  onRemoveExcludedAddress: (locationIndex: number, addressIndex: number) => void
  onIncludedAddressUpdate: (locationIndex: number, addressIndex: number, field: string, value: string) => void
  onExcludedAddressUpdate: (locationIndex: number, addressIndex: number, field: string, value: string) => void
}

export function LocationsOnboardingStep({
  locations,
  onAddLocation,
  onRemoveLocation,
  onAddIncludedAddress,
  onAddExcludedAddress,
  onRemoveIncludedAddress,
  onRemoveExcludedAddress,
  onIncludedAddressUpdate,
  onExcludedAddressUpdate
}: LocationsOnboardingStepProps) {
  const form = useFormContext()
  const [globalRestrictionsEnabled, setGlobalRestrictionsEnabled] = useState(false)

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <p className="text-sm text-muted-foreground">
          Add your company's physical locations. Commercial efforts will be prioritized in these areas.
        </p>
      </div>
      
      {/* Regular Locations */}
      <div className="space-y-4">
        {locations.map((_, index) => (
          <div key={index} className="p-4 border rounded-lg">
            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name={`locations.${index}.name`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Home className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          className="pl-10" 
                          placeholder="e.g., HQ, Branch Office"
                          {...field}
                        />
                      </div>
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
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Street address"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name={`locations.${index}.city`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="City"
                          {...field}
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
                      <FormLabel>State/Province</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="State/Province"
                          {...field}
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
                      <FormLabel>ZIP/Postal Code</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="ZIP/Postal Code"
                          {...field}
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
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Country"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end mt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoveLocation(index)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Remove
              </Button>
            </div>
          </div>
        ))}
        
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onAddLocation}
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Location
        </Button>
      </div>

      {/* Regional Restrictions Section */}
      {locations.length > 0 && (
        <div className="mt-8 pt-6 border-t border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <FormLabel className="text-sm font-medium">Regional Restrictions</FormLabel>
              <p className="text-xs text-muted-foreground ml-2">
                Apply service restrictions to specific geographic regions
              </p>
            </div>
            <Switch
              checked={globalRestrictionsEnabled}
              onCheckedChange={setGlobalRestrictionsEnabled}
            />
          </div>
          
          {globalRestrictionsEnabled && (
            <div className="space-y-6">
              <div className="bg-muted/20 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                  <strong>Regional Restrictions</strong> allow you to specify where your services are available:
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                  <li>• <span className="text-green-600 dark:text-green-400">Included addresses</span>: Service available only in these locations</li>
                  <li>• <span className="text-red-600 dark:text-red-400">Excluded addresses</span>: Service NOT available in these locations</li>
                  <li>• You can combine both types (e.g., "Available in Mexico, except Guadalajara")</li>
                </ul>
              </div>
              
              {locations.map((location, index) => (
                <RegionalRestrictionsSection
                  key={index}
                  locationIndex={index}
                  location={location}
                  onAddIncludedAddress={onAddIncludedAddress}
                  onAddExcludedAddress={onAddExcludedAddress}
                  onRemoveIncludedAddress={onRemoveIncludedAddress}
                  onRemoveExcludedAddress={onRemoveExcludedAddress}
                  onIncludedAddressUpdate={onIncludedAddressUpdate}
                  onExcludedAddressUpdate={onExcludedAddressUpdate}
                  globalEnabled={true}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
} 