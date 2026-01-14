"use client"

import { useFormContext } from "react-hook-form"
import { useState, useCallback, useEffect } from "react"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { PlusCircle, Trash2 } from "../ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Switch } from "../ui/switch"
import { ChevronDown, ChevronRight } from "../ui/icons"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
import { ActionFooter } from "../ui/card-footer"
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

const TIMEZONES = [
  // Americas
  { value: "America/Mexico_City", label: "Mexico City (GMT-6)" },
  { value: "America/Los_Angeles", label: "Los Angeles (GMT-8)" },
  { value: "America/Chicago", label: "Chicago (GMT-6)" },
  { value: "America/New_York", label: "New York (GMT-5)" },
  { value: "America/Toronto", label: "Toronto (GMT-5)" },
  { value: "America/Vancouver", label: "Vancouver (GMT-8)" },
  { value: "America/Sao_Paulo", label: "São Paulo (GMT-3)" },
  { value: "America/Buenos_Aires", label: "Buenos Aires (GMT-3)" },
  { value: "America/Bogota", label: "Bogotá (GMT-5)" },
  { value: "America/Lima", label: "Lima (GMT-5)" },
  { value: "America/Santiago", label: "Santiago (GMT-3)" },
  { value: "America/Caracas", label: "Caracas (GMT-4)" },
  { value: "America/Panama", label: "Panama City (GMT-5)" },
  { value: "America/Costa_Rica", label: "San José (GMT-6)" },
  { value: "America/Guatemala", label: "Guatemala City (GMT-6)" },
  { value: "America/Montevideo", label: "Montevideo (GMT-3)" },
  // Europe
  { value: "Europe/London", label: "London (GMT+0)" },
  { value: "Europe/Paris", label: "Paris (GMT+1)" },
  { value: "Europe/Madrid", label: "Madrid (GMT+1)" },
  { value: "Europe/Berlin", label: "Berlin (GMT+1)" },
  { value: "Europe/Rome", label: "Rome (GMT+1)" },
  { value: "Europe/Amsterdam", label: "Amsterdam (GMT+1)" },
  { value: "Europe/Lisbon", label: "Lisbon (GMT+0)" },
  { value: "Europe/Brussels", label: "Brussels (GMT+1)" },
  { value: "Europe/Vienna", label: "Vienna (GMT+1)" },
  { value: "Europe/Zurich", label: "Zurich (GMT+1)" },
  { value: "Europe/Stockholm", label: "Stockholm (GMT+1)" },
  { value: "Europe/Copenhagen", label: "Copenhagen (GMT+1)" },
  { value: "Europe/Oslo", label: "Oslo (GMT+1)" },
  { value: "Europe/Helsinki", label: "Helsinki (GMT+2)" },
  { value: "Europe/Warsaw", label: "Warsaw (GMT+1)" },
  { value: "Europe/Prague", label: "Prague (GMT+1)" },
  { value: "Europe/Budapest", label: "Budapest (GMT+1)" },
  { value: "Europe/Bucharest", label: "Bucharest (GMT+2)" },
  { value: "Europe/Athens", label: "Athens (GMT+2)" },
  { value: "Europe/Moscow", label: "Moscow (GMT+3)" },
  { value: "Europe/Istanbul", label: "Istanbul (GMT+3)" },
  // Asia
  { value: "Asia/Dubai", label: "Dubai (GMT+4)" },
  { value: "Asia/Mumbai", label: "Mumbai (GMT+5:30)" },
  { value: "Asia/Kolkata", label: "Kolkata (GMT+5:30)" },
  { value: "Asia/Bangkok", label: "Bangkok (GMT+7)" },
  { value: "Asia/Singapore", label: "Singapore (GMT+8)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (GMT+8)" },
  { value: "Asia/Tokyo", label: "Tokyo (GMT+9)" },
  { value: "Asia/Shanghai", label: "Shanghai (GMT+8)" },
  { value: "Asia/Seoul", label: "Seoul (GMT+9)" },
  { value: "Asia/Manila", label: "Manila (GMT+8)" },
  { value: "Asia/Jakarta", label: "Jakarta (GMT+7)" },
  { value: "Asia/Kuala_Lumpur", label: "Kuala Lumpur (GMT+8)" },
  { value: "Asia/Ho_Chi_Minh", label: "Ho Chi Minh City (GMT+7)" },
  { value: "Asia/Taipei", label: "Taipei (GMT+8)" },
  { value: "Asia/Riyadh", label: "Riyadh (GMT+3)" },
  { value: "Asia/Tel_Aviv", label: "Tel Aviv (GMT+2)" },
  { value: "Asia/Karachi", label: "Karachi (GMT+5)" },
  { value: "Asia/Dhaka", label: "Dhaka (GMT+6)" },
  { value: "Asia/Almaty", label: "Almaty (GMT+6)" },
  // Africa
  { value: "Africa/Cairo", label: "Cairo (GMT+2)" },
  { value: "Africa/Lagos", label: "Lagos (GMT+1)" },
  { value: "Africa/Johannesburg", label: "Johannesburg (GMT+2)" },
  { value: "Africa/Nairobi", label: "Nairobi (GMT+3)" },
  { value: "Africa/Casablanca", label: "Casablanca (GMT+1)" },
  { value: "Africa/Tunis", label: "Tunis (GMT+1)" },
  // Oceania
  { value: "Australia/Sydney", label: "Sydney (GMT+11)" },
  { value: "Australia/Melbourne", label: "Melbourne (GMT+11)" },
  { value: "Australia/Brisbane", label: "Brisbane (GMT+10)" },
  { value: "Australia/Perth", label: "Perth (GMT+8)" },
  { value: "Pacific/Auckland", label: "Auckland (GMT+13)" },
  { value: "Pacific/Fiji", label: "Suva (GMT+12)" }
]

