"use client"

import { useFormContext } from "react-hook-form"
import { useState, useCallback } from "react"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { PlusCircle, Trash2 } from "../ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Switch } from "../ui/switch"
import { ChevronDown, ChevronRight } from "../ui/icons"

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

export function BusinessHoursSection() {
  const form = useFormContext<SiteFormValues>()
  const businessHours = form.watch("business_hours") || []
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

  const toggleExpanded = useCallback((index: number) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedItems(newExpanded)
  }, [expandedItems])

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
    const newList = [...currentBusinessHours, newHours]
    form.setValue("business_hours", newList)
    
    // Expand the newly added item
    const newExpanded = new Set(expandedItems)
    newExpanded.add(newList.length - 1)
    setExpandedItems(newExpanded)
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

  return (
    <div className="space-y-6">
      {businessHours.map((hours: any, index: number) => {
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
                  <div>
                    <Input
                      placeholder="e.g., Main Office, Europe Branch"
                      value={hours.name || ""}
                      onChange={(e) => updateBusinessHourField(index, "name", e.target.value)}
                      className="bg-background"
                    />
                  </div>

                  <div>
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