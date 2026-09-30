"use client"

import { Input } from "../ui/input"

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Switch } from "../ui/switch"

import { Trash2, PlusCircle, Home, Shield } from "@/app/components/ui/icons"
import { Button } from "../ui/button"

import type { useCreateSiteForm } from "./use-create-site-form"
export function SiteLocationsCard({ globalRestrictionsEnabled, setGlobalRestrictionsEnabled, form, handleAddLocation, handleRemoveLocation, handleAddIncludedAddress, handleAddExcludedAddress, handleRemoveIncludedAddress, handleRemoveExcludedAddress, handleIncludedAddressUpdate, handleExcludedAddressUpdate }: ReturnType<typeof useCreateSiteForm>) {
return (          <Card className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="px-8 py-6">
              <CardTitle className="text-xl font-semibold">Business Locations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 px-8 pb-8">
              <div className="text-center mb-6">
                <p className="text-sm text-muted-foreground">
                  Add your company's physical locations. Commercial efforts will be prioritized in these areas.
                </p>
              </div>
              
              {/* Global restrictions toggle */}
              <div className="flex items-center justify-between p-4 bg-muted/5 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <FormLabel className="text-sm font-medium">Regional Restrictions</FormLabel>
                    <p className="text-xs text-muted-foreground mt-1">
                      Define specific areas where your services are available or restricted
                    </p>
                  </div>
                </div>
                <Switch
                  checked={globalRestrictionsEnabled}
                  onCheckedChange={setGlobalRestrictionsEnabled}
                />
              </div>

              {globalRestrictionsEnabled && (
                <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <div className="h-2 w-2 bg-blue-500 rounded-full font-inter mt-2"></div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        Regional Restrictions Guidelines
                      </p>
                      <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                        <p><strong>Only in these addresses</strong> allow you to specify where your services are available:</p>
                        <ul className="ml-4 space-y-1">
                          <li>• Service will ONLY be available in specified locations</li>
                          <li>• Useful for businesses with specific service areas</li>
                          <li>• Can specify by address, city, state, or country</li>
                        </ul>
                        <p className="mt-2"><strong>Except in these addresses</strong> allow you to exclude specific areas:</p>
                        <ul className="ml-4 space-y-1">
                          <li>• Service will be available everywhere EXCEPT specified locations</li>
                          <li>• Useful for excluding problematic or restricted areas</li>
                          <li>• Takes precedence over included addresses</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Locations */}
              <div className="space-y-4">
                {form.watch("locations")?.map((location, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Home className="h-4 w-4 text-muted-foreground" />
                        <FormLabel className="text-sm font-medium">
                          Location {index + 1}
                        </FormLabel>
                      </div>
                      {form.watch("locations")?.length > 0 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          type="button"
                          onClick={() => handleRemoveLocation(index)}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name={`locations.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-foreground">Location Name</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Home className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                  className="pl-12 h-12 text-base" 
                                  placeholder="Headquarters, Branch Office, etc."
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-xs mt-2" />
                          </FormItem>
                        )}
                      />

                      {/* Regional Restrictions for this location */}
                      {globalRestrictionsEnabled && (
                        <div className="border dark:border-white/5 border-black/5 rounded-lg p-4 bg-muted/5 dark:bg-muted/10">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-muted-foreground" />
                              <FormLabel className="text-sm font-medium">
                                {location.name || `Location ${index + 1}`} Restrictions
                              </FormLabel>
                            </div>
                          </div>
                          
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
                                        onClick={() => handleRemoveIncludedAddress(index, addressIndex)}
                                        className="h-8 w-8"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <Input
                                        placeholder="Address name (e.g., Mexico)"
                                        value={includedAddress.name || ""}
                                        onChange={(e) => handleIncludedAddressUpdate(index, addressIndex, 'name', e.target.value)}
                                        className="bg-background text-sm"
                                      />
                                      
                                      <Input
                                        placeholder="Street address"
                                        value={includedAddress.address || ""}
                                        onChange={(e) => handleIncludedAddressUpdate(index, addressIndex, 'address', e.target.value)}
                                        className="bg-background text-sm"
                                      />
                                      
                                      <div className="grid grid-cols-3 gap-2">
                                        <Input
                                          placeholder="City"
                                          value={includedAddress.city || ""}
                                          onChange={(e) => handleIncludedAddressUpdate(index, addressIndex, 'city', e.target.value)}
                                          className="bg-background text-sm"
                                        />
                                        <Input
                                          placeholder="State"
                                          value={includedAddress.state || ""}
                                          onChange={(e) => handleIncludedAddressUpdate(index, addressIndex, 'state', e.target.value)}
                                          className="bg-background text-sm"
                                        />
                                        <Input
                                          placeholder="ZIP"
                                          value={includedAddress.zip || ""}
                                          onChange={(e) => handleIncludedAddressUpdate(index, addressIndex, 'zip', e.target.value)}
                                          className="bg-background text-sm"
                                        />
                                      </div>
                                      
                                      <Input
                                        placeholder="Country"
                                        value={includedAddress.country || ""}
                                        onChange={(e) => handleIncludedAddressUpdate(index, addressIndex, 'country', e.target.value)}
                                        className="bg-background text-sm"
                                      />
                                    </div>
                                  </div>
                                ))}
                                
                                <Button
                                  variant="outline"
                                  size="sm"
                                  type="button"
                                  onClick={() => handleAddIncludedAddress(index)}
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
                                        onClick={() => handleRemoveExcludedAddress(index, addressIndex)}
                                        className="h-8 w-8"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <Input
                                        placeholder="Address name (e.g., Guadalajara)"
                                        value={excludedAddress.name || ""}
                                        onChange={(e) => handleExcludedAddressUpdate(index, addressIndex, 'name', e.target.value)}
                                        className="bg-background text-sm"
                                      />
                                      
                                      <Input
                                        placeholder="Street address"
                                        value={excludedAddress.address || ""}
                                        onChange={(e) => handleExcludedAddressUpdate(index, addressIndex, 'address', e.target.value)}
                                        className="bg-background text-sm"
                                      />
                                      
                                      <div className="grid grid-cols-3 gap-2">
                                        <Input
                                          placeholder="City"
                                          value={excludedAddress.city || ""}
                                          onChange={(e) => handleExcludedAddressUpdate(index, addressIndex, 'city', e.target.value)}
                                          className="bg-background text-sm"
                                        />
                                        <Input
                                          placeholder="State"
                                          value={excludedAddress.state || ""}
                                          onChange={(e) => handleExcludedAddressUpdate(index, addressIndex, 'state', e.target.value)}
                                          className="bg-background text-sm"
                                        />
                                        <Input
                                          placeholder="ZIP"
                                          value={excludedAddress.zip || ""}
                                          onChange={(e) => handleExcludedAddressUpdate(index, addressIndex, 'zip', e.target.value)}
                                          className="bg-background text-sm"
                                        />
                                      </div>
                                      
                                      <Input
                                        placeholder="Country"
                                        value={excludedAddress.country || ""}
                                        onChange={(e) => handleExcludedAddressUpdate(index, addressIndex, 'country', e.target.value)}
                                        className="bg-background text-sm"
                                      />
                                    </div>
                                  </div>
                                ))}
                                
                                <Button
                                  variant="outline"
                                  size="sm"
                                  type="button"
                                  onClick={() => handleAddExcludedAddress(index)}
                                  className="w-full border-red-300 dark:border-red-600/50 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                                >
                                  <PlusCircle className="mr-2 h-3 w-3" />
                                  Add Excluded Address
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12"
                  onClick={handleAddLocation}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Business Location
                </Button>
              </div>
            </CardContent>
          </Card>
)
}