const DAYS_OF_WEEK = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" }
] as const

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

interface BusinessHoursSectionProps {
  onSave?: (data: SiteFormValues) => void
}

export function BusinessHoursSection({ onSave }: BusinessHoursSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const businessHours = form.watch("business_hours") || []
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  const toggleExpanded = useCallback((index: number) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedItems(newExpanded)
  }, [expandedItems])

  // Emit business hours update event whenever list changes
  useEffect(() => {
    if (businessHours.length > 0) {
      const hoursData = businessHours.map((hours: any, index: number) => ({
        id: `business-hours-${index}`,
        title: hours.name || `Schedule ${index + 1}`,
      }));
      
      window.dispatchEvent(new CustomEvent('businessHoursUpdated', { 
        detail: hoursData 
      }));
    }
  }, [businessHours]);

  const addBusinessHours = useCallback(() => {
    const currentBusinessHours = form.getValues("business_hours") || []
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
    const newList = [newHours, ...currentBusinessHours]
    form.setValue("business_hours", newList)
    
    // Expand the newly added item (now at index 0)
    setExpandedItems(new Set([0, ...Array.from(expandedItems).map(i => i + 1)]))
  }, [form, expandedItems])

  const removeBusinessHours = useCallback((index: number) => {
    const currentBusinessHours = form.getValues("business_hours") || []
    const newList = currentBusinessHours.filter((_, i) => i !== index)
    form.setValue("business_hours", newList)
  }, [form])

  const updateBusinessHourField = useCallback((index: number, fieldPath: string, value: any) => {
    const currentBusinessHours = form.getValues("business_hours") || []
    const newList = [...currentBusinessHours]
    
    // Navigate to the nested field using the path
    const parts = fieldPath.split('.')
    let target = newList[index] as any
    
    for (let i = 0; i < parts.length - 1; i++) {
      target = target[parts[i]]
    }
    
    target[parts[parts.length - 1]] = value
    form.setValue("business_hours", newList)
  }, [form])

  const handleSaveBusinessHours = async (index: number) => {
    if (!onSave) return
    setIsSaving(true)
    try {
      const formData = form.getValues()
      await onSave(formData)
    } catch (error) {
      console.error("Error saving business hours:", error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div id="business-hours" className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Business Hours</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Define your business hours for different regions and locations
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addBusinessHours}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Schedule
        </Button>
      </div>

      {/* Business Hours Cards */}
      {businessHours.map((hours: any, index: number) => {
        const isExpanded = expandedItems.has(index)
        
        return (
          <Card key={index} id={`business-hours-${index}`} className="border border-border">
            {/* Collapsible Header */}
            <CardHeader 
              className="px-8 py-6 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleExpanded(index)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div onClick={(e) => e.stopPropagation()}>
                    <Input
                      placeholder="e.g., Main Office, Europe Branch"
                      value={hours.name || ""}
                      onChange={(e) => updateBusinessHourField(index, "name", e.target.value)}
                      className="bg-background"
                    />
                  </div>

                  <div onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={hours.timezone || "America/Mexico_City"}
                      onValueChange={(value) => updateBusinessHourField(index, "timezone", value)}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Respect Holidays</label>
                    <p className="text-xs text-muted-foreground">
                      Agents will not work on regional holidays when enabled
                    </p>
                  </div>
                  <Switch
                    checked={hours.respectHolidays || false}
                    onCheckedChange={(checked) => updateBusinessHourField(index, "respectHolidays", checked)}
                  />
                </div>

                <div className="space-y-3">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day.key} className="flex items-center gap-4">
                      <div className="w-32">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={hours.days[day.key]?.enabled || false}
                            onCheckedChange={(checked) => updateBusinessHourField(index, `days.${day.key}.enabled`, checked)}
                          />
                          <label className="text-sm font-medium">
                            {day.label}
                          </label>
                        </div>
                      </div>

                      {hours.days[day.key]?.enabled && (
                        <div className="flex items-center gap-2 flex-1">
                          <Select
                            value={hours.days[day.key]?.start || "09:00"}
                            onValueChange={(value) => updateBusinessHourField(index, `days.${day.key}.start`, value)}
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
                            value={hours.days[day.key]?.end || "18:00"}
                            onValueChange={(value) => updateBusinessHourField(index, `days.${day.key}.end`, value)}
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

                      {!hours.days[day.key]?.enabled && (
                        <div className="flex-1 text-sm text-muted-foreground">
                          Closed
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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
                        Remove Schedule
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Schedule</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove this business hours schedule? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => removeBusinessHours(index)}
                          className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
                        >
                          Remove Schedule
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSaveBusinessHours(index)}
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save Schedule"}
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