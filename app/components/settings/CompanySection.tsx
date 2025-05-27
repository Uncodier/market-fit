"use client"

import { useFormContext } from "react-hook-form"
import { useState, useEffect } from "react"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card"
import { Button } from "../ui/button"
import { PlusCircle, Trash2, Clock } from "../ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Switch } from "../ui/switch"
import { ChevronDown, ChevronRight } from "../ui/icons"

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
          <CardTitle className="text-xl font-semibold">Business Hours</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Define your business hours for different regions and locations. Most agent activities will start on those time ranges.
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          <BusinessHoursSection />
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
          <CardDescription>Add your company's physical locations. Commercial efforts will be prioritized in these areas.</CardDescription>
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

// Business Hours Component
function BusinessHoursSection() {
  const form = useFormContext<SiteFormValues>()
  const formBusinessHours = form.watch("business_hours")
  const [businessHoursList, setBusinessHoursList] = useState<any[]>(
    formBusinessHours || []
  )
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

  // Sync businessHoursList when form values change
  useEffect(() => {
    if (formBusinessHours && formBusinessHours.length > 0) {
      setBusinessHoursList(formBusinessHours)
    } else if (formBusinessHours && formBusinessHours.length === 0) {
      setBusinessHoursList([])
    }
  }, [formBusinessHours])

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedItems(newExpanded)
  }

  const TIMEZONES = [
    { value: "America/Mexico_City", label: "Mexico City (GMT-6)" },
    { value: "America/Los_Angeles", label: "Los Angeles (GMT-8)" },
    { value: "America/Chicago", label: "Chicago (GMT-6)" },
    { value: "America/New_York", label: "New York (GMT-5)" },
    { value: "America/Toronto", label: "Toronto (GMT-5)" },
    { value: "America/Vancouver", label: "Vancouver (GMT-8)" },
    { value: "America/Sao_Paulo", label: "São Paulo (GMT-3)" },
    { value: "America/Buenos_Aires", label: "Buenos Aires (GMT-3)" },
    { value: "Europe/London", label: "London (GMT+0)" },
    { value: "Europe/Paris", label: "Paris (GMT+1)" },
    { value: "Europe/Madrid", label: "Madrid (GMT+1)" },
    { value: "Europe/Berlin", label: "Berlin (GMT+1)" },
    { value: "Europe/Moscow", label: "Moscow (GMT+3)" },
    { value: "Asia/Dubai", label: "Dubai (GMT+4)" },
    { value: "Asia/Mumbai", label: "Mumbai (GMT+5:30)" },
    { value: "Asia/Singapore", label: "Singapore (GMT+8)" },
    { value: "Asia/Hong_Kong", label: "Hong Kong (GMT+8)" },
    { value: "Asia/Tokyo", label: "Tokyo (GMT+9)" },
    { value: "Asia/Shanghai", label: "Shanghai (GMT+8)" },
    { value: "Australia/Sydney", label: "Sydney (GMT+11)" },
    { value: "Pacific/Auckland", label: "Auckland (GMT+13)" }
  ]

  const DAYS_OF_WEEK = [
    { key: "monday", label: "Monday" },
    { key: "tuesday", label: "Tuesday" },
    { key: "wednesday", label: "Wednesday" },
    { key: "thursday", label: "Thursday" },
    { key: "friday", label: "Friday" },
    { key: "saturday", label: "Saturday" },
    { key: "sunday", label: "Sunday" }
  ]

  const TIME_OPTIONS = (() => {
    const times = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        times.push({ value: time, label: time })
      }
    }
    return times
  })()

  const addBusinessHours = () => {
    const newHours = {
      name: "",
      timezone: "America/Mexico_City",
      respectHolidays: true,
      days: {
        monday: { enabled: true, start: "09:00", end: "18:00" },
        tuesday: { enabled: true, start: "09:00", end: "18:00" },
        wednesday: { enabled: true, start: "09:00", end: "18:00" },
        thursday: { enabled: true, start: "09:00", end: "18:00" },
        friday: { enabled: true, start: "09:00", end: "18:00" },
        saturday: { enabled: false, start: "09:00", end: "14:00" },
        sunday: { enabled: false, start: "09:00", end: "14:00" }
      }
    }
    const newList = [...businessHoursList, newHours]
    setBusinessHoursList(newList)
    form.setValue("business_hours", newList)
    
    // Expand the newly added item
    const newExpanded = new Set(expandedItems)
    newExpanded.add(newList.length - 1)
    setExpandedItems(newExpanded)
  }

  const removeBusinessHours = (index: number) => {
    const newList = businessHoursList.filter((_, i) => i !== index)
    setBusinessHoursList(newList)
    form.setValue("business_hours", newList)
  }

  const updateBusinessHours = (index: number, field: string, value: any) => {
    const newList = [...businessHoursList]
    if (field.includes('.')) {
      // Handle nested fields like days.monday.enabled
      const parts = field.split('.')
      let current = newList[index]
      for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]]
      }
      current[parts[parts.length - 1]] = value
    } else {
      newList[index][field] = value
    }
    setBusinessHoursList(newList)
    form.setValue("business_hours", newList)
  }

  return (
    <div className="space-y-6">
      {businessHoursList.map((hours, index) => {
        const isExpanded = expandedItems.has(index)
        
        return (
          <div key={index} className="border border-border rounded-lg overflow-hidden">
            <div className="p-4 bg-muted/30">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => toggleExpanded(index)}
                  className="p-1 hover:bg-muted/50 rounded transition-colors h-10 w-10 flex items-center justify-center"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`business_hours.${index}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="e.g., Main Office, Europe Branch"
                            value={hours.name}
                            onChange={(e) => {
                              field.onChange(e)
                              updateBusinessHours(index, 'name', e.target.value)
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
                    name={`business_hours.${index}.timezone`}
                    render={({ field }) => (
                      <FormItem>
                        <Select
                          value={hours.timezone}
                          onValueChange={(value) => {
                            field.onChange(value)
                            updateBusinessHours(index, 'timezone', value)
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TIMEZONES.map((tz) => (
                              <SelectItem key={tz.value} value={tz.value}>
                                {tz.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  type="button"
                  onClick={() => removeBusinessHours(index)}
                  className="h-10 w-10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {isExpanded && (
              <div className="p-6 space-y-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Respect Holidays</label>
                    <p className="text-xs text-muted-foreground">
                      Agents will not work on regional holidays when enabled
                    </p>
                  </div>
                  <Switch
                    checked={hours.respectHolidays || false}
                    onCheckedChange={(checked) => {
                      updateBusinessHours(index, 'respectHolidays', checked)
                    }}
                  />
                </div>

                <div className="space-y-3">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day.key} className="flex items-center gap-4">
                      <div className="w-32">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={hours.days[day.key].enabled}
                            onCheckedChange={(checked) => {
                              updateBusinessHours(index, `days.${day.key}.enabled`, checked)
                            }}
                          />
                          <label className="text-sm font-medium">
                            {day.label}
                          </label>
                        </div>
                      </div>

                      {hours.days[day.key].enabled && (
                        <div className="flex items-center gap-2 flex-1">
                          <Select
                            value={hours.days[day.key].start}
                            onValueChange={(value) => {
                              updateBusinessHours(index, `days.${day.key}.start`, value)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Start time" />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.map((time) => (
                                <SelectItem key={time.value} value={time.value}>
                                  {time.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <span className="text-muted-foreground">to</span>

                          <Select
                            value={hours.days[day.key].end}
                            onValueChange={(value) => {
                              updateBusinessHours(index, `days.${day.key}.end`, value)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="End time" />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.map((time) => (
                                <SelectItem key={time.value} value={time.value}>
                                  {time.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {!hours.days[day.key].enabled && (
                        <div className="flex-1 text-sm text-muted-foreground">
                          Closed
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}

      <Button
        variant="outline"
        className="w-full"
        type="button"
        onClick={addBusinessHours}
      >
        <PlusCircle className="mr-2 h-4 w-4" />
        Add Business Hours Schedule
      </Button>
    </div>
  )
} 