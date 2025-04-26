"use client"

import { useFormContext } from "react-hook-form"
import { useState } from "react"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card"
import { Button } from "../ui/button"
import { PlusCircle, Trash2 } from "../ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

interface CompanySectionProps {
  active: boolean
}

const COMPANY_SIZES = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1000 employees" },
  { value: "1001+", label: "1001+ employees" }
]

const INDUSTRIES = [
  { value: "technology", label: "Technology" },
  { value: "healthcare", label: "Healthcare" },
  { value: "finance", label: "Finance" },
  { value: "education", label: "Education" },
  { value: "retail", label: "Retail" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "entertainment", label: "Entertainment" },
  { value: "food", label: "Food & Beverage" },
  { value: "travel", label: "Travel & Hospitality" },
  { value: "real_estate", label: "Real Estate" },
  { value: "professional_services", label: "Professional Services" },
  { value: "other", label: "Other" }
]

export function CompanySection({ active }: CompanySectionProps) {
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

  if (!active) return null

  return (
    <div className="space-y-6">
      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Company Profile</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Basic information about your company
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          <FormField
            control={form.control}
            name="about"
            render={({ field }) => (
              <FormItem>
                <FormLabel>About</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Tell us about your company..."
                    className="min-h-[100px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormDescription>
                  A brief description of your company, mission, and values.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="company_size"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Size</FormLabel>
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select company size" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COMPANY_SIZES.map((size) => (
                        <SelectItem key={size.value} value={size.value}>
                          {size.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry</FormLabel>
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INDUSTRIES.map((industry) => (
                        <SelectItem key={industry.value} value={industry.value}>
                          {industry.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Business Goals</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Set your company goals for different time periods
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          <FormField
            control={form.control}
            name="goals.quarterly"
            render={({ field }) => {
              console.log("Quarterly field value:", field.value);
              return (
              <FormItem>
                <FormLabel>Quarter Goals</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What do you want to achieve this quarter?"
                    className="min-h-[100px]"
                    {...field}
                    value={field.value || ""}
                    onChange={(e) => {
                      field.onChange(e);
                      console.log("Quarterly goal changed to:", e.target.value);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}}
          />
          
          <FormField
            control={form.control}
            name="goals.yearly"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Year Goals</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What do you want to achieve this year?"
                    className="min-h-[100px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="goals.fiveYear"
            render={({ field }) => (
              <FormItem>
                <FormLabel>5 Year Goals</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What do you want to achieve in the next 5 years?"
                    className="min-h-[100px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="goals.tenYear"
            render={({ field }) => (
              <FormItem>
                <FormLabel>10 Year Goals</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What do you want to achieve in the next 10 years?"
                    className="min-h-[100px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">SWOT Analysis</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Analyze your company's strengths, weaknesses, opportunities, and threats
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 px-8 pb-8">
          <FormField
            control={form.control}
            name="swot.strengths"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Strengths</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What does your company do well?"
                    className="min-h-[150px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="swot.weaknesses"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Weaknesses</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Where could your company improve?"
                    className="min-h-[150px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="swot.opportunities"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Opportunities</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What opportunities exist for your company?"
                    className="min-h-[150px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="swot.threats"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Threats</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What threats does your company face?"
                    className="min-h-[150px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-4">
          <CardTitle className="text-lg font-semibold">Locations</CardTitle>
          <CardDescription>Add your company's physical locations</CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-6 space-y-6">
          {displayLocations.length > 0 && (
            <div className="space-y-6">
              {displayLocations.map((location, index) => (
                <div key={`location-row-${index}`} className="flex flex-col md:flex-row gap-4 w-full">
                  <div className="md:w-1/4">
                    <FormField
                      control={form.control}
                      name={`locations.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={index !== 0 ? "sr-only" : undefined}>
                            Location Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="HQ, Branch Office, etc."
                              value={location.name}
                              onChange={(e) => {
                                field.onChange(e)
                                handleLocationUpdate(index, 'name', e.target.value)
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="flex-1">
                    <FormField
                      control={form.control}
                      name={`locations.${index}.address`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={index !== 0 ? "sr-only" : undefined}>
                            Address
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Street address"
                              value={location.address || ""}
                              onChange={(e) => {
                                field.onChange(e)
                                handleLocationUpdate(index, 'address', e.target.value)
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="md:w-1/6">
                    <FormField
                      control={form.control}
                      name={`locations.${index}.country`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={index !== 0 ? "sr-only" : undefined}>
                            Country
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Country"
                              value={location.country || ""}
                              onChange={(e) => {
                                field.onChange(e)
                                handleLocationUpdate(index, 'country', e.target.value)
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="flex items-end md:w-auto">
                    <Button
                      size="icon"
                      variant="ghost"
                      type="button"
                      onClick={() => removeLocation(index)}
                      className="mt-auto md:ml-0"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <Button
            variant="outline"
            className="w-full"
            type="button"
            onClick={addLocation}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Location
          </Button>
        </CardContent>
      </Card>
    </div>
  )
} 